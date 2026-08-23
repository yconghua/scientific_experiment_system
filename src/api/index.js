// 对 preload 暴露的 window.api 做一层薄封装，便于组件调用。
// 若需要，可在此统一处理错误 / loading。

export function login(username, password) {
  return window.api.auth.login(username, password)
}

export function logout() {
  return window.api.auth.logout()
}

export function getCurrentUser() {
  return window.api.auth.getCurrentUser()
}

export function changePassword(username, oldPassword, newPassword) {
  return window.api.auth.changePassword(username, oldPassword, newPassword)
}

// 用户管理
export function listUsers() {
  return window.api.auth.listUsers()
}

export function createUser(payload) {
  return window.api.auth.createUser(payload)
}

export function updateUser(payload) {
  return window.api.auth.updateUser(payload)
}

export function deleteUser(id) {
  return window.api.auth.deleteUser(id)
}

// 系统管理（系统名称 / 版本号 / 数据库信息）
export function getSysInfo() {
  return window.api.sys.info()
}

export function getDbInfo() {
  return window.api.sys.dbInfo()
}

// 数据库连接管理（清单 / 切换 / 新增 / 删除）
export function getDbConnections() {
  return window.api.sys.dbConnections()
}

export function switchDb(id) {
  return window.api.sys.switchDb(id)
}

export function addDb(payload) {
  return window.api.sys.addDb(payload)
}

export function deleteDb(id) {
  return window.api.sys.deleteDb(id)
}

// 科研项目
export function createProject(payload) {
  return window.api.project.create(payload)
}

export function listProjects() {
  return window.api.project.list()
}

export function updateProject(payload) {
  return window.api.project.update(payload)
}

export function deleteProject(id) {
  return window.api.project.delete(id)
}
