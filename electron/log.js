/**
 * 运行日志模块（electron/log.js）
 *
 * 两类日志统一写入 MySQL run_log 表，用 source 字段区分：
 *   - business：业务/运行日志（各 IPC 操作的成功与报错）
 *   - console ：Electron 主进程 / 渲染进程的 console 输出
 *
 * 特性：
 *   1. 串行写入队列 + 队列上限，避免高频 console 日志造成连接风暴 / 内存堆积；
 *   2. 写库失败静默（不影响业务），内部不使用 console（避免 hook 后递归）；
 *   3. 入库前对 API Key（key/ak/tk）与 Authorization 头打码；
 *   4. wrap(channel, handler) 统一包装 IPC handler：自动计时、记成功/失败/异常。
 */
const mysql = require('mysql2/promise')

// 保存原始 console（hook 之后内部所有输出都用它，避免递归）
const orig = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
}

// 运行期由 main.js 注入（惰性 getter，保证拿到的始终是最新的 activeDbConfig / currentUser）
let getConfig = null // () => activeDbConfig
let getCurrentUser = null // () => currentUser
let appVersion = ''

// 串行写入队列（一次只开一个连接写一条）
let queue = Promise.resolve()
let pendingCount = 0
const MAX_PENDING = 500 // 队列积压上限：超过则丢弃新日志（静默），防内存堆积

// 敏感字段：detail 里一律剔除（不落库）
const SENSITIVE_KEYS = ['password', 'oldpassword', 'newpassword', 'confirmpassword', 'api_key', 'apikey', 'key']

// ---------- 初始化 ----------
function init(opts = {}) {
  if (opts.getConfig) getConfig = opts.getConfig
  if (opts.getCurrentUser) getCurrentUser = opts.getCurrentUser
  if (opts.appVersion) appVersion = opts.appVersion
}

// ---------- 打码 ----------
function maskVal(v) {
  const s = String(v)
  if (s.length <= 4) return '***'
  return s.slice(0, 2) + '***' + s.slice(-2)
}

/**
 * 对日志文本中的敏感信息打码：
 *  - URL 查询参数 key= / ak= / tk= / apikey= / api_key=
 *  - Authorization: Bearer xxx
 */
function maskSensitive(text) {
  if (!text) return text
  let s = String(text)
  s = s.replace(/([?&](?:key|ak|tk|apikey|api_key)=)([^&\s"'<>]{4,})/gi, (_m, pre, val) => pre + maskVal(val))
  s = s.replace(/(Authorization[=:]\s*(?:Bearer\s+)?)([A-Za-z0-9._~+/=-]+)/gi, (_m, pre, val) => pre + maskVal(val))
  return s
}

// 递归剔除对象中的敏感键（不修改原对象）
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = Array.isArray(obj) ? [] : {}
  for (const k of Object.keys(obj)) {
    if (SENSITIVE_KEYS.includes(k.toLowerCase())) continue
    const v = obj[k]
    out[k] = v && typeof v === 'object' ? sanitize(v) : v
  }
  return out
}

function safeJson(v, maxLen = 2000) {
  try {
    const s = JSON.stringify(v)
    return s && s.length > maxLen ? s.slice(0, maxLen) + '…(截断)' : s
  } catch (e) {
    return String(v)
  }
}

// ---------- 写库（串行队列） ----------
async function insertRow(row) {
  if (!getConfig) return
  let conn
  try {
    conn = await mysql.createConnection(getConfig())
    await conn.execute(
      `INSERT INTO \`run_log\`
        (\`source\`, \`module\`, \`action\`, \`level\`, \`success\`, \`message\`, \`detail\`,
         \`project_id\`, \`batch_no\`, \`created_by\`, \`cost_ms\`, \`app_version\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.source, row.module, row.action, row.level, row.success,
        (row.message || '').slice(0, 500), row.detail || null,
        row.project_id || null, row.batch_no || null, row.created_by || '',
        row.cost_ms || null, appVersion || null
      ]
    )
  } catch (e) {
    // 日志写库失败静默：仅输出到原始 stdout（不经过 hook，避免递归）
    orig.error('[run_log] 写日志失败:', e && e.message ? e.message : e)
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

function enqueue(row) {
  if (pendingCount >= MAX_PENDING) return // 队列已满，静默丢弃
  pendingCount++
  queue = queue
    .then(() => insertRow(row))
    .catch(() => {})
    .finally(() => {
      pendingCount--
    })
}

/**
 * 业务日志入口
 * @param {object} entry { source, module, action, level, success, message, detail, project_id, batch_no, cost_ms }
 */
function write(entry) {
  const e = {
    source: 'business',
    module: '',
    action: '',
    level: 'info',
    success: 1,
    message: '',
    detail: null,
    project_id: null,
    batch_no: null,
    created_by: getCurrentUser ? (getCurrentUser() || {}).username || '' : '',
    cost_ms: null,
    ...entry
  }
  e.detail = e.detail ? maskSensitive(e.detail) : null
  enqueue(e)
}

// console 日志入口（source = console）
function consoleLog(level, text) {
  if (!text) return
  const masked = maskSensitive(text)
  enqueue({
    source: 'console',
    module: 'console:main',
    action: 'console',
    level,
    success: level === 'error' ? 0 : 1,
    message: masked.slice(0, 500),
    detail: masked.slice(0, 8000),
    created_by: ''
  })
}

// 渲染进程 console 上报（source = console，module = console:renderer）
function consoleFromRenderer(level, text) {
  if (!text) return
  const masked = maskSensitive(text)
  enqueue({
    source: 'console',
    module: 'console:renderer',
    action: 'console',
    level: ['log', 'info', 'warn', 'error'].includes(level) ? level : 'info',
    success: level === 'error' ? 0 : 1,
    message: masked.slice(0, 500),
    detail: masked.slice(0, 8000),
    created_by: ''
  })
}

// ---------- 主进程 console hook ----------
let hooked = false
function hookConsole() {
  if (hooked) return
  hooked = true
  const map = { log: 'info', info: 'info', warn: 'warn', error: 'error' }
  for (const name of Object.keys(map)) {
    if (typeof console[name] !== 'function') continue
    const origFn = console[name].bind(console)
    console[name] = (...args) => {
      origFn(...args) // 保留原始输出
      const text = args
        .map((a) => (a instanceof Error ? a.stack || a.message : typeof a === 'string' ? a : safeJson(a)))
        .join(' ')
      if (text) consoleLog(map[name], text)
    }
  }
  process.on('uncaughtException', (err) => {
    consoleLog('error', err && err.stack ? err.stack : String(err))
  })
  process.on('unhandledRejection', (reason) => {
    consoleLog('error', reason instanceof Error ? reason.stack || reason.message : safeJson(reason))
  })
}

// ---------- IPC handler 统一包装 ----------
// 从 'auth:login' 拆分 module='auth' / action='login'
function splitChannel(channel) {
  const i = channel.indexOf(':')
  return i > 0 ? [channel.slice(0, i), channel.slice(i + 1)] : [channel, channel]
}

/**
 * 包装 IPC handler：自动记录成功/失败、异常兜底、耗时、关联项目与批次
 * @param {string} channel 如 'project:create'
 * @param {(evt, payload) => Promise<object>} handler 原 handler
 */
function wrap(channel, handler) {
  return async (evt, payload) => {
    const t0 = Date.now()
    let res
    let thrown
    try {
      res = await handler(evt, payload)
    } catch (e) {
      thrown = e
      res = { success: false, message: (e && e.message) || '操作异常' }
    }
    const costMs = Date.now() - t0
    const [module, action] = splitChannel(channel)
    const p = payload || {}
    const success = !!(res && res.success)
    // detail：失败时带异常信息 + 参数摘要；成功时只记参数摘要（已剔除敏感字段）
    let detail = null
    if (thrown) {
      detail = '异常：' + (thrown.stack || thrown.message || String(thrown))
      if (p && typeof p === 'object') detail += '\n参数：' + safeJson(sanitize(p))
    } else if (p && typeof p === 'object' && Object.keys(p).length) {
      detail = safeJson(sanitize(p))
    }
    write({
      module,
      action,
      level: success ? 'success' : 'error',
      success: success ? 1 : 0,
      message: (res && res.message) || (success ? '操作成功' : '操作失败'),
      detail,
      project_id: p.project_id != null ? p.project_id : res && (res.project_id != null ? res.project_id : null),
      batch_no: res && (res.batch_no != null ? res.batch_no : res.batchNo != null ? res.batchNo : null),
      cost_ms: costMs
    })
    return res
  }
}

module.exports = {
  init,
  write,
  consoleLog,
  consoleFromRenderer,
  hookConsole,
  wrap,
  maskSensitive
}
