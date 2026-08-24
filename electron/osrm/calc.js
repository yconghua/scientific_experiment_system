/**
 * OSRM 预处理 + 路由计算模块（本地 exe 方案）
 *
 * 依赖 4 个 osrm 可执行程序（放到本目录 bin/ 下，打包时作为 extraResources 分发）：
 *   osrm-extract / osrm-partition / osrm-customize：.osm/.osm.pbf → .osrm 预处理
 *   osrm-routed：启动路由服务（HTTP，监听 127.0.0.1:port），提供距离计算
 *
 * 计算：内置 Node 并发池，直接请求本机 OSRM 服务（无 Python、无原生模块依赖）。
 */
const path = require('node:path')
const fs = require('node:fs')
const { spawn } = require('node:child_process')
const { app } = require('electron')

// exe 目录：开发时用项目内 electron/osrm/bin/；打包后从 resources/osrm/bin/ 读取（extraResources 分发）
const BIN_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'osrm', 'bin')
  : path.join(__dirname, 'bin')
const DEFAULT_PORT = 5000
const HEALTH_TIMEOUT_MS = 60000 // 服务就绪等待上限
const REQUEST_TIMEOUT_MS = 10000 // 单个请求超时

function isWin() {
  return process.platform === 'win32'
}

// 取可执行文件完整路径（Windows 追加 .exe）
function exePath(name) {
  return path.join(BIN_DIR, isWin() ? name + '.exe' : name)
}

// 解析 car.lua（驾车）profile：exe 同目录 profiles/ → bin/ → 本项目 profiles/
function resolveProfilePath() {
  const candidates = [
    path.join(BIN_DIR, 'profiles', 'car.lua'),
    path.join(BIN_DIR, 'car.lua'),
    path.join(__dirname, 'profiles', 'car.lua')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

// 顺序执行一个 exe（exit code 0 视为成功）
function runExe(name, args, onStdout) {
  return new Promise((resolve, reject) => {
    const exe = exePath(name)
    if (!fs.existsSync(exe)) {
      return reject(new Error(`找不到 ${name} 程序，请确认已放入 bin 目录：${exe}`))
    }
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let errBuf = ''
    child.stdout.on('data', (d) => {
      const s = String(d)
      if (onStdout) onStdout(s)
    })
    child.stderr.on('data', (d) => {
      errBuf += String(d)
    })
    child.on('error', (err) => reject(new Error(`${name} 启动失败：${err.message}`)))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${name} 退出码 ${code}：${errBuf.slice(-500)}`))
    })
  })
}

// .osm / .osm.pbf → 对应 .osrm 路径
function osrmPathOf(osmPath) {
  return String(osmPath).replace(/\.(osm\.pbf|osm)$/i, '.osrm')
}

// 是否已预处理（.osrm 存在且非空）
function isProcessed(osrmFilePath) {
  try {
    return fs.existsSync(osrmFilePath) && fs.statSync(osrmFilePath).size > 0
  } catch (e) {
    return false
  }
}

/**
 * 确保路网已预处理（已存在 .osrm 则跳过）
 * @param {string} osmPath 原始 .osm/.osm.pbf 路径
 * @param {(stage:string)=>void} onStage 阶段回调
 * @returns {Promise<string>} .osrm 文件路径
 */
async function ensureProcessed(osmPath, onStage) {
  const target = osrmPathOf(osmPath)
  // 防御：预处理产物路径（源文件同目录、同名 .osrm）不得与源文件路径相同，
  // 确保任何情况下都不会覆盖用户上传的原始文件
  if (path.resolve(target) === path.resolve(osmPath)) {
    throw new Error('预处理输出路径与源文件冲突，请检查路网文件名')
  }
  if (isProcessed(target)) return target
  const profile = resolveProfilePath()
  if (!profile) {
    throw new Error('找不到 OSRM profile（car.lua），请将 profiles/car.lua 放到 bin 目录')
  }
  if (onStage) onStage('extract')
  // osrm-extract：显式指定 --output 为源文件同目录下的 .osrm（源文件只读，产物与源文件同文件夹）
  await runExe('osrm-extract', ['-p', profile, '--output', target, osmPath])
  if (onStage) onStage('partition')
  // osrm-partition / osrm-customize 就地处理 .osrm 及其附属文件，产物同样落在源文件同目录
  await runExe('osrm-partition', [target])
  if (onStage) onStage('customize')
  await runExe('osrm-customize', [target])
  return target
}

// 健康检查：请求一次路由接口，能返回 code=Ok 即认为服务就绪
async function ping(port) {
  const url = `http://127.0.0.1:${port}/route/v1/driving/113.0,28.0;113.1,28.1?overview=false`
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(t)
    if (!resp.ok) return false
    const data = await resp.json()
    return data && data.code === 'Ok'
  } catch (e) {
    return false
  }
}

/**
 * 启动 osrm-routed 服务（等待端口就绪后 resolve）
 * @param {string} osrmFilePath .osrm 文件
 * @param {number} port 监听端口
 * @returns {Promise<{ child:object, port:number }>}
 */
function startServer(osrmFilePath, port) {
  return new Promise((resolve, reject) => {
    const exe = exePath('osrm-routed')
    if (!fs.existsSync(exe)) {
      return reject(new Error('找不到 osrm-routed 程序，请确认已放入 bin 目录'))
    }
    const child = spawn(exe, ['-p', String(port), osrmFilePath], { stdio: ['ignore', 'pipe', 'pipe'] })
    let errBuf = ''
    child.stderr.on('data', (d) => {
      errBuf += String(d)
    })
    child.on('error', (err) => reject(new Error('osrm-routed 启动失败：' + err.message)))
    child.on('exit', (code) => {
      reject(new Error('osrm-routed 提前退出（退出码 ' + code + '）：' + errBuf.slice(-500)))
    })
    // 轮询健康检查直到就绪
    const start = Date.now()
    const timer = setInterval(async () => {
      if (await ping(port)) {
        clearInterval(timer)
        resolve({ child, port })
      } else if (Date.now() - start > HEALTH_TIMEOUT_MS) {
        clearInterval(timer)
        try { child.kill() } catch (e) {}
        reject(new Error('OSRM 服务启动超时（' + HEALTH_TIMEOUT_MS / 1000 + 's），请检查路网数据'))
      }
    }, 800)
  })
}

// 停止服务
async function stopServer(server) {
  if (!server || !server.child) return
  try {
    server.child.kill()
  } catch (e) {
    // 忽略
  }
}

// 单次距离请求（超时/失败返回 distance=null）
async function getDistance(pair, port) {
  const url = `http://127.0.0.1:${port}/route/v1/driving/${pair.from.lng},${pair.from.lat};${pair.to.lng},${pair.to.lat}?overview=false`
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) return { ...pair, distance: null }
    const data = await resp.json()
    if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
      return { ...pair, distance: data.routes[0].distance }
    }
    return { ...pair, distance: null }
  } catch (e) {
    return { ...pair, distance: null }
  } finally {
    clearTimeout(t)
  }
}

/**
 * 并发批量计算（worker 池）
 * @param {Array} pairs [{ from:{lng,lat}, to:{lng,lat}, ... }, ...]
 * @param {number} port OSRM 服务端口
 * @param {number} concurrency 并发数
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<Array>} [{ from, to, distance(米或 null) }, ...]
 */
function batchCompute(pairs, port, concurrency, onProgress) {
  return new Promise((resolve, reject) => {
    const total = pairs.length
    if (total === 0) return resolve([])
    const results = []
    let done = 0
    const queue = pairs.slice()
    const workers = Array(Math.min(concurrency, total))
      .fill(0)
      .map(
        () =>
          new Promise((res) => {
            const next = () => {
              if (queue.length === 0) return res()
              const pair = queue.shift()
              getDistance(pair, port).then((result) => {
                results.push(result)
                done++
                if (onProgress) onProgress(done, total)
                setImmediate(next)
              })
            }
            next()
          })
      )
    Promise.all(workers).then(() => resolve(results)).catch(reject)
  })
}

module.exports = {
  BIN_DIR,
  DEFAULT_PORT,
  ensureProcessed,
  startServer,
  stopServer,
  batchCompute,
  osrmPathOf,
  resolveProfilePath
}
