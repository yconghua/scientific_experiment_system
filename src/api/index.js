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

// 地图数据导入记录（map_data_import：API 导入 / 路网导入 共用）
export function listMapData(projectId, importType) {
  return window.api.mapData.list({ projectId, importType })
}

export function createMapData(payload) {
  return window.api.mapData.create(payload)
}

export function updateMapData(payload) {
  return window.api.mapData.update(payload)
}

export function deleteMapData(id) {
  return window.api.mapData.delete(id)
}

// 选择路网文件（Electron 系统文件框 + 复制到 userData/projects/{项目编号}/）
export function selectRoadFile(projectNo) {
  return window.api.file.select(projectNo)
}

// 坐标数据（coord_data：起点/终点，txt/csv/excel 文件解析入库）
export function listCoordData(projectId, pointType) {
  return window.api.coord.list({ projectId, pointType })
}

export function createCoordData(payload) {
  return window.api.coord.create(payload)
}

export function updateCoordData(payload) {
  return window.api.coord.update(payload)
}

export function deleteCoordData(id) {
  return window.api.coord.delete(id)
}

// 清空某项目某类型的全部坐标数据
export function clearCoordData(projectId, pointType) {
  return window.api.coord.clear({ projectId, pointType })
}

// 选择坐标数据文件（只返回路径与文件名，不复制）
export function pickFile() {
  return window.api.file.pick()
}

// 路径计算（calc_result）
export function runCalc(payload) {
  return window.api.calc.run(payload)
}

// 地图 API 距离计算（API 导入分支）
export function runApiCalc(payload) {
  return window.api.calc.apiRun(payload)
}

export function listCalcResults(projectId) {
  return window.api.calc.list(projectId)
}

export function clearCalcResults(projectId) {
  return window.api.calc.clear(projectId)
}

// 订阅计算进度事件，返回取消订阅函数
export function onCalcProgress(cb) {
  return window.api.calc.onProgress(cb)
}

// 行政区域边界（主进程请求 DataV，绕过浏览器跨域）
export function getCityBoundary(cityCode) {
  return window.api.viz.boundary(cityCode)
}
