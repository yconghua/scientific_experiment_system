<template>
  <div class="profile">
    <h2 class="page-title">个人主页</h2>

    <!-- 横向导航（按角色区分） -->
    <nav class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="tab-body">
      <!-- 个人信息 -->
      <div v-show="activeTab === 'info'">
        <!-- 基本信息：只读展示（账号 / 角色 / ID / 创建时间），标题行右侧放「修改密码」按钮 -->
        <section class="card card-info">
          <div class="card-head">
            <h3 class="card-title">基本信息</h3>
            <button class="save-btn ghost" @click="openChangePwd">修改密码</button>
          </div>
          <div class="info-grid">
            <div class="info-cell">
              <span class="info-key">账号</span>
              <span class="info-val">{{ user.username }}</span>
            </div>
            <div class="info-cell">
              <span class="info-key">角色</span>
              <span class="info-val">
                <span class="badge" :class="user.role === 'admin' ? 'on' : 'off'">{{ roleText }}</span>
              </span>
            </div>
            <div class="info-cell">
              <span class="info-key">ID</span>
              <span class="info-val">{{ user.id }}</span>
            </div>
            <div class="info-cell">
              <span class="info-key">创建时间</span>
              <span class="info-val">{{ disp(user.created_at) }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- 用户管理（仅管理员） -->
      <div v-show="activeTab === 'users'">
        <section class="card card-wide">
          <div class="card-head">
            <h3 class="card-title">用户管理（{{ users.length }}个用户）</h3>
            <button class="save-btn" @click="openAdd">+ 新增用户</button>
          </div>

          <div class="search-row">
            <input
              v-model="searchKeyword"
              class="field-input search-input"
              type="text"
              placeholder="按账号搜索"
            />
          </div>

          <div class="table-scroll" v-if="pagedUsers.length">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>账号</th>
                  <th>权限</th>
                  <th>创建时间</th>
                  <th class="col-act">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in pagedUsers" :key="u.id">
                  <td>{{ u.id }}</td>
                  <td>{{ u.username }}</td>
                  <td>
                    <span class="badge" :class="u.role === 'admin' ? 'on' : 'off'">{{ roleLabel(u.role) }}</span>
                  </td>
                  <td>{{ disp(u.created_at) }}</td>
                  <td class="col-act">
                    <button class="link-btn" @click="openEdit(u)">编辑</button>
                    <button class="link-btn danger" @click="openDel(u)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="empty-tip">暂无用户数据</p>

          <!-- 分页：上一页 / 第几页/共几页 / 下一页 -->
          <div class="pagination" v-if="totalPages > 1">
            <button class="page-btn" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">上一页</button>
            <span class="page-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">下一页</button>
          </div>
        </section>
      </div>

      <!-- 算法运算过程管理（所有用户可见） -->
      <div v-show="activeTab === 'algo'">
        <section class="card card-wide">
          <div class="card-head">
            <h3 class="card-title">算法运算过程管理</h3>
          </div>
          <p class="algo-tip">正在开发中</p>
        </section>
      </div>

      <!-- 系统管理（仅管理员） -->
      <div v-show="activeTab === 'sys'">
        <section class="card card-wide card-system">
          <div class="card-head">
            <h3 class="card-title">系统管理</h3>
          </div>
          <!-- 第一排：系统名称 / 版本号 -->
          <div class="sys-row">
            <div class="sys-box">
              <span class="sys-key">系统名称</span>
              <span class="sys-val">{{ sysName || '—' }}</span>
            </div>
            <div class="sys-box">
              <span class="sys-key">版本号</span>
              <span class="sys-val">{{ sysVersion || '—' }}</span>
            </div>
          </div>

          <!-- 第二排：数据库信息 / 开发者日志 -->
          <div class="sys-row">
            <div class="sys-box clickable" @click="openDb">
              <span class="sys-key">数据库信息</span>
              <span class="sys-val arrow">查看 ›</span>
            </div>
            <div class="sys-box clickable" @click="showLog = true">
              <span class="sys-key">开发者日志</span>
              <span class="sys-val arrow">查看 ›</span>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 新增用户弹窗：填账号 + 选角色 -->
    <div class="modal-mask" v-if="showAdd" @click.self="showAdd = false">
      <div class="modal">
        <h3 class="modal-title">新增用户</h3>
        <div class="form-row">
          <label class="field-label">账号 *</label>
          <input v-model="addForm.username" class="field-input" type="text" placeholder="登录账号（唯一）" />
        </div>
        <div class="form-row">
          <label class="field-label">角色 *</label>
          <select v-model="addForm.role" class="field-input">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <p v-if="addMsg" class="msg" :class="addPlain ? 'ok' : 'err'">{{ addMsg }}</p>
        <div class="pwd-box" v-if="addPlain">
          初始密码：<b class="pwd-text">{{ addPlain }}</b>
          <span class="pwd-hint">（请复制给该用户，登录后自行修改）</span>
        </div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showAdd = false">关闭</button>
          <button class="save-btn" @click="onSubmitAdd" :disabled="addLoading">创建</button>
        </div>
      </div>
    </div>

    <!-- 编辑用户弹窗 -->
    <div class="modal-mask" v-if="showEdit" @click.self="showEdit = false">
      <div class="modal">
        <h3 class="modal-title">编辑用户</h3>
        <div class="form-row">
          <label class="field-label">账号</label>
          <input class="field-input" type="text" :value="editForm.username" disabled />
        </div>
        <div class="form-row">
          <label class="field-label">角色</label>
          <select v-model="editForm.role" class="field-input">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div class="form-row check-row">
          <label class="check-label">
            <input type="checkbox" v-model="editForm.resetPassword" /> 重置密码（生成新的 6 位密码）
          </label>
        </div>
        <p v-if="editMsg" class="msg" :class="editPlain ? 'ok' : 'err'">{{ editMsg }}</p>
        <div class="pwd-box" v-if="editPlain">
          新密码：<b class="pwd-text">{{ editPlain }}</b>
        </div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showEdit = false">{{ editPlain ? '关闭' : '取消' }}</button>
          <button v-if="!editPlain" class="save-btn" @click="onSubmitEdit" :disabled="editLoading">保存</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div class="modal-mask" v-if="showDel" @click.self="showDel = false">
      <div class="modal modal-sm">
        <h3 class="modal-title">确认删除</h3>
        <p class="modal-text">
          确定要删除用户 <b>{{ delTarget?.username }}</b> 吗？此操作不可恢复。
        </p>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showDel = false">取消</button>
          <button class="save-btn danger" @click="onConfirmDel" :disabled="delLoading">删除</button>
        </div>
      </div>
    </div>

    <!-- 修改密码弹窗 -->
    <div class="modal-mask" v-if="showPwd" @click.self="showPwd = false">
      <div class="modal">
        <h3 class="modal-title">修改密码</h3>
        <div class="form-row">
          <label class="field-label">原密码</label>
          <input v-model="oldPwd" class="field-input" type="password" placeholder="请输入原密码" />
        </div>
        <div class="form-row">
          <label class="field-label">新密码</label>
          <input v-model="newPwd" class="field-input" type="password" placeholder="请输入新密码" />
        </div>
        <div class="form-row">
          <label class="field-label">确认新密码</label>
          <input v-model="confirmPwd" class="field-input" type="password" placeholder="请再次输入新密码" />
        </div>
        <p v-if="pwdMsg" class="msg" :class="pwdOk ? 'ok' : 'err'">{{ pwdMsg }}</p>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showPwd = false">取消</button>
          <button class="save-btn" @click="onChangePwd" :disabled="pwdSaving">确认修改</button>
        </div>
      </div>
    </div>

    <!-- 数据库信息弹窗（真实连接） -->
    <div class="modal-mask" v-if="showDb" @click.self="showDb = false">
      <div class="modal">
        <h3 class="modal-title">数据库信息</h3>
        <div v-if="dbLoading" class="modal-text">加载中…</div>
        <template v-else-if="dbInfo">
          <div class="kv-list">
            <div class="kv-row">
              <span class="kv-key">主机</span>
              <span class="kv-val">{{ dbInfo.host }}:{{ dbInfo.port }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">数据库名</span>
              <span class="kv-val">{{ dbInfo.database }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">用户名</span>
              <span class="kv-val">{{ dbInfo.user }}</span>
            </div>
            <div class="kv-row">
              <span class="kv-key">连接状态</span>
              <span class="kv-val" :class="dbInfo.status === 'connected' ? 'ok' : 'err'">{{ dbInfo.status === 'connected' ? '已连接' : '连接失败' }}</span>
            </div>
          </div>
          <p v-if="dbInfo.status !== 'connected' && dbInfo.error" class="modal-text err">{{ dbInfo.error }}</p>
        </template>
        <div v-else class="modal-text">正在开发中</div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showDb = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- 开发者日志弹窗（纯前端写死） -->
    <div class="modal-mask" v-if="showLog" @click.self="showLog = false">
      <div class="modal modal-log">
        <h3 class="modal-title">开发者日志</h3>
        <div class="devlog">
          <div class="devlog-block" v-for="(entry, i) in devLog" :key="i">
            <div class="devlog-head">
              <span class="devlog-ver">{{ entry.version }}</span>
              <span class="devlog-date">{{ entry.date }}</span>
            </div>
            <div class="devlog-group" v-for="(g, gi) in entry.groups" :key="gi">
              <div class="devlog-group-label">{{ g.label }}</div>
              <ul class="devlog-list">
                <li v-for="(it, ii) in g.items" :key="ii">{{ it }}</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button class="save-btn ghost" @click="showLog = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import {
  changePassword,
  getCurrentUser,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getSysInfo,
  getDbInfo
} from '../api'

const user = ref(JSON.parse(localStorage.getItem('conghua_user') || 'null'))

// 两级角色判定（admin 管理员 / user 普通用户）
const role = computed(() => user.value?.role)
const isAdmin = computed(() => role.value === 'admin')

// 角色中文名
function roleLabel(r) {
  return r === 'admin' ? '管理员' : '普通用户'
}
const roleText = computed(() => roleLabel(role.value))

// 横向导航页签：所有用户 = 个人信息 + 算法运算过程管理；管理员额外 = 用户管理 + 系统管理
const tabs = computed(() => {
  const base = [
    { key: 'info', label: '个人信息' },
    { key: 'algo', label: '算法运算过程管理' }
  ]
  if (isAdmin.value) {
    base.push({ key: 'users', label: '用户管理' })
    base.push({ key: 'sys', label: '系统管理' })
  }
  return base
})
const activeTab = ref('info')

// -------------------- 系统管理（仅管理员可见） --------------------
// 系统名称 / 版本号：从后端 package.json 读取（写活），挂载时填充
const sysName = ref('')
const sysVersion = ref('')
// 两个弹窗开关（数据库信息 / 开发者日志）
const showDb = ref(false)
const showLog = ref(false)
// 数据库信息弹窗：真实连接数据（点击时拉取）
const dbLoading = ref(false)
const dbInfo = ref(null)
async function loadDbInfo() {
  dbLoading.value = true
  dbInfo.value = null
  try {
    const res = await getDbInfo()
    if (res && res.success) dbInfo.value = res
    else dbInfo.value = { status: 'disconnected', error: (res && res.message) || '获取失败' }
  } catch (e) {
    dbInfo.value = { status: 'disconnected', error: '请求异常：' + (e && e.message ? e.message : e) }
  } finally {
    dbLoading.value = false
  }
}
function openDb() {
  showDb.value = true
  loadDbInfo()
}

// -------------------- 开发者日志（纯前端写死，按版本倒序） --------------------
const devLog = [
  {
    version: 'v1.0.0',
    date: '2025-07-23',
    groups: [
      {
        label: '初始版本',
        items: [
          '科研实验系统 基础框架发布：基于 Vue 3 + Electron + MySQL 的桌面应用。',
          '用户登录认证与角色权限体系（管理员 / 普通用户）。',
          '核心数据模块：（列表、多维筛选、收藏）。',
          '后台用户管理：新增 / 编辑 / 删除用户、重置密码。',
          '个人中心：基本信息查看、修改密码。',
          '接入阿里云 RDS（MySQL）数据库。'
        ]
      }
    ]
  }
]

// 空值占位
function disp(v) {
  return v === null || v === undefined || v === '' ? '—' : v
}

// 修改密码（弹窗）
const showPwd = ref(false)
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
const pwdMsg = ref('')
const pwdOk = ref(false)
const pwdSaving = ref(false)
function openChangePwd() {
  oldPwd.value = ''
  newPwd.value = ''
  confirmPwd.value = ''
  pwdMsg.value = ''
  pwdOk.value = false
  showPwd.value = true
}
async function onChangePwd() {
  pwdMsg.value = ''
  if (!oldPwd.value || !newPwd.value) {
    pwdMsg.value = '请填写原密码和新密码'
    pwdOk.value = false
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    pwdMsg.value = '两次输入的新密码不一致'
    pwdOk.value = false
    return
  }
  pwdSaving.value = true
  try {
    const res = await changePassword(user.value.username, oldPwd.value, newPwd.value)
    if (res.success) {
      showPwd.value = false
      oldPwd.value = ''
      newPwd.value = ''
      confirmPwd.value = ''
      pwdMsg.value = ''
      pwdOk.value = false
    } else {
      pwdMsg.value = res.message || '修改失败'
      pwdOk.value = false
    }
  } catch (e) {
    pwdMsg.value = '修改过程出现异常，请重试'
    pwdOk.value = false
  } finally {
    pwdSaving.value = false
  }
}

// -------------------- 用户管理 --------------------
const users = ref([])
const searchKeyword = ref('')
const filteredUsers = computed(() => {
  const k = searchKeyword.value.trim().toLowerCase()
  if (!k) return users.value
  return users.value.filter((u) => u.username.toLowerCase().includes(k))
})

// 分页：每页 5 条
const PAGE_SIZE = 5
const currentPage = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / PAGE_SIZE)))
const pagedUsers = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredUsers.value.slice(start, start + PAGE_SIZE)
})
function goPage(p) {
  const max = totalPages.value
  currentPage.value = Math.min(Math.max(1, p), max)
}
// 搜索条件变化时回到第一页
watch(searchKeyword, () => {
  currentPage.value = 1
})
// 数据变化导致页数减少时，纠正越界的当前页
watch(totalPages, (t) => {
  if (currentPage.value > t) currentPage.value = t
})

async function loadUsers() {
  try {
    const res = await listUsers()
    if (res.success) users.value = res.users || []
  } catch (e) {
    // 忽略读取异常
  }
}

// 新增用户（填账号 + 选角色）
const showAdd = ref(false)
const addForm = ref({ username: '', role: 'user' })
const addMsg = ref('')
const addPlain = ref('')
const addLoading = ref(false)
function openAdd() {
  addForm.value = { username: '', role: 'user' }
  addMsg.value = ''
  addPlain.value = ''
  showAdd.value = true
}
async function onSubmitAdd() {
  addMsg.value = ''
  addPlain.value = ''
  if (!addForm.value.username.trim()) {
    addMsg.value = '账号不能为空'
    return
  }
  addLoading.value = true
  try {
    const res = await createUser({
      username: addForm.value.username.trim(),
      role: addForm.value.role
    })
    if (res.success) {
      addPlain.value = res.plainPassword
      addMsg.value = '创建成功！初始密码已生成（见下方），请复制给该用户。'
      loadUsers()
    } else {
      addMsg.value = res.message || '创建失败'
    }
  } catch (e) {
    addMsg.value = '创建过程出现异常，请重试'
  } finally {
    addLoading.value = false
  }
}

// 编辑用户（改角色 + 可选重置密码）
const showEdit = ref(false)
const editForm = ref({ id: null, username: '', role: 'user', resetPassword: false })
const editMsg = ref('')
const editPlain = ref('')
const editLoading = ref(false)
function openEdit(u) {
  editForm.value = {
    id: u.id,
    username: u.username,
    role: u.role,
    resetPassword: false
  }
  editMsg.value = ''
  editPlain.value = ''
  showEdit.value = true
}
async function onSubmitEdit() {
  editMsg.value = ''
  editPlain.value = ''
  editLoading.value = true
  try {
    const res = await updateUser({
      id: editForm.value.id,
      role: editForm.value.role,
      resetPassword: editForm.value.resetPassword
    })
    if (res.success) {
      if (res.plainPassword) {
        // 重置了密码：保留弹窗显示新密码，让用户复制后再手动关闭
        editMsg.value = '保存成功！新密码已生成（见下方），请复制给该用户。'
        editPlain.value = res.plainPassword
      } else {
        editMsg.value = '保存成功'
        editPlain.value = ''
        showEdit.value = false
        loadUsers()
      }
    } else {
      editMsg.value = res.message || '保存失败'
    }
  } catch (e) {
    editMsg.value = '保存过程出现异常，请重试'
  } finally {
    editLoading.value = false
  }
}

// 删除用户
const showDel = ref(false)
const delTarget = ref(null)
const delLoading = ref(false)
function openDel(u) {
  delTarget.value = u
  showDel.value = true
}
async function onConfirmDel() {
  delLoading.value = true
  try {
    const res = await deleteUser(delTarget.value.id)
    showDel.value = false
    if (res.success) {
      loadUsers()
    } else {
      alert(res.message || '删除失败')
    }
  } catch (e) {
    alert('删除过程出现异常，请重试')
  } finally {
    delLoading.value = false
  }
}

// 切到用户管理页签时加载数据
watch(activeTab, (t) => {
  if (t === 'users') loadUsers()
})
onMounted(async () => {
  // 重新拉取当前登录用户，与数据库保持一致
  try {
    const u = await getCurrentUser()
    if (u) {
      user.value = u
      localStorage.setItem('conghua_user', JSON.stringify(u))
    }
  } catch (e) {}
  // 系统名称 / 版本号（管理员可见，普通用户即便请求也会被后端拦截，无副作用）
  try {
    const info = await getSysInfo()
    if (info && info.success) {
      sysName.value = info.name
      sysVersion.value = info.version
    }
  } catch (e) {}
})
</script>

<style scoped>
.profile {
  min-height: 100%;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}
/* 横向导航（页签） */
.tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #eceff3;
  margin-bottom: 16px;
}
.tab-item {
  padding: 10px 18px;
  font-size: 14px;
  color: #4e5969;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.2s;
}
.tab-item:hover {
  color: #0d80e0;
}
.tab-item.active {
  color: #0d80e0;
  border-bottom-color: #0d80e0;
  font-weight: 600;
}
.tab-body {
  min-height: 0;
}

.card {
  background: #fff;
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 16px;
  max-width: 520px;
  margin: 0 auto;
}
.card-info{
  margin-left: 0;
}
.card-wide {
  max-width: 100%;
}
.card-system{
  max-width: 660px;
  margin-left: 0;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: #1f2329;
}
.form-row {
  margin-bottom: 14px;
}
.field-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin-bottom: 6px;
}
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: #fff;
}
.field-input:focus {
  border-color: #0d80e0;
}
.field-input:disabled {
  background: #f5f6f8;
  color: #8a9099;
}
.check-row {
  margin-bottom: 6px;
}
.check-label {
  font-size: 13px;
  color: #4e5969;
  display: flex;
  align-items: center;
  gap: 6px;
}
.save-btn {
  height: 38px;
  padding: 0 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:hover {
  opacity: 0.92;
}
.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.save-btn.ghost {
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}
.save-btn.danger {
  background: linear-gradient(135deg, #ea4335 0%, #d93025 100%);
}
.msg {
  font-size: 13px;
  margin: 0 0 12px;
}
.msg.ok {
  color: #19a558;
}
.msg.err {
  color: #ea4335;
}

/* 基本信息：只读网格 */
.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 24px;
}
.info-cell {
  display: flex;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid #f2f4f7;
  font-size: 14px;
}
.info-cell:nth-last-child(-n + 2) {
  border-bottom: none;
}
.info-key {
  width: 80px;
  flex: 0 0 80px;
  color: #8a9099;
}
.info-val {
  flex: 1;
  color: #1f2329;
  word-break: break-all;
}

/* 搜索 */
.search-row {
  margin-bottom: 14px;
}
.search-input {
  max-width: 280px;
}

.link-btn {
  border: none;
  background: none;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  margin-right: 10px;
  padding: 0;
}
.link-btn.danger {
  color: #ea4335;
}
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}
.badge.on {
  background: #e8f7ee;
  color: #19a558;
}
.badge.off {
  background: #eef0f3;
  color: #6b7280;
}
.empty-tip {
  font-size: 14px;
  color: #8a9099;
  margin: 8px 0 0;
}

/* 算法运算过程管理：占位（正在开发中） */
.algo-tip {
  margin: 8px 0 0;
  padding: 48px 0;
  text-align: center;
  font-size: 15px;
  color: #8a9099;
  background: #fafbfc;
  border: 1px dashed #dfe3e8;
  border-radius: 8px;
}

/* 系统管理：两排布局（第一排信息 / 第二排可点击入口） */
.sys-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 12px;
}
.sys-row:first-of-type {
  margin-top: 0;
}
.sys-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
}
.sys-box.clickable {
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.sys-box.clickable:hover {
  background: #f7f9fc;
  border-color: #d6e4f0;
}
.sys-key {
  color: #8a9099;
}
.sys-val {
  color: #1f2329;
  font-weight: 500;
}
.sys-val.arrow {
  color: #0d80e0;
  font-weight: 400;
}

/* 系统管理：弹窗内键值列表（数据库信息） */
.kv-list {
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  overflow: hidden;
}
.kv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  font-size: 14px;
  border-bottom: 1px solid #f0f2f5;
}
.kv-row:last-child {
  border-bottom: none;
}
.kv-key {
  color: #8a9099;
}
.kv-val {
  color: #1f2329;
  font-weight: 500;
  word-break: break-all;
  text-align: right;
}
.kv-val.ok {
  color: #19a558;
}
.kv-val.err {
  color: #ea4335;
}
.modal-text.err {
  color: #ea4335;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 22px 24px;
  width: auto;
  min-width: 380px;
  max-width: 90vw;
  max-height: 84vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.modal-sm {
  width: 320px;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 16px;
}
.modal-text {
  font-size: 14px;
  color: #4e5969;
  margin: 0 0 18px;
  line-height: 1.6;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}
.pwd-box {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f3f8ff;
  border-radius: 8px;
  font-size: 13px;
  color: #4e5969;
}
.pwd-text {
  color: #0d80e0;
  font-size: 15px;
  letter-spacing: 1px;
}
.pwd-hint {
  color: #8a9099;
}

/* 系统管理：开发者日志弹窗 */
.modal-log {
  min-width: 520px;
}
.devlog {
  max-height: 60vh;
  overflow-y: auto;
  margin: 0 0 4px;
}
.devlog-block {
  padding: 14px 0;
  border-bottom: 1px dashed #eceff3;
}
.devlog-block:first-child {
  padding-top: 0;
}
.devlog-block:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.devlog-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}
.devlog-ver {
  font-size: 15px;
  font-weight: 700;
  color: #0d80e0;
}
.devlog-date {
  font-size: 13px;
  color: #8a9099;
}
.devlog-group {
  margin-bottom: 12px;
}
.devlog-group:last-child {
  margin-bottom: 0;
}
.devlog-group-label {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 4px;
}
.devlog-list {
  margin: 0;
  padding-left: 18px;
}
.devlog-list li {
  font-size: 13px;
  line-height: 1.7;
  color: #4e5969;
}

/* 用户管理：数据表格 + 分页 */
.table-scroll {
  width: 100%;
  overflow-x: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.data-table th,
.data-table td {
  padding: 12px 14px;
  text-align: left;
  border-bottom: 1px solid #f0f2f5;
}
.data-table th {
  color: #8a9099;
  font-weight: 600;
  background: #fafbfc;
  white-space: nowrap;
}
.data-table tbody tr:hover {
  background: #f7f9fc;
}
.col-act {
  width: 130px;
  white-space: nowrap;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 18px;
  flex-wrap: wrap;
}
.page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: #0d80e0;
  color: #0d80e0;
}
.page-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.page-info {
  font-size: 13px;
  color: #4e5969;
  padding: 0 4px;
}
</style>
