// 渲染进程日志桥：把渲染层的 console 输出与未捕获异常上报到主进程（写 run_log，source=console）
// 在 src/main.js 顶部 import 一次即可。
// 仅 Electron 环境生效（window.api.log.console 存在时），浏览器环境自动跳过。
function installConsoleBridge() {
  if (typeof window === 'undefined') return
  const api = window.api && window.api.log
  if (!api || typeof api.console !== 'function') return

  const report = (level, text) => {
    if (!text) return
    // fire-and-forget：不阻塞渲染层，失败静默
    api.console(level, String(text).slice(0, 8000)).catch(() => {})
  }

  const fmt = (args) =>
    args
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message
        if (typeof a === 'string') return a
        try {
          return JSON.stringify(a)
        } catch (e) {
          return String(a)
        }
      })
      .join(' ')

  // 未捕获错误 / 未处理 Promise 拒绝
  window.addEventListener('error', (e) => {
    report('error', 'window.onerror: ' + (e && e.message ? e.message : String(e)))
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason
    report('error', 'unhandledrejection: ' + (r instanceof Error ? r.stack || r.message : fmt([r])))
  })

  // console 方法（log/info/warn/error）
  const map = { log: 'info', info: 'info', warn: 'warn', error: 'error' }
  for (const name of Object.keys(map)) {
    if (typeof console[name] !== 'function') continue
    const orig = console[name].bind(console)
    console[name] = (...args) => {
      orig(...args) // 保留原始输出
      const text = fmt(args)
      if (text) report(map[name], text)
    }
  }
}

installConsoleBridge()
