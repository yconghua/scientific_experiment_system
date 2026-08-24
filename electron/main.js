/**
 * Electron 主进程（兼后端）
 *
 * 职责：
 *   1. 创建固定尺寸的登录/主窗口；
 *   2. 监听渲染层发来的登录 / 退出 / 取当前用户等 IPC；
 *   3. 直接连接 MySQL，用 bcrypt 校验密码（不存明文）。
 *
 * 渲染层（Vue3）通过 preload 暴露的 window.api 与主进程通信，
 * 页面脚本拿不到 Node 能力（nodeIntegration:false + contextIsolation:true）。
 */
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
// 读取 package.json，供「系统管理」展示系统名称 / 版本号
const appPkg = require('../package.json')
// 默认连接清单（阿里云预设）抽到独立文件，便于不改 main.js 主体即可调整预设
const { defaultConnections } = require('./db/database_default_connections')
// 数据库初始化公共模块（建库 + user 表 + 默认管理员），供「添加新数据库」自动初始化
const { initDatabase, ensureProjectTable, ensureMapDataImportTable, ensureCoordDataTable, ensureCalcResultTable } = require('./db/create_new_database')
// 解析 excel（.xls/.xlsx）坐标数据文件用
const XLSX = require('xlsx')
// OSRM 预处理与路由计算模块（node-osrm 官方绑定，进程内运行）
const calc = require('./osrm/calc')
// 地图 API 距离计算模块（API 导入分支，独立于 OSRM）
const apiCalc = require('./mapapi/calc')

const isDev = !app.isPackaged
const DEV_URL = 'http://localhost:5173'

// 解析窗口 / 程序图标：复用 build/icon.ico（缺失时回退到系统默认）
function resolveIcon() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico')
  return fs.existsSync(iconPath) ? iconPath : undefined
}

// 数据库连接管理：支持在「阿里云 / 用户新增」多套连接之间切换。
// 连接清单与「当前生效」指针持久化到用户数据目录（不在仓库内，天然不进版本库）。
function dbConnsPath() {
  try {
    return path.join(app.getPath('userData'), 'db-connections.json')
  } catch (e) {
    return path.join(__dirname, '..', 'db-connections.json')
  }
}

let connections = loadConnections()
let activeDbConfig = buildConfig(getActiveConn())

function loadConnections() {
  try {
    const p = dbConnsPath()
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'))
      if (data && Array.isArray(data.list) && data.list.length) return data
    }
  } catch (e) {
    console.error('[connections] 读取失败，使用默认:', e)
  }
  const def = defaultConnections()
  saveConnections(def)
  return def
}

function saveConnections(data) {
  try {
    fs.writeFileSync(dbConnsPath(), JSON.stringify(data || connections, null, 2))
  } catch (e) {
    console.error('[connections] 写入失败:', e)
  }
}

function getActiveConn() {
  const c = connections.list.find((x) => x.id === connections.active)
  return c || connections.list[0]
}

function buildConfig(conn) {
  return {
    host: conn.host,
    port: Number(conn.port) || 3306,
    user: conn.user,
    password: conn.password,
    database: conn.database,
    dateStrings: true
  }
}

// 测试某连接是否可连通
async function testConnection(cfg) {
  let conn
  try {
    conn = await mysql.createConnection(cfg)
    await conn.execute('SELECT 1')
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : '连接失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

// 切换当前生效连接（先探活，成功才生效并持久化）
async function switchConnection(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  const cfg = buildConfig(target)
  const test = await testConnection(cfg)
  if (!test.ok) return { success: false, message: '连接失败：' + test.message }
  connections.active = id
  activeDbConfig = cfg
  saveConnections()
  return { success: true, message: '已切换到「' + target.name + '」' }
}

// 连接 MySQL 服务后自动建库 + 建表 + 默认管理员，全部成功才写入清单
async function addConnection(payload) {
  const { name, host, port, user, password, database } = payload || {}
  if (!name || !host || !user || !database) {
    return { success: false, message: '请填写名称、主机、账号与数据库名' }
  }
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    return { success: false, message: '数据库名仅支持字母、数字、下划线' }
  }
  const id = 'user-' + Date.now()
  const conn = { id, name, host, port: Number(port) || 3306, user, password: password || '', database }
  // 自动初始化：库不存在会先建库，再建 user 表、插入默认管理员 admin/admin123
  try {
    await initDatabase(conn)
  } catch (err) {
    return {
      success: false,
      message: '初始化失败（请确认账号可连接且有建库/建表权限）：' + (err && err.message ? err.message : err)
    }
  }
  connections.list.push(conn)
  saveConnections()
  return { success: true, id, message: '已添加连接「' + name + '」，并完成初始化' }
}

// 删除连接：阿里云为默认数据库始终禁止删除；其余连接当前在用需先切换；至少保留一个（后端兜底）
async function deleteConnection(id) {
  const target = connections.list.find((x) => x.id === id)
  if (!target) return { success: false, message: '未找到该连接' }
  // 阿里云为默认数据库，任何情况都禁止删除
  if (id === 'aliyun') {
    return { success: false, message: '该数据库为默认数据库，禁止删除' }
  }
  if (connections.list.length <= 1) {
    return { success: false, message: '至少保留一个连接，无法删除' }
  }
  if (id === connections.active) {
    return { success: false, message: '请先切换到其他连接再删除' }
  }
  connections.list = connections.list.filter((x) => x.id !== id)
  saveConnections()
  return { success: true, message: '已删除连接「' + target.name + '」' }
}

/** 进程内的当前登录用户（未落库，仅随进程存活） */
let currentUser = null

// 角色常量与权限判定（两级：admin / user）
const ROLE_ADMIN = 'admin'
// 管理员（可进用户管理）
function isAdmin() {
  return !!currentUser && currentUser.role === ROLE_ADMIN
}
/** 创建主窗口：固定 1100×750，不可缩放、不可最大化、居中 */
function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    resizable: false, // 禁止拖拽缩放边框
    maximizable: false, // 禁止最大化
    center: true, // 启动时居中
    show: false,
    icon: resolveIcon(),
    title: '科研实验系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (isDev) {
    win.loadURL(`${DEV_URL}/#/login`)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/login' })
  }

  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    // 仅单窗口应用，关闭即清空引用
  })
}

// -------------------- IPC：登录校验 --------------------
ipcMain.handle('auth:login', async (_evt, { username, password }) => {
  if (!username || !password) {
    return { success: false, message: '请输入账号和密码' }
  }

  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      'SELECT id, username, password, role, created_at FROM `user` WHERE username = ?',
      [username]
    )

    if (rows.length === 0) {
      return { success: false, message: '用户名或密码错误，请重试' }
    }

    const user = rows[0]
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return { success: false, message: '用户名或密码错误，请重试' }
    }

    currentUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at
    }
    return { success: true, message: '登录成功', user: currentUser }
  } catch (err) {
    console.error('[auth:login] 数据库异常:', err)
    return { success: false, message: '数据库连接失败，请检查数据库服务' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：退出登录 --------------------
ipcMain.handle('auth:logout', async () => {
  currentUser = null
  return { success: true }
})

// -------------------- IPC：取当前登录用户 --------------------
ipcMain.handle('auth:get-current-user', async () => {
  return currentUser
})

// -------------------- IPC：修改密码 --------------------
ipcMain.handle('auth:change-password', async (_evt, { username, oldPassword, newPassword }) => {
  if (!oldPassword || !newPassword) {
    return { success: false, message: '请填写完整的密码信息' }
  }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute('SELECT password FROM `user` WHERE username = ?', [username])
    if (rows.length === 0) {
      return { success: false, message: '用户不存在' }
    }
    const ok = await bcrypt.compare(oldPassword, rows[0].password)
    if (!ok) {
      return { success: false, message: '原密码不正确' }
    }
    const hash = await bcrypt.hash(newPassword, 10)
    await conn.execute('UPDATE `user` SET password = ? WHERE username = ?', [hash, username])
    return { success: true, message: '密码已修改' }
  } catch (err) {
    console.error('[auth:change-password] 数据库异常:', err)
    return { success: false, message: '修改失败，请稍后重试' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- 工具：生成 6 位数字随机密码 --------------------
function genRandomPassword() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// -------------------- IPC：用户列表 --------------------
ipcMain.handle('auth:list-users', async () => {
  if (!isAdmin()) {
    return { success: false, message: '无权限：仅管理员可查看用户列表' }
  }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      'SELECT id, username, role, created_at FROM `user` ORDER BY id ASC'
    )
    return { success: true, users: rows }
  } catch (err) {
    console.error('[auth:list-users] 数据库异常:', err)
    return { success: false, message: '读取用户列表失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：新增用户（随机 6 位密码） --------------------
ipcMain.handle('auth:create-user', async (_evt, { username, role }) => {
  if (!isAdmin()) return { success: false, message: '无权限：仅管理员可创建用户' }
  if (!username || !username.trim()) return { success: false, message: '账号不能为空' }
  // 角色：admin 管理员 / user 普通用户
  const roleVal = role === 'admin' ? 'admin' : 'user'
  const plain = genRandomPassword()
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [exist] = await conn.execute('SELECT id FROM `user` WHERE username = ?', [username.trim()])
    if (exist.length) return { success: false, message: '该账号已存在' }
    const hash = await bcrypt.hash(plain, 10)
    await conn.execute(
      'INSERT INTO `user` (`username`, `password`, `role`) VALUES (?, ?, ?)',
      [username.trim(), hash, roleVal]
    )
    return { success: true, message: '用户创建成功', plainPassword: plain }
  } catch (err) {
    console.error('[auth:create-user] 数据库异常:', err)
    return { success: false, message: '创建失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：编辑用户（可重置密码） --------------------
ipcMain.handle('auth:update-user', async (_evt, { id, role, resetPassword }) => {
  if (!isAdmin()) return { success: false, message: '无权限：仅管理员可管理用户' }
  if (!id) return { success: false, message: '缺少用户标识' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute('SELECT id FROM `user` WHERE id = ?', [id])
    if (rows.length === 0) return { success: false, message: '用户不存在' }
    const sets = []
    const params = []
    if (role) {
      sets.push('role = ?')
      params.push(role === ROLE_ADMIN ? ROLE_ADMIN : 'user')
    }
    let plainPassword = null
    if (resetPassword) {
      plainPassword = genRandomPassword()
      const hash = await bcrypt.hash(plainPassword, 10)
      sets.push('password = ?')
      params.push(hash)
    }
    if (sets.length) {
      params.push(id)
      await conn.execute(`UPDATE \`user\` SET ${sets.join(', ')} WHERE id = ?`, params)
    }
    return { success: true, message: '保存成功', plainPassword }
  } catch (err) {
    console.error('[auth:update-user] 数据库异常:', err)
    return { success: false, message: '更新失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：删除用户（硬删除，禁止删自己） --------------------
ipcMain.handle('auth:delete-user', async (_evt, { id }) => {
  if (!isAdmin()) return { success: false, message: '无权限：仅管理员可删除用户' }
  if (!id) return { success: false, message: '缺少用户标识' }
  if (currentUser && currentUser.id === id) {
    return { success: false, message: '不能删除当前登录的账号' }
  }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute('SELECT id FROM `user` WHERE id = ?', [id])
    if (rows.length === 0) return { success: false, message: '用户不存在' }
    await conn.execute('DELETE FROM `user` WHERE id = ?', [id])
    return { success: true, message: '已删除' }
  } catch (err) {
    console.error('[auth:delete-user] 数据库异常:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：新建项目 --------------------
// 项目编号取「表内最大编号 +1」：删除是软删除（is_deleted=1，行保留），
// 已删除行仍占着编号，因此编号严格递增、删除后不复用，无需额外计数器表。
// created_by 由服务端从 currentUser 注入，前端不可伪造。
ipcMain.handle('project:create', async (_evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const name = (p.name || '').trim()
  if (!name) return { success: false, message: '项目名称不能为空' }
  if (!p.province_code || !p.city_code || !p.district_code) {
    return { success: false, message: '请完整选择项目地点（省 / 市 / 区或县）' }
  }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    // 取全表（含软删除行）最大编号 +1：被删的编号仍占号，保证不复用
    const [rows] = await conn.execute(
      'SELECT MAX(CAST(SUBSTRING(project_no, 3) AS UNSIGNED)) AS max_no FROM `project`'
    )
    const maxNo = rows[0] && rows[0].max_no ? Number(rows[0].max_no) : 0
    const projectNo = 'XM' + (maxNo + 1)
    await conn.execute(
      `INSERT INTO \`project\`
        (\`project_no\`, \`name\`, \`province_code\`, \`province_name\`, \`city_code\`, \`city_name\`,
         \`district_code\`, \`district_name\`, \`remark\`, \`created_by\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectNo,
        name,
        p.province_code,
        p.province_name || '',
        p.city_code,
        p.city_name || '',
        p.district_code,
        p.district_name || '',
        (p.remark || '').trim() || null,
        currentUser.username
      ]
    )
    return { success: true, message: '项目创建成功', projectNo }
  } catch (err) {
    console.error('[project:create] 数据库异常:', err)
    return { success: false, message: '创建失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：项目列表（仅当前登录用户创建的项目） --------------------
ipcMain.handle('project:list', async () => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      `SELECT id, project_no, name,
              province_code, province_name, city_code, city_name,
              district_code, district_name,
              remark, created_by, created_at, updated_at
         FROM \`project\`
        WHERE is_deleted = 0 AND created_by = ?
        ORDER BY id DESC`,
      [currentUser.username]
    )
    return { success: true, projects: rows }
  } catch (err) {
    console.error('[project:list] 数据库异常:', err)
    return { success: false, message: '读取项目列表失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：更新项目 --------------------
ipcMain.handle('project:update', async (_evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const id = p.id
  if (!id) return { success: false, message: '缺少项目 ID' }
  const name = (p.name || '').trim()
  if (!name) return { success: false, message: '项目名称不能为空' }
  if (!p.province_code || !p.city_code || !p.district_code) {
    return { success: false, message: '请完整选择项目地点（省 / 市 / 区或县）' }
  }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute('SELECT id FROM `project` WHERE id = ? AND is_deleted = 0', [id])
    if (rows.length === 0) return { success: false, message: '项目不存在或已删除' }
    await conn.execute(
      `UPDATE \`project\`
          SET \`name\` = ?, \`province_code\` = ?, \`province_name\` = ?, \`city_code\` = ?,
              \`city_name\` = ?, \`district_code\` = ?, \`district_name\` = ?, \`remark\` = ?
        WHERE id = ? AND is_deleted = 0`,
      [
        name,
        p.province_code,
        p.province_name || '',
        p.city_code,
        p.city_name || '',
        p.district_code,
        p.district_name || '',
        p.remark || '',
        id
      ]
    )
    return { success: true, message: '项目已更新' }
  } catch (err) {
    console.error('[project:update] 数据库异常:', err)
    return { success: false, message: '更新失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：删除项目（软删除，保留行占号，保证编号不复用） --------------------
ipcMain.handle('project:delete', async (_evt, { id }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!id) return { success: false, message: '缺少项目 ID' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute('SELECT id FROM `project` WHERE id = ? AND is_deleted = 0', [id])
    if (rows.length === 0) return { success: false, message: '项目不存在或已删除' }
    await conn.execute('UPDATE `project` SET `is_deleted` = 1 WHERE id = ?', [id])
    return { success: true, message: '项目已删除' }
  } catch (err) {
    console.error('[project:delete] 数据库异常:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：地图数据导入记录（map_data_import 表） --------------------
// 权限：仅操作「当前用户创建的项目 / 记录」（created_by 服务端注入，前端不可伪造）。
// 一个项目最多一条导入记录（API 或路网二选一）：应用层校验 + 数据库唯一索引 uk_project_one 双重兜底。
// 编辑时 import_type 不可修改；删除为物理删除，删掉后该项目可重新导入。

// 列表：查某项目某类型的导入记录（未删除 + 当前用户）
ipcMain.handle('mapData:list', async (_evt, { projectId, importType }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!projectId || !importType) return { success: false, message: '缺少查询条件' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      `SELECT id, project_id, project_no, import_type,
              api_platform, api_key, api_url, road_file_name, road_file_path, road_file_copy_path,
              created_by, created_at, updated_at
         FROM \`map_data_import\`
        WHERE is_deleted = 0 AND project_id = ? AND import_type = ? AND created_by = ?
        ORDER BY id DESC`,
      [projectId, importType, currentUser.username]
    )
    return { success: true, records: rows }
  } catch (err) {
    console.error('[mapData:list] 数据库异常:', err)
    return { success: false, message: '读取导入记录失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 新增导入记录
ipcMain.handle('mapData:create', async (_evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const projectId = p.project_id
  const importType = p.import_type
  if (!projectId || !importType) return { success: false, message: '缺少项目或导入方式' }
  if (importType !== 'api' && importType !== 'road') return { success: false, message: '导入方式不合法' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    // 1) 项目必须存在、未删除、且属于当前用户
    const [projRows] = await conn.execute(
      'SELECT id, project_no FROM `project` WHERE id = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, currentUser.username]
    )
    if (projRows.length === 0) return { success: false, message: '项目不存在或无权操作' }
    // 2) 每个项目最多一条导入记录：已有任意类型记录则拒绝（数据库唯一索引兜底）
    const [exRows] = await conn.execute(
      'SELECT id, import_type FROM `map_data_import` WHERE project_id = ? AND is_deleted = 0',
      [projectId]
    )
    if (exRows.length > 0) {
      const existed = exRows[0].import_type
      return {
        success: false,
        message:
          existed === importType
            ? (importType === 'api' ? '该项目已有 API 导入记录，不能重复添加' : '该项目已有路网导入记录，不能重复添加')
            : (importType === 'api' ? '该项目已使用路网导入，不能同时使用 API 导入' : '该项目已使用 API 导入，不能同时使用路网导入')
      }
    }
    // 3) 按类型校验必填
    let apiPlatform = '', apiKey = '', apiUrl = '', roadFileName = '', roadFilePath = '', roadFileCopyPath = ''
    if (importType === 'api') {
      apiPlatform = (p.api_platform || '').trim()
      apiKey = (p.api_key || '').trim()
      apiUrl = (p.api_url || '').trim()
      if (!apiPlatform) return { success: false, message: '请填写 API 提供平台' }
      if (!apiKey) return { success: false, message: '请填写 API Key' }
      if (apiKey.length > 100) return { success: false, message: 'API Key 长度不能超过 100' }
      if (!apiUrl) return { success: false, message: '请填写 API 网址' }
      if (apiUrl.length > 500) return { success: false, message: 'API 网址长度不能超过 500' }
    } else {
      roadFileName = (p.road_file_name || '').trim()
      roadFilePath = (p.road_file_path || '').trim()
      roadFileCopyPath = (p.road_file_copy_path || '').trim()
      if (!roadFileName || !roadFilePath) return { success: false, message: '请选择路网文件' }
    }
    await conn.execute(
      `INSERT INTO \`map_data_import\`
        (\`project_id\`, \`project_no\`, \`import_type\`, \`api_platform\`, \`api_key\`, \`api_url\`,
         \`road_file_name\`, \`road_file_path\`, \`road_file_copy_path\`, \`created_by\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        projRows[0].project_no,
        importType,
        apiPlatform || null,
        apiKey || null,
        apiUrl || null,
        roadFileName || null,
        roadFilePath || null,
        roadFileCopyPath || null,
        currentUser.username
      ]
    )
    return { success: true, message: '导入记录创建成功' }
  } catch (err) {
    console.error('[mapData:create] 数据库异常:', err)
    return { success: false, message: '创建失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 更新导入记录（import_type 不可修改，只更新原类型下的字段）
ipcMain.handle('mapData:update', async (_evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const id = p.id
  if (!id) return { success: false, message: '缺少记录 ID' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      'SELECT id, import_type FROM `map_data_import` WHERE id = ? AND is_deleted = 0 AND created_by = ?',
      [id, currentUser.username]
    )
    if (rows.length === 0) return { success: false, message: '记录不存在或已删除' }
    const importType = rows[0].import_type
    if (importType === 'api') {
      const apiPlatform = (p.api_platform || '').trim()
      const apiKey = (p.api_key || '').trim()
      const apiUrl = (p.api_url || '').trim()
      if (!apiPlatform) return { success: false, message: '请填写 API 提供平台' }
      if (!apiKey) return { success: false, message: '请填写 API Key' }
      if (apiKey.length > 100) return { success: false, message: 'API Key 长度不能超过 100' }
      if (!apiUrl) return { success: false, message: '请填写 API 网址' }
      if (apiUrl.length > 500) return { success: false, message: 'API 网址长度不能超过 500' }
      await conn.execute(
        'UPDATE `map_data_import` SET `api_platform` = ?, `api_key` = ?, `api_url` = ? WHERE id = ?',
        [apiPlatform, apiKey, apiUrl, id]
      )
    } else {
      const roadFileName = (p.road_file_name || '').trim()
      const roadFilePath = (p.road_file_path || '').trim()
      const roadFileCopyPath = (p.road_file_copy_path || '').trim()
      if (!roadFileName || !roadFilePath) return { success: false, message: '请选择路网文件' }
      await conn.execute(
        'UPDATE `map_data_import` SET `road_file_name` = ?, `road_file_path` = ?, `road_file_copy_path` = ? WHERE id = ?',
        [roadFileName, roadFilePath, roadFileCopyPath, id]
      )
    }
    return { success: true, message: '导入记录已更新' }
  } catch (err) {
    console.error('[mapData:update] 数据库异常:', err)
    return { success: false, message: '更新失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 删除导入记录（物理删除：每个项目最多一条记录，删掉后该项目可再导入）
ipcMain.handle('mapData:delete', async (_evt, { id }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!id) return { success: false, message: '缺少记录 ID' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      'SELECT id FROM `map_data_import` WHERE id = ? AND is_deleted = 0 AND created_by = ?',
      [id, currentUser.username]
    )
    if (rows.length === 0) return { success: false, message: '记录不存在或已删除' }
    await conn.execute('DELETE FROM `map_data_import` WHERE id = ?', [id])
    return { success: true, message: '导入记录已删除' }
  } catch (err) {
    console.error('[mapData:delete] 数据库异常:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：选择路网文件（弹出系统文件框 + 复制到项目目录） --------------------
// 选中后把文件复制到 userData/projects/{项目编号}/ 下；重名统一改名「原名_YYYYMMDD_HHMM.ext」，
// 仍冲突则追加序号，不覆盖原文件。复制路径入库（前端不展示）。
function pad2(n) {
  return String(n).padStart(2, '0')
}
function fileStamp(now) {
  const d = now || new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}`
}
ipcMain.handle('dialog:select-file', async (_evt, { projectNo }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!projectNo) return { success: false, message: '请先选择项目' }
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(win, {
    title: '选择路网文件',
    properties: ['openFile'],
    filters: [
      { name: 'OSM 路网文件', extensions: ['osm', 'pbf'] }
    ]
  })
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false, canceled: true, message: '已取消选择' }
  }
  const srcPath = result.filePaths[0]
  // 兜底校验：只允许 .osm / .osm.pbf（.osm.pbf 以 .pbf 结尾）
  if (!/\.(osm\.pbf|osm)$/i.test(srcPath)) {
    return { success: false, canceled: false, message: '只能选择 .osm 或 .osm.pbf 路网文件' }
  }
  const srcName = path.basename(srcPath)
  const ext = path.extname(srcName)
  const base = path.basename(srcName, ext)
  const destDir = path.join(app.getPath('userData'), 'projects', projectNo)
  try {
    await fs.promises.mkdir(destDir, { recursive: true })
    // 重名统一改名：时间戳前缀 + 原文件名（YYYYMMDD_HHMM_原名.ext）；仍存在则追加序号
    let destName = `${fileStamp()}_${base}${ext}`
    let destPath = path.join(destDir, destName)
    let n = 1
    while (fs.existsSync(destPath)) {
      destName = `${fileStamp()}_${base}_${n}${ext}`
      destPath = path.join(destDir, destName)
      n++
    }
    await fs.promises.copyFile(srcPath, destPath)
    return { success: true, canceled: false, path: srcPath, name: srcName, copyPath: destPath }
  } catch (err) {
    console.error('[dialog:select-file] 文件复制失败:', err)
    return { success: false, canceled: false, message: '文件复制失败：' + (err && err.message ? err.message : '请稍后重试') }
  }
})

// -------------------- IPC：坐标数据（coord_data 表：起点 / 终点） --------------------
// 数据来源：txt / csv / excel 文件，提交时由主进程读取并解析成行，逐条入库。
// 表头约定：No(序号) / Name(点名称) / Longitude(经度) / Latitude(纬度)，大小写不敏感并兼容变体与中文。

// 表头识别：返回 { noIdx, nameIdx, lngIdx, latIdx }；缺经度/纬度列则返回 null
function detectCoordHeader(headerCells) {
  const norm = (s) => String(s == null ? '' : s).trim().toLowerCase()
  let noIdx = -1
  let nameIdx = -1
  let lngIdx = -1
  let latIdx = -1
  headerCells.forEach((cell, i) => {
    const h = norm(cell)
    if (h === 'no' || h === 'num' || h === 'number' || h === 'id' || h === '序号') noIdx = i
    if (h === 'name' || h === 'pointname' || h === '名称' || h === '点名称') nameIdx = i
    if (h === 'longitude' || h === 'lng' || h === 'lon' || h === '经度') lngIdx = i
    if (h === 'latitude' || h === 'lat' || h === '纬度') latIdx = i
  })
  if (lngIdx < 0 || latIdx < 0) return null
  return { noIdx, nameIdx, lngIdx, latIdx }
}

// 解析一行单元格为坐标记录；ok=false 表示该行非法（坐标缺失/越界）
function parseCoordRow(cells, idx) {
  const num = (v) => {
    if (v == null || String(v).trim() === '') return null
    const n = Number(String(v).trim())
    return Number.isFinite(n) ? n : null
  }
  const lng = num(cells[idx.lngIdx])
  const lat = num(cells[idx.latIdx])
  if (lng === null || lat === null || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return { ok: false }
  }
  let sortNo = null
  if (idx.noIdx >= 0) {
    const n = num(cells[idx.noIdx])
    if (n !== null) sortNo = Math.floor(n)
  }
  const name = idx.nameIdx >= 0 ? String(cells[idx.nameIdx] == null ? '' : cells[idx.nameIdx]).trim().slice(0, 100) : ''
  return { ok: true, sortNo, name, lng, lat }
}

// 文本（txt/csv）解析为二维矩阵：去掉 BOM/空行，第一行作为表头；分隔符按表头是否含逗号判断
function textToMatrix(content) {
  const text = String(content || '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const sep = lines[0].includes(',') ? ',' : '\t'
  return lines.map((l) => l.split(sep).map((c) => c.trim()))
}

// excel 解析为二维矩阵（取第一个工作表）
function excelToMatrix(filePath) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

// 列表
ipcMain.handle('coord:list', async (_evt, { projectId, pointType }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!projectId || !pointType) return { success: false, message: '缺少查询条件' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      `SELECT id, project_id, project_no, point_type, sort_no, point_name,
              longitude, latitude, created_by, created_at, updated_at
         FROM \`coord_data\`
        WHERE project_id = ? AND point_type = ? AND created_by = ?
        ORDER BY id DESC`,
      [projectId, pointType, currentUser.username]
    )
    return { success: true, records: rows }
  } catch (err) {
    console.error('[coord:list] 数据库异常:', err)
    return { success: false, message: '读取坐标数据失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 导入：读取文件 → 解析 → 事务批量入库
ipcMain.handle('coord:create', async (_evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const projectId = p.project_id
  const pointType = p.point_type
  const filePath = (p.file_path || '').trim()
  if (!projectId || !pointType) return { success: false, message: '缺少项目或数据类型' }
  if (pointType !== 'start' && pointType !== 'end') return { success: false, message: '数据类型不合法' }
  if (!filePath) return { success: false, message: '请先选择文件' }
  const ext = path.extname(filePath).toLowerCase()
  if (!['.txt', '.csv', '.xls', '.xlsx'].includes(ext)) {
    return { success: false, message: '仅支持 txt / csv / excel 三种文件类型' }
  }
  if (!fs.existsSync(filePath)) return { success: false, message: '文件不存在或已被移动，请重新选择' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    // 项目必须存在、未删除、且属于当前用户
    const [projRows] = await conn.execute(
      'SELECT id, project_no FROM `project` WHERE id = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, currentUser.username]
    )
    if (projRows.length === 0) return { success: false, message: '项目不存在或无权操作' }

    // 读取并解析成矩阵（第一行为表头）
    let matrix
    if (ext === '.xls' || ext === '.xlsx') {
      matrix = excelToMatrix(filePath)
    } else {
      matrix = textToMatrix(fs.readFileSync(filePath, 'utf8'))
    }
    if (matrix.length < 2) return { success: false, message: '文件没有数据行' }

    const idx = detectCoordHeader(matrix[0])
    if (!idx) {
      return { success: false, message: '文件表头格式不正确，请参考示例文件（No,Name,Longitude,Latitude）' }
    }

    // 逐行解析校验
    const rowsToInsert = []
    let skipped = 0
    for (let i = 1; i < matrix.length; i++) {
      const r = parseCoordRow(matrix[i], idx)
      if (r.ok) rowsToInsert.push(r)
      else skipped++
    }
    if (rowsToInsert.length === 0) {
      return { success: false, message: '没有解析出有效数据（跳过 ' + skipped + ' 行非法数据）' }
    }

    await conn.beginTransaction()
    for (const r of rowsToInsert) {
      await conn.execute(
        `INSERT INTO \`coord_data\`
          (\`project_id\`, \`project_no\`, \`point_type\`, \`sort_no\`, \`point_name\`, \`longitude\`, \`latitude\`, \`created_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [projectId, projRows[0].project_no, pointType, r.sortNo, r.name || null, r.lng, r.lat, currentUser.username]
      )
    }
    await conn.commit()
    return {
      success: true,
      message: '导入成功：新增 ' + rowsToInsert.length + ' 条' + (skipped ? '，跳过 ' + skipped + ' 行非法数据' : ''),
      inserted: rowsToInsert.length,
      skipped
    }
  } catch (err) {
    console.error('[coord:create] 数据库异常:', err)
    if (conn) await conn.rollback().catch(() => {})
    return { success: false, message: '导入失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 更新单行
ipcMain.handle('coord:update', async (_evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const id = p.id
  if (!id) return { success: false, message: '缺少记录 ID' }
  const lng = Number(p.longitude)
  const lat = Number(p.latitude)
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return { success: false, message: '经度不合法（范围 -180~180）' }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return { success: false, message: '纬度不合法（范围 -90~90）' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      'SELECT id FROM `coord_data` WHERE id = ? AND created_by = ?',
      [id, currentUser.username]
    )
    if (rows.length === 0) return { success: false, message: '记录不存在或已删除' }
    const sortNo = p.sort_no === '' || p.sort_no == null ? null : Math.floor(Number(p.sort_no))
    const name = (p.point_name || '').trim().slice(0, 100)
    await conn.execute(
      'UPDATE `coord_data` SET `sort_no` = ?, `point_name` = ?, `longitude` = ?, `latitude` = ? WHERE id = ?',
      [sortNo, name || null, lng, lat, id]
    )
    return { success: true, message: '坐标数据已更新' }
  } catch (err) {
    console.error('[coord:update] 数据库异常:', err)
    return { success: false, message: '更新失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 删除单行（物理删除）
ipcMain.handle('coord:delete', async (_evt, { id }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!id) return { success: false, message: '缺少记录 ID' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      'SELECT id FROM `coord_data` WHERE id = ? AND created_by = ?',
      [id, currentUser.username]
    )
    if (rows.length === 0) return { success: false, message: '记录不存在或已删除' }
    await conn.execute('DELETE FROM `coord_data` WHERE id = ?', [id])
    return { success: true, message: '坐标数据已删除' }
  } catch (err) {
    console.error('[coord:delete] 数据库异常:', err)
    return { success: false, message: '删除失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 清空某项目某类型的全部坐标数据（仅当前用户的数据，物理删除）
ipcMain.handle('coord:clear', async (_evt, { projectId, pointType }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!projectId || !pointType) return { success: false, message: '缺少查询条件' }
  if (pointType !== 'start' && pointType !== 'end') return { success: false, message: '数据类型不合法' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [result] = await conn.execute(
      'DELETE FROM `coord_data` WHERE project_id = ? AND point_type = ? AND created_by = ?',
      [projectId, pointType, currentUser.username]
    )
    const n = result ? Number(result.affectedRows) : 0
    return { success: true, message: '已清空 ' + n + ' 条' + (pointType === 'start' ? '起点' : '终点') + '坐标数据' }
  } catch (err) {
    console.error('[coord:clear] 数据库异常:', err)
    return { success: false, message: '清空失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：选择坐标数据文件（只返回路径，不复制） --------------------
ipcMain.handle('dialog:pick-file', async () => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  const result = await dialog.showOpenDialog(win, {
    title: '选择坐标数据文件',
    properties: ['openFile'],
    filters: [
      { name: '数据文件（txt/csv/excel）', extensions: ['txt', 'csv', 'xls', 'xlsx'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false, canceled: true, message: '已取消选择' }
  }
  const srcPath = result.filePaths[0]
  return { success: true, canceled: false, path: srcPath, name: path.basename(srcPath) }
})

// -------------------- IPC：路径计算（calc_result 表） --------------------
// 全流程：校验 → 预处理路网（node-osrm extract/partition/customize，产物缓存）→ 加载引擎 →
//         全组合 pairs（起点×终点）→ 并发计算（进度经 calc:progress 事件推送）→ 批量入库（一批一个批次号）。
// 清除为软删除（is_deleted=1，数据保留不显示）。

// 结果列表（未删除，按批次倒序）
ipcMain.handle('calc:list', async (_evt, { projectId }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!projectId) return { success: false, message: '缺少项目' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [rows] = await conn.execute(
      `SELECT id, batch_no, from_name, from_lng, from_lat, to_name, to_lng, to_lat,
              distance, duration, status, created_at
         FROM \`calc_result\`
        WHERE project_id = ? AND is_deleted = 0 AND created_by = ?
        ORDER BY batch_no DESC, id ASC`,
      [projectId, currentUser.username]
    )
    return { success: true, records: rows }
  } catch (err) {
    console.error('[calc:list] 数据库异常:', err)
    return { success: false, message: '读取计算结果失败' }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 运行一次完整计算
ipcMain.handle('calc:run', async (evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const projectId = p.project_id
  const concurrency = Math.min(Math.max(1, Number(p.concurrency) || 20), 100)
  const port = Math.min(Math.max(1, Number(p.port) || calc.DEFAULT_PORT), 65535)
  if (!projectId) return { success: false, message: '缺少项目' }
  let conn
  let server = null
  try {
    conn = await mysql.createConnection(activeDbConfig)
    // 1) 项目必须存在、未删除、且属于当前用户
    const [projRows] = await conn.execute(
      'SELECT id, project_no FROM `project` WHERE id = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, currentUser.username]
    )
    if (projRows.length === 0) return { success: false, message: '项目不存在或无权操作' }
    const projectNo = projRows[0].project_no

    // 2) 起点 / 终点坐标数据
    const [starts] = await conn.execute(
      'SELECT id, point_name, longitude, latitude FROM `coord_data` WHERE project_id = ? AND point_type = ? AND created_by = ? ORDER BY id ASC',
      [projectId, 'start', currentUser.username]
    )
    const [ends] = await conn.execute(
      'SELECT id, point_name, longitude, latitude FROM `coord_data` WHERE project_id = ? AND point_type = ? AND created_by = ? ORDER BY id ASC',
      [projectId, 'end', currentUser.username]
    )
    if (starts.length === 0) {
      return { success: false, message: '该项目还没有起点坐标数据，请先在「加载点位数据-起点坐标数据」中导入' }
    }
    if (ends.length === 0) {
      return { success: false, message: '该项目还没有终点坐标数据，请先在「加载点位数据-终点坐标数据」中导入' }
    }

    // 3) 路网文件（road_file_copy_path）
    const [roadRows] = await conn.execute(
      'SELECT road_file_copy_path FROM `map_data_import` WHERE project_id = ? AND import_type = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, 'road', currentUser.username]
    )
    if (roadRows.length === 0 || !roadRows[0].road_file_copy_path) {
      return { success: false, message: '该项目还没有路网数据，请先在「地图数据导入-路网导入」中导入路网文件' }
    }
    const osmPath = roadRows[0].road_file_copy_path
    if (!fs.existsSync(osmPath)) return { success: false, message: '路网文件不存在或已被移动，请重新导入' }
    if (!/\.(osm\.pbf|osm)$/i.test(osmPath)) {
      return { success: false, message: '路网文件必须是 .osm 或 .osm.pbf 格式' }
    }

    // 4) 预处理 + 加载引擎（阶段文案经进度事件推送）
    const sendStage = (msg) => evt.sender.send('calc:progress', { stage: msg })
    sendStage('正在预处理路网…')
    const osrmFilePath = await calc.ensureProcessed(osmPath, (s) => {
      sendStage(s === 'extract' ? '正在预处理路网（osrm-extract）…' : s === 'partition' ? '正在预处理路网（osrm-partition）…' : '正在预处理路网（osrm-customize）…')
    })
    sendStage('正在启动 OSRM 服务…')
    server = await calc.startServer(osrmFilePath, port)

    // 5) 全组合 pairs（起点 × 终点）
    const pairs = []
    for (const s of starts) {
      for (const e of ends) {
        pairs.push({
          from: { id: s.id, name: s.point_name || '', lng: Number(s.longitude), lat: Number(s.latitude) },
          to: { id: e.id, name: e.point_name || '', lng: Number(e.longitude), lat: Number(e.latitude) }
        })
      }
    }

    // 6) 并发计算（进度节流：每完成 5 对推一次，最后一对必推）
    sendStage('计算中…')
    const total = pairs.length
    let lastDone = 0
    const results = await calc.batchCompute(pairs, port, concurrency, (done) => {
      if (done - lastDone >= 5 || done === total) {
        lastDone = done
        evt.sender.send('calc:progress', { done, total })
      }
    })

    // 7) 结果批量入库（一个批次）
    const batchNo = 'JS' + fileStamp()
    await conn.beginTransaction()
    let okCount = 0
    let failCount = 0
    let totalDistanceM = 0
    for (const r of results) {
      const ok = r.distance !== null && r.distance !== undefined
      if (ok) {
        okCount++
        totalDistanceM += r.distance
      } else {
        failCount++
      }
      await conn.execute(
        `INSERT INTO \`calc_result\`
          (\`project_id\`, \`project_no\`, \`batch_no\`,
           \`from_point_id\`, \`from_name\`, \`from_lng\`, \`from_lat\`,
           \`to_point_id\`, \`to_name\`, \`to_lng\`, \`to_lat\`,
           \`distance\`, \`status\`, \`created_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId, projectNo, batchNo,
          r.from.id, r.from.name || null, r.from.lng, r.from.lat,
          r.to.id, r.to.name || null, r.to.lng, r.to.lat,
          ok ? r.distance : null, ok ? 'ok' : 'fail', currentUser.username
        ]
      )
    }
    await conn.commit()
    return {
      success: true,
      message: '计算完成：共 ' + total + ' 对，成功 ' + okCount + '，失败 ' + failCount,
      batchNo,
      total,
      okCount,
      failCount,
      totalDistanceKm: Math.round((totalDistanceM / 1000) * 1000) / 1000
    }
  } catch (err) {
    console.error('[calc:run] 计算异常:', err)
    if (conn) await conn.rollback().catch(() => {})
    return { success: false, message: '计算失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    // 无论成功失败，计算结束都销毁本次启动的 OSRM 服务进程
    if (server) await calc.stopServer(server).catch(() => {})
    if (conn) await conn.end().catch(() => {})
  }
})

// 清除结果（软删除该项目全部结果，数据保留）
ipcMain.handle('calc:clear', async (_evt, { projectId }) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  if (!projectId) return { success: false, message: '缺少项目' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    const [result] = await conn.execute(
      'UPDATE `calc_result` SET `is_deleted` = 1 WHERE project_id = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, currentUser.username]
    )
    const n = result ? Number(result.affectedRows) : 0
    return { success: true, message: n > 0 ? '计算结果已清除' : '暂无计算结果可清除' }
  } catch (err) {
    console.error('[calc:clear] 数据库异常:', err)
    return { success: false, message: '清除失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：地图 API 距离计算（API 导入分支，独立于 OSRM） --------------------
// 流程：校验 → 按平台拼完整 URL（基础网址 + 页面传入的参数模板）→ 全组合 pairs →
//       并发请求地图 API（进度经 calc:progress 推送）→ 入库（含 duration，batch_no=AP+时间戳）
ipcMain.handle('apiCalc:run', async (evt, payload) => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  const p = payload || {}
  const projectId = p.project_id
  const concurrency = Math.min(Math.max(1, Number(p.concurrency) || 10), 50)
  const timeoutMs = Math.min(Math.max(1, Number(p.timeout) || 10), 120) * 1000
  const paramTemplate = String(p.param_template || '').trim()
  if (!projectId) return { success: false, message: '缺少项目' }
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    // 1) 项目
    const [projRows] = await conn.execute(
      'SELECT id, project_no FROM `project` WHERE id = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, currentUser.username]
    )
    if (projRows.length === 0) return { success: false, message: '项目不存在或无权操作' }
    const projectNo = projRows[0].project_no

    // 2) 起点 / 终点坐标数据
    const [starts] = await conn.execute(
      'SELECT id, point_name, longitude, latitude FROM `coord_data` WHERE project_id = ? AND point_type = ? AND created_by = ? ORDER BY id ASC',
      [projectId, 'start', currentUser.username]
    )
    const [ends] = await conn.execute(
      'SELECT id, point_name, longitude, latitude FROM `coord_data` WHERE project_id = ? AND point_type = ? AND created_by = ? ORDER BY id ASC',
      [projectId, 'end', currentUser.username]
    )
    if (starts.length === 0) {
      return { success: false, message: '该项目还没有起点坐标数据，请先在「加载点位数据-起点坐标数据」中导入' }
    }
    if (ends.length === 0) {
      return { success: false, message: '该项目还没有终点坐标数据，请先在「加载点位数据-终点坐标数据」中导入' }
    }

    // 3) API 导入记录（api_platform / api_key / api_url）
    const [apiRows] = await conn.execute(
      'SELECT api_platform, api_key, api_url FROM `map_data_import` WHERE project_id = ? AND import_type = ? AND is_deleted = 0 AND created_by = ?',
      [projectId, 'api', currentUser.username]
    )
    if (apiRows.length === 0) {
      return { success: false, message: '该项目还没有 API 导入记录，请先在「地图数据导入-api导入」中配置' }
    }
    const apiRec = apiRows[0]
    if (!apiRec.api_platform || !apiRec.api_key || !apiRec.api_url) {
      return { success: false, message: 'API 导入记录不完整（平台 / Key / 网址），请重新导入' }
    }

    // 4) 拼完整 URL（校验参数模板占位符）
    let fullTemplate
    try {
      fullTemplate = apiCalc.buildFullUrl(apiRec.api_url, paramTemplate)
    } catch (err) {
      return { success: false, message: err.message }
    }

    // 5) 全组合 pairs
    const pairs = []
    for (const s of starts) {
      for (const e of ends) {
        pairs.push({
          from: { id: s.id, name: s.point_name || '', lng: Number(s.longitude), lat: Number(s.latitude) },
          to: { id: e.id, name: e.point_name || '', lng: Number(e.longitude), lat: Number(e.latitude) }
        })
      }
    }

    // 6) 并发计算（进度节流）
    const sendStage = (msg) => evt.sender.send('calc:progress', { stage: msg })
    sendStage('计算中…')
    const total = pairs.length
    let lastDone = 0
    const results = await apiCalc.batchCompute(
      pairs,
      fullTemplate,
      apiRec.api_key,
      apiRec.api_platform,
      concurrency,
      timeoutMs,
      (done) => {
        if (done - lastDone >= 5 || done === total) {
          lastDone = done
          evt.sender.send('calc:progress', { done, total })
        }
      }
    )

    // 7) 结果批量入库（一个批次，含 duration）
    const batchNo = 'AP' + fileStamp()
    await conn.beginTransaction()
    let okCount = 0
    let failCount = 0
    let totalDistanceM = 0
    let totalDurationS = 0
    for (const r of results) {
      const ok = r.distance !== null && r.distance !== undefined && !r.error
      if (ok) {
        okCount++
        totalDistanceM += r.distance
        if (r.duration !== null && r.duration !== undefined) totalDurationS += r.duration
      } else {
        failCount++
      }
      await conn.execute(
        `INSERT INTO \`calc_result\`
          (\`project_id\`, \`project_no\`, \`batch_no\`,
           \`from_point_id\`, \`from_name\`, \`from_lng\`, \`from_lat\`,
           \`to_point_id\`, \`to_name\`, \`to_lng\`, \`to_lat\`,
           \`distance\`, \`duration\`, \`status\`, \`created_by\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          projectId, projectNo, batchNo,
          r.from.id, r.from.name || null, r.from.lng, r.from.lat,
          r.to.id, r.to.name || null, r.to.lng, r.to.lat,
          ok ? r.distance : null, ok ? (r.duration != null ? r.duration : null) : null,
          ok ? 'ok' : 'fail', currentUser.username
        ]
      )
    }
    await conn.commit()
    return {
      success: true,
      message: '计算完成：共 ' + total + ' 对，成功 ' + okCount + '，失败 ' + failCount,
      batchNo,
      total,
      okCount,
      failCount,
      totalDistanceKm: Math.round((totalDistanceM / 1000) * 1000) / 1000,
      totalDurationS: Math.round(totalDurationS)
    }
  } catch (err) {
    console.error('[apiCalc:run] 计算异常:', err)
    if (conn) await conn.rollback().catch(() => {})
    return { success: false, message: '计算失败：' + (err && err.message ? err.message : '请稍后重试') }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// -------------------- IPC：系统管理（仅管理员可用） --------------------
// 系统名称 / 版本号：来自 package.json，写活不硬编码
ipcMain.handle('sys:info', async () => {
  if (!currentUser) return { success: false, message: '未登录，请重新登录' }
  return {
    success: true,
    name: (appPkg.build && appPkg.build.productName) || appPkg.name,
    version: appPkg.version
  }
})

// 数据库信息：返回当前生效连接（含账号名 user）+ 实时连接状态（SELECT 1 探活）。
// 不要求登录，供登录页「系统设置」直接展示当前数据库；user 字段供个人主页「数据库信息」展示。
ipcMain.handle('sys:db-info', async () => {
  const cfg = activeDbConfig
  let conn
  try {
    conn = await mysql.createConnection(cfg)
    await conn.execute('SELECT 1')
    return {
      success: true,
      host: cfg.host,
      user: cfg.user,
      port: cfg.port,
      database: cfg.database,
      status: 'connected'
    }
  } catch (err) {
    return {
      success: true,
      host: cfg.host,
      user: cfg.user,
      port: cfg.port,
      database: cfg.database,
      status: 'disconnected',
      error: err && err.message ? err.message : '连接失败'
    }
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
})

// 连接清单：返回所有连接（不含密码）与当前生效 id，供前端切换 / 展示
ipcMain.handle('sys:db-connections', async () => {
  const list = connections.list.map((c) => ({
    id: c.id,
    name: c.name,
    host: c.host,
    port: c.port,
    database: c.database,
    hasPassword: !!c.password
  }))
  return { success: true, active: connections.active, list }
})

// 切换当前生效连接
ipcMain.handle('sys:switch-db', async (_evt, { id }) => {
  return switchConnection(id)
})

// 新增连接
ipcMain.handle('sys:add-db', async (_evt, payload) => {
  return addConnection(payload)
})

// 删除连接
ipcMain.handle('sys:delete-db', async (_evt, { id }) => {
  return deleteConnection(id)
})

app.whenReady().then(() => {
  // 确保当前生效库存在 project 表（幂等；存量库不会走「新增连接」初始化，故此处补齐）
  ensureActiveDbTables()
  // 移除窗口自带的菜单栏（文件 / File、编辑、视图等那一行）
  Menu.setApplicationMenu(null)
  createWindow()
})

// 对当前生效库幂等建 project 表；数据库不可达时仅告警，不影响启动
async function ensureActiveDbTables() {
  let conn
  try {
    conn = await mysql.createConnection(activeDbConfig)
    await ensureProjectTable(conn)
    await ensureMapDataImportTable(conn)
    await ensureCoordDataTable(conn)
    await ensureCalcResultTable(conn)
  } catch (e) {
    console.error('[ensureActiveDbTables] 表确保失败（请检查数据库连接）：', e)
  } finally {
    if (conn) await conn.end().catch(() => {})
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
