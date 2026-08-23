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
const { initDatabase, ensureProjectTable, ensureMapDataImportTable } = require('./db/create_new_database')

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
      { name: '路网文件', extensions: ['shp', 'osm', 'json', 'geojson', 'csv', 'txt', 'xml'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false, canceled: true, message: '已取消选择' }
  }
  const srcPath = result.filePaths[0]
  const srcName = path.basename(srcPath)
  const ext = path.extname(srcName)
  const base = path.basename(srcName, ext)
  const destDir = path.join(app.getPath('userData'), 'projects', projectNo)
  try {
    await fs.promises.mkdir(destDir, { recursive: true })
    // 重名统一改名：原名_YYYYMMDD_HHMM.ext；仍存在则追加序号
    let destName = `${base}_${fileStamp()}${ext}`
    let destPath = path.join(destDir, destName)
    let n = 1
    while (fs.existsSync(destPath)) {
      destName = `${base}_${fileStamp()}_${n}${ext}`
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
