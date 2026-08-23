// 登录会话：基于 localStorage，固定 24 小时有效（纯前端，非服务端会话）
//
// - conghua_user      ：登录用户信息（JSON）
// - conghua_login_exp ：会话过期时间戳（ms）；独立于用户信息存储，
//   避免被 ProfileView 的写回逻辑覆盖。
//
// 想改有效期，只调 SESSION_MS 即可。

const USER_KEY = 'conghua_user'
const EXP_KEY = 'conghua_login_exp'

// 会话有效期：24 小时
export const SESSION_MS = 24 * 60 * 60 * 1000

// 登录成功时写入用户 + 过期时间
export function setSession(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  localStorage.setItem(EXP_KEY, String(Date.now() + SESSION_MS))
}

// 读取当前登录用户（无则返回 null）
export function getSessionUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

// 会话是否有效：存在过期时间且未超时
export function isSessionValid() {
  const exp = localStorage.getItem(EXP_KEY)
  if (!exp) return false
  return Date.now() < Number(exp)
}

// 清除登录态（用户 + 过期时间）
export function clearSession() {
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(EXP_KEY)
}
