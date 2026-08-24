/**
 * 地图 API 距离计算模块（API 导入分支专用，与 OSRM 路网计算完全独立）
 *
 * 基于 map-distance.js 改造：
 *   - 平台响应解析器：高德/百度/腾讯（JSON）、天地图（XML，依赖 xml2js）
 *   - URL 参数模板：页面可配置（按平台带出默认模板），占位符 {lng1}{lat1}{lng2}{lat2}{key}{apiKey}
 *   - 完整 URL = 基础网址 + (?/&) + 参数模板，由 buildFullUrl 拼接
 *   - 并发池批量计算，每完成一对回调 onProgress(done, total)
 */
const { parseString } = require('xml2js')

// ============================================================
// 1. 平台响应解析器（照搬 map-distance.js；返回 { distance, duration, error }）
// ============================================================
const PARSERS = {
  高德地图: (rawData) => {
    const data = JSON.parse(rawData)
    if (data.status !== '1') {
      return { distance: null, duration: null, error: data.info }
    }
    const path = data.route && data.route.paths && data.route.paths[0]
    return {
      distance: path && path.distance ? parseFloat(path.distance) : null,
      duration: path && path.duration ? parseFloat(path.duration) : null
    }
  },
  amap: (rawData) => PARSERS['高德地图'](rawData),

  百度地图: (rawData) => {
    const data = JSON.parse(rawData)
    if (data.status !== 0) {
      return { distance: null, duration: null, error: data.message }
    }
    const route = data.result && data.result.routes && data.result.routes[0]
    return {
      distance: (route && route.distance) || null,
      duration: (route && route.duration) || null
    }
  },
  baidu: (rawData) => PARSERS['百度地图'](rawData),

  腾讯地图: (rawData) => {
    const data = JSON.parse(rawData)
    if (data.status !== 0) {
      return { distance: null, duration: null, error: data.message }
    }
    const route = data.result && data.result.routes && data.result.routes[0]
    return {
      distance: (route && route.distance) || null,
      duration: (route && route.duration) || null
    }
  },
  tencent: (rawData) => PARSERS['腾讯地图'](rawData),

  天地图: (rawData) =>
    new Promise((resolve) => {
      parseString(rawData, { explicitArray: false }, (err, result) => {
        if (err) {
          resolve({ distance: null, duration: null, error: err.message })
          return
        }
        const route = result && result.result && result.result.routes && result.result.routes.item
        resolve({
          distance: route && route.streetDistance ? parseFloat(route.streetDistance) : null,
          duration: route && route.duration ? parseFloat(route.duration) : null
        })
      })
    }),
  tianditu: (rawData) => PARSERS['天地图'](rawData)
}

// ============================================================
// 2. URL 模板处理
// ============================================================

// 校验参数模板包含必要的坐标占位符
function validateTemplate(paramTemplate) {
  const tpl = String(paramTemplate || '').trim()
  const need = ['{lng1}', '{lat1}', '{lng2}', '{lat2}']
  const missing = need.filter((k) => !tpl.includes(k))
  if (missing.length > 0) {
    throw new Error('URL 参数模板缺少占位符：' + missing.join(', ') + '（如 origin={lng1},{lat1}&destination={lng2},{lat2}&key={key}）')
  }
  return tpl
}

// 拼接完整 URL：基础网址 + 参数模板（模板带 ? 直接用；基础网址已含 ? 用 & 连接）
function buildFullUrl(baseUrl, paramTemplate) {
  const base = String(baseUrl || '').trim()
  const tpl = validateTemplate(paramTemplate)
  if (!base) throw new Error('API 网址为空')
  if (tpl.startsWith('?')) return base + tpl
  if (base.includes('?')) return base + '&' + tpl
  return base + '?' + tpl
}

// 替换占位符：{lng1}{lat1}{lng2}{lat2}{key}{apiKey}
function fillUrlTemplate(template, pair, apiKey) {
  const { from, to } = pair
  return template
    .replace(/\{lng1\}/g, from.lng)
    .replace(/\{lat1\}/g, from.lat)
    .replace(/\{lng2\}/g, to.lng)
    .replace(/\{lat2\}/g, to.lat)
    .replace(/\{key\}/g, apiKey)
    .replace(/\{apiKey\}/g, apiKey)
}

// ============================================================
// 3. 单次请求 + 并发批量
// ============================================================

/**
 * 单条距离计算
 * @returns {Promise<Object>} { from, to, distance(米), duration(秒), error }
 */
async function computeDistance(pair, fullTemplate, apiKey, providerName, timeoutMs) {
  const parser = PARSERS[providerName]
  if (!parser) {
    return { ...pair, distance: null, duration: null, error: '未知平台：' + providerName }
  }
  const finalUrl = fillUrlTemplate(fullTemplate, pair, apiKey)
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), timeoutMs)
    const resp = await fetch(finalUrl, { signal: controller.signal })
    clearTimeout(t)
    if (!resp.ok) {
      return { ...pair, distance: null, duration: null, error: 'HTTP ' + resp.status + ' ' + resp.statusText }
    }
    const rawData = await resp.text()
    const parsed = await parser(rawData)
    return {
      ...pair,
      distance: parsed.distance,
      duration: parsed.duration,
      error: parsed.error || null
    }
  } catch (err) {
    return { ...pair, distance: null, duration: null, error: err.message }
  }
}

/**
 * 并发批量计算（worker 池）
 * @param {Array} pairs [{ from:{lng,lat}, to:{lng,lat}, ... }, ...]
 * @param {string} fullTemplate 完整 URL 模板（含占位符）
 * @param {string} apiKey
 * @param {string} providerName 平台名
 * @param {number} concurrency 并发数
 * @param {number} timeoutMs 单请求超时（毫秒）
 * @param {(done:number,total:number)=>void} onProgress
 * @returns {Promise<Array>}
 */
function batchCompute(pairs, fullTemplate, apiKey, providerName, concurrency, timeoutMs, onProgress) {
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
              computeDistance(pair, fullTemplate, apiKey, providerName, timeoutMs).then((result) => {
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
  PARSERS,
  validateTemplate,
  buildFullUrl,
  fillUrlTemplate,
  computeDistance,
  batchCompute
}
