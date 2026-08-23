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
const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
// 读取 package.json，供「系统管理」展示系统名称 / 版本号
const appPkg = require('../package.json')
// 默认连接清单（阿里云预设）抽到独立文件，便于不改 main.js 主体即可调整预设
const { defaultConnections } = require('./db/database_default_connections')
// 数据库初始化公共模块（建库 + user 表 + 默认管理员），供「添加新数据库」自动初始化
const { initDatabase } = require('./db/create_new_database')

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
    title: '葱花工作室管理系统',
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
  // 移除窗口自带的菜单栏（文件 / File、编辑、视图等那一行）
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
