<template>
  <div class="login-page" :style="{ backgroundImage: `url(${loginBg})` }">
    <!-- 上：系统标题 -->
    <header class="login-header">
      <img :src="logoUrl" class="brand-mark" alt="葱花工作室" />
      <h1 class="brand-title">葱花工作室管理系统</h1>
    </header>

    <!-- 中：简介（左） + 登录表单（右） -->
    <main class="login-main">
      <section class="intro-panel">
        <img :src="jianjieUrl" class="intro-image" alt="葱花工作室" />
        <div class="intro-overlay">
          <h2 class="intro-title">系统简介</h2>
          <p class="intro-foot">记录 · 管理 · 成长</p>
        </div>
      </section>

      <section class="form-panel">
        <div class="login-card">
          <h2 class="card-title">账号登录</h2>
          <p class="card-sub">请输入账号密码以进入系统</p>

          <form @submit.prevent="onSubmit">
            <label class="field-label" for="username">账号</label>
            <input
              id="username"
              v-model="username"
              class="field-input"
              type="text"
              placeholder="请输入账号"
              autocomplete="username"
              @keyup.enter="onSubmit"
            />

            <label class="field-label" for="password">密码</label>
            <input
              id="password"
              v-model="password"
              class="field-input"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
              @keyup.enter="onSubmit"
            />

            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <button class="submit-btn" type="submit" :disabled="loading">
              {{ loading ? '登录中…' : '登 录' }}
            </button>

            <p class="forgot-tip">忘记密码请联系<span class="admin-link" @click="showAdminContact = true">管理员</span>重置</p>
          </form>

        </div>
      </section>
    </main>

    <!-- 下：页脚 -->
    <footer class="login-footer">
      <div class="footer-top">
        <button type="button" class="footer-link" @click="showTerms = true">服务条款</button>
        <button type="button" class="footer-link" @click="showPrivacy = true">隐私协议</button>
        <button type="button" class="footer-link" @click="openSettings">系统设置</button>
      </div>
      <div class="footer-bottom">
        <p class="footer-copy">Copyright © 2025–{{ copyrightYear }} Conghua Studio. All Rights Reserved. 葱花工作室 版权所有</p>
      </div>
    </footer>

    <!-- 管理员联系方式弹窗 -->
    <div v-if="showAdminContact" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showAdminContact = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>联系管理员</h3>
          <button type="button" class="privacy-close" @click="showAdminContact = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p>管理员联系方式：1509054114@qq.com</p>
        </div>
      </div>
    </div>

    <!-- 隐私协议弹窗 -->
    <div v-if="showPrivacy" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showPrivacy = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>隐私协议</h3>
          <button type="button" class="privacy-close" @click="showPrivacy = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p class="privacy-lead">
            葱花工作室管理系统（以下简称"本系统"）重视您的隐私。本隐私协议说明本系统在本地运行过程中如何收集、存储与使用您的信息。
          </p>
          <section v-for="(sec, i) in privacySections" :key="i" class="privacy-sec">
            <h4>{{ sec.title }}</h4>
            <p>{{ sec.body }}</p>
          </section>
        </div>
      </div>
    </div>

    <!-- 服务条款弹窗 -->
    <div v-if="showTerms" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showTerms = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>服务条款</h3>
          <button type="button" class="privacy-close" @click="showTerms = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p class="privacy-lead">
            葱花工作室管理系统（以下简称"本系统"）的账号由管理员统一分配与管理，使用前请仔细阅读以下服务条款。
          </p>
          <section v-for="(sec, i) in termsSections" :key="i" class="privacy-sec">
            <h4>{{ sec.title }}</h4>
            <p>{{ sec.body }}</p>
          </section>
        </div>
      </div>
    </div>

    <!-- 系统设置弹窗 -->
    <div v-if="showSettings" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showSettings = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>系统设置</h3>
          <button type="button" class="privacy-close" @click="showSettings = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <div class="sys-info-list">
            <div class="sys-info-row">
              <span class="sys-info-key">程序名称</span>
              <span class="sys-info-val">{{ sysName }}</span>
            </div>
            <div class="sys-info-row">
              <span class="sys-info-key">版本号</span>
              <span class="sys-info-val">{{ sysVersion }}</span>
            </div>
            <div class="sys-info-row">
              <span class="sys-info-key">当前数据库</span>
              <span class="sys-info-val">
                {{ dbName }}
                <span class="db-status" :class="dbStatus === 'connected' ? 'ok' : 'err'">{{ dbStatus === 'connected' ? '已连接' : '未连接' }}</span>
              </span>
            </div>
          </div>
          <div class="sys-info-actions">
            <button type="button" class="sys-btn" @click="openSwitchDb">切换数据库</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 切换数据库弹窗 -->
    <div v-if="showSwitchDb" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showSwitchDb = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>切换数据库</h3>
          <button type="button" class="privacy-close" @click="showSwitchDb = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p v-if="dbMsg" class="msg" :class="dbMsgOk ? 'ok' : 'err'">{{ dbMsg }}</p>
          <div v-if="dbConnLoading" class="privacy-lead">加载中…</div>
          <div v-else class="conn-list">
            <div
              v-for="c in dbConnections"
              :key="c.id"
              class="conn-item"
              :class="{ active: c.id === dbActive }"
            >
              <div class="conn-main">
                <div class="conn-name">
                  {{ c.name }}
                  <span v-if="c.id === dbActive" class="conn-badge">当前</span>
                </div>
                <div class="conn-meta">{{ c.host }}:{{ c.port }} · {{ c.database }}</div>
              </div>
              <div class="conn-actions">
                <button
                  type="button"
                  class="conn-switch"
                  :disabled="c.id === dbActive"
                  @click="onSwitchDb(c.id)"
                >{{ c.id === dbActive ? '使用中' : '切换' }}</button>
                <button
                  type="button"
                  class="conn-delete"
                  @click="onDeleteDb(c.id)"
                >删除</button>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button type="button" class="save-btn ghost" @click="openAddDb">+ 添加新数据库</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加新 MySQL 数据库弹窗 -->
    <div v-if="showAddDb" class="privacy-overlay">
      <div class="privacy-backdrop" @click="showAddDb = false"></div>
      <div class="privacy-dialog" role="dialog" aria-modal="true">
        <div class="privacy-head">
          <h3>添加新 MySQL 数据库</h3>
          <button type="button" class="privacy-close" @click="showAddDb = false" aria-label="关闭">×</button>
        </div>
        <div class="privacy-body">
          <p class="privacy-lead">填写目标 MySQL 连接信息，提交后将自动测试连通性并保存。</p>
          <div class="form-row">
            <label class="field-label">名称 *</label>
            <input v-model="addForm.name" class="field-input" type="text" placeholder="如：公司服务器" />
          </div>
          <div class="form-row">
            <label class="field-label">主机 *</label>
            <input v-model="addForm.host" class="field-input" type="text" placeholder="如：rm-xxx.rds.aliyuncs.com 或 localhost" />
          </div>
          <div class="form-row">
            <label class="field-label">端口</label>
            <input v-model="addForm.port" class="field-input" type="text" placeholder="3306" />
          </div>
          <div class="form-row">
            <label class="field-label">账号 *</label>
            <input v-model="addForm.user" class="field-input" type="text" placeholder="数据库账号" />
          </div>
          <div class="form-row">
            <label class="field-label">密码</label>
            <input v-model="addForm.password" class="field-input" type="password" placeholder="可为空" />
          </div>
          <div class="form-row">
            <label class="field-label">数据库名 *</label>
            <input v-model="addForm.database" class="field-input" type="text" placeholder="如：conghua_studio" />
          </div>
          <p v-if="addDbMsg" class="msg" :class="addDbOk ? 'ok' : 'err'">{{ addDbMsg }}</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="save-btn ghost" @click="showAddDb = false">取消</button>
          <button type="button" class="save-btn" :disabled="addDbLoading" @click="onSubmitAddDb">{{ addDbLoading ? '测试中…' : '添加' }}</button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="showDeleteConfirm" class="privacy-overlay">
      <div class="privacy-backdrop" @click="cancelDeleteDb"></div>
      <div class="privacy-dialog confirm-dialog" role="dialog" aria-modal="true">
        <div class="privacy-body">
          <p class="confirm-text">确定删除该数据库连接配置吗？此操作不可撤销。</p>
        </div>
        <div class="modal-foot">
          <button type="button" class="save-btn ghost" @click="cancelDeleteDb">取消</button>
          <button type="button" class="save-btn danger" @click="confirmDeleteDb">确认删除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { login, getDbInfo, getDbConnections, switchDb, addDb, deleteDb } from '../api'
import { setSession } from '../session'
import logoUrl from '../assets/logo.ico'
import loginBg from '../assets/login_bg.png'
import jianjieUrl from '../assets/login_jianjie.png'
import pkg from '../../package.json'

const router = useRouter()
const username = ref('')
const password = ref('')
const errorMsg = ref('')
const loading = ref(false)

// 页脚版权年：固定起始 2025，结束取当前动态年份
const copyrightYear = new Date().getFullYear()

// 服务条款弹窗
const showTerms = ref(false)
// 系统设置弹窗
const showSettings = ref(false)
// 程序名称 / 版本号：实时读取 package.json（非前端写死；改 package.json 后重新构建即生效）
const sysName = (pkg.build && pkg.build.productName) || pkg.name
const sysVersion = pkg.version
// 当前数据库：打开弹窗时直接从后端读取（后端已放开登录守卫，无需登录即可显示）
const dbName = ref('')
const dbStatus = ref('')
// 切换 / 添加数据库相关
const dbConnections = ref([])
const dbActive = ref('')
const dbConnLoading = ref(false)
const dbMsg = ref('')
const dbMsgOk = ref(false)
const showSwitchDb = ref(false)
const showAddDb = ref(false)
// 删除确认弹窗
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref('')
const addForm = ref({ name: '', host: '', port: '3306', user: '', password: '', database: '' })
const addDbMsg = ref('')
const addDbOk = ref(false)
const addDbLoading = ref(false)

async function openSettings() {
  showSettings.value = true
  dbName.value = '加载中…'
  dbStatus.value = ''
  try {
    const res = await getDbInfo()
    if (res && res.success) {
      dbName.value = res.database
      dbStatus.value = res.status
    } else {
      dbName.value = '读取失败'
    }
  } catch (e) {
    dbName.value = '读取失败'
  }
}

// 打开切换弹窗并加载连接清单
async function openSwitchDb() {
  showSwitchDb.value = true
  dbMsg.value = ''
  await loadConnections()
}

async function loadConnections() {
  dbConnLoading.value = true
  try {
    const res = await getDbConnections()
    if (res && res.success) {
      dbConnections.value = res.list || []
      dbActive.value = res.active
    }
  } catch (e) {
    // 忽略读取异常
  } finally {
    dbConnLoading.value = false
  }
}

// 切换当前生效连接
async function onSwitchDb(id) {
  dbMsg.value = ''
  try {
    const res = await switchDb(id)
    if (res && res.success) {
      dbMsgOk.value = true
      dbMsg.value = res.message || '切换成功'
      dbActive.value = id
      // 刷新系统设置里的当前数据库显示
      const info = await getDbInfo()
      if (info && info.success) {
        dbName.value = info.database
        dbStatus.value = info.status
      }
      showSwitchDb.value = false
    } else {
      dbMsgOk.value = false
      dbMsg.value = (res && res.message) || '切换失败'
    }
  } catch (e) {
    dbMsgOk.value = false
    dbMsg.value = '切换过程出现异常，请重试'
  }
}

// 删除连接：当前在用连接禁止删除；至少保留一个（后端双重校验）
async function onDeleteDb(id) {
  dbMsg.value = ''
  // 阿里云为默认数据库，任何情况都禁止删除
  if (id === 'aliyun') {
    dbMsgOk.value = false
    dbMsg.value = '该数据库为默认数据库，禁止删除'
    return
  }
  // 其他数据库：当前正在使用的需先切换
  if (id === dbActive.value) {
    dbMsgOk.value = false
    dbMsg.value = '请先切换到其他连接再删除'
    return
  }
  // 弹出窗口式确认（替代原生 window.confirm）
  pendingDeleteId.value = id
  showDeleteConfirm.value = true
}

// 确认删除（弹窗「确认删除」按钮）
async function confirmDeleteDb() {
  const id = pendingDeleteId.value
  showDeleteConfirm.value = false
  pendingDeleteId.value = ''
  try {
    const res = await deleteDb(id)
    if (res && res.success) {
      dbMsgOk.value = true
      dbMsg.value = res.message || '删除成功'
      await loadConnections()
    } else {
      dbMsgOk.value = false
      dbMsg.value = (res && res.message) || '删除失败'
    }
  } catch (e) {
    dbMsgOk.value = false
    dbMsg.value = '删除过程出现异常，请重试'
  }
}

// 取消删除（弹窗「取消」按钮 / 点背景）
function cancelDeleteDb() {
  showDeleteConfirm.value = false
  pendingDeleteId.value = ''
}

// 打开添加弹窗
function openAddDb() {
  addForm.value = { name: '', host: '', port: '3306', user: '', password: '', database: '' }
  addDbMsg.value = ''
  addDbOk.value = false
  showAddDb.value = true
}

// 提交新增连接
async function onSubmitAddDb() {
  addDbMsg.value = ''
  const f = addForm.value
  if (!f.name.trim() || !f.host.trim() || !f.user.trim() || !f.database.trim()) {
    addDbMsg.value = '请填写名称、主机、账号与数据库名'
    addDbOk.value = false
    return
  }
  addDbLoading.value = true
  try {
    const res = await addDb({
      name: f.name.trim(),
      host: f.host.trim(),
      port: f.port ? Number(f.port) : 3306,
      user: f.user.trim(),
      password: f.password,
      database: f.database.trim()
    })
    if (res && res.success) {
      addDbOk.value = true
      addDbMsg.value = res.message || '添加成功'
      showAddDb.value = false
      // 若切换弹窗仍开着，刷新列表以显示新连接
      if (showSwitchDb.value) await loadConnections()
    } else {
      addDbOk.value = false
      addDbMsg.value = (res && res.message) || '添加失败'
    }
  } catch (e) {
    addDbOk.value = false
    addDbMsg.value = '添加过程出现异常，请重试'
  } finally {
    addDbLoading.value = false
  }
}
const termsSections = [
  {
    title: '一、账号使用',
    body: '本系统账号由管理员统一分配，仅限本人使用，严禁转借、共享或泄露给任何第三方。'
  },
  {
    title: '二、账号安全',
    body: '请妥善保管账号密码，如发现账号异常使用或密码泄露，请及时联系管理员重置密码。'
  },
  {
    title: '三、使用规范',
    body: '您在使用本系统过程中需遵守法律法规及公序良俗，不得利用本系统从事违法或损害他人权益的行为。'
  },
  {
    title: '四、行为监督',
    body: '管理员有权对账号使用行为进行监督，如发现违规使用，可暂停或终止账号权限。'
  },
  {
    title: '五、责任承担',
    body: '通过本账号进行的所有操作均视为您本人行为，需承担相应责任。'
  },
  {
    title: '六、条款更新',
    body: '本条款可根据实际需求更新，更新后继续使用本系统即视为接受新条款。'
  }
]

// 管理员联系方式弹窗
const showAdminContact = ref(false)

// 隐私协议弹窗
const showPrivacy = ref(false)
const privacySections = [
  {
    title: '一、我们收集的信息',
    body: '本系统仅收集您在使用时主动提供的账号信息（用户名 / 昵称）与登录密码。我们不会收集与系统运行无关的个人敏感信息。'
  },
  {
    title: '二、密码与凭证安全',
    body: '您的密码在服务器端经 bcrypt 算法加盐哈希后存储，系统中任何位置均不保存明文密码；登录校验为本地比对，凭证不会离开本机。'
  },
  {
    title: '三、数据存储位置',
    body: '所有业务数据保存在您本机部署的 MySQL 数据库中。本系统为纯本地桌面应用，默认不联网、不上传任何数据至外部服务器。'
  },
  {
    title: '四、登录会话',
    body: '登录态保存在本机浏览器本地存储（localStorage），有效期为 24 小时；超过有效期后需重新输入账号密码。您也可随时点击"退出登录"立即结束当前会话。'
  },
  {
    title: '五、信息共享',
    body: '我们不会将您的任何个人信息或业务数据出售、出租或共享给任何第三方。'
  },
  {
    title: '六、您的权利',
    body: '您有权查看与修改本人资料；账号删除将在数据库中硬删除相应记录。如对个人信息处理有疑问，可联系系统管理员。'
  }
]

async function onSubmit() {
  errorMsg.value = ''

  // 基础空值校验
  if (!username.value.trim()) {
    errorMsg.value = '请输入账号'
    return
  }
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return
  }

  loading.value = true
  try {
    const res = await login(username.value.trim(), password.value)
    if (res.success && res.user) {
      // 登录成功后延迟 2 秒再进入首页
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setSession(res.user)
      router.push('/')
    } else {
      errorMsg.value = res.message || '登录失败，请重试'
    }
  } catch (e) {
    errorMsg.value = '登录过程出现异常，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #eef2ff;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* 上：系统标题（居中、字体稍大） */
.login-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 22px 16px 18px;
  background: transparent;
}
.brand-mark {
  flex: 0 0 auto;
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.brand-title {
  margin: 0;
  font-size: 40px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #1d2129;
}

/* 中：简介（左） + 表单（右） */
.login-main {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
  padding: 40px 0;
}
.intro-panel {
  flex: 1 1 auto;
  position: relative;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
  margin-right: 12px;
  margin-left: 30px;
}
.intro-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.intro-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 22px 26px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
  color: #fff;
}
.intro-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.35;
  margin: 0 0 6px;
  color: #fff;
}
.intro-foot {
  margin: 0;
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.92);
}

/* 右：登录表单（固定较窄宽度，左右紧凑） */
.form-panel {
  flex: 0 0 380px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.login-card {
  width: 340px;
  max-width: 100%;
  background: #fff;
  border-radius: 12px;
  padding: 34px 30px;
  box-shadow: 0 8px 30px rgba(13, 128, 224, 0.12);
  display: flex; 
  flex-direction: column;     
  justify-content: center;
}
.card-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px;
}
.card-sub {
  font-size: 13px;
  color: #8a9099;
  margin: 0 0 20px;
}
.field-label {
  display: block;
  font-size: 13px;
  color: #4e5969;
  margin: 14px 0 6px;
}
.field-input {
  width: 100%;
  height: 42px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}
.field-input:focus {
  border-color: #0d80e0;
}
.error-msg {
  margin: 14px 0 0;
  font-size: 13px;
  color: #ea4335;
}
.submit-btn {
  width: 100%;
  height: 44px;
  margin-top: 22px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.submit-btn:hover {
  opacity: 0.92;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.forgot-tip {
  margin: 16px 0 0;
  font-size: 12px;
  color: #8a9099;
  text-align: center;
}
.admin-link {
  color: #42b883;
  cursor: pointer;
  text-decoration: underline;
}
.admin-link:hover {
  opacity: 0.8;
}

/* 下：页脚（上下两部分，均居中） */
.login-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 18px 16px 20px;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.footer-top {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}
.footer-link {
  background: none;
  border: none;
  padding: 0;
  color: #0d80e0;
  font-size: 13px;
  cursor: pointer;
  text-decoration: none;
}
.footer-link:hover {
  text-decoration: underline;
}
.footer-copy {
  margin: 0;
  font-size: 12px;
  color: #8a9099;
}

/* 隐私协议弹窗 */
.privacy-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.privacy-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}
.privacy-dialog {
  position: relative;
  z-index: 1;
  width: 560px;
  max-width: 92vw;
  max-height: 80vh;
  background: #fff;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.privacy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #eceff3;
}
.privacy-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1d2129;
}
.privacy-close {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: #f2f3f5;
  color: #4e5969;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s;
}
.privacy-close:hover {
  background: #e5e6eb;
}
.privacy-body {
  padding: 18px 22px;
  overflow-y: auto;
}
.privacy-lead {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
  margin: 0 0 8px;
}
.privacy-sec h4 {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
  margin: 16px 0 6px;
}
.privacy-sec p {
  font-size: 13px;
  line-height: 1.8;
  color: #4e5969;
  margin: 0 0 8px;
}

/* 系统设置：竖排信息列表 */
.sys-info-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}
.sys-info-row {
  display: flex;
  align-items: flex-start;
  padding: 12px 2px;
  border-bottom: 1px solid #f2f4f7;
  font-size: 14px;
}
.sys-info-row:last-child {
  border-bottom: none;
}
.sys-info-key {
  flex: 0 0 96px;
  color: #8a9099;
}
.sys-info-val {
  flex: 1;
  color: #1d2129;
  font-weight: 500;
  word-break: break-all;
}

/* 系统设置：状态标签与操作按钮 */
.db-status {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
}
.db-status.ok {
  color: #19a558;
}
.db-status.err {
  color: #ea4335;
}
.sys-info-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.sys-btn {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: #0d80e0;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}
.sys-btn:hover {
  opacity: 0.92;
}
.sys-btn.ghost {
  background: #fff;
  color: #0d80e0;
  border: 1px solid #0d80e0;
}

/* 切换数据库：连接列表 */
.conn-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 4px 0 14px;
}
.conn-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border: 1px solid #e6e9ee;
  border-radius: 8px;
  background: #fff;
}
.conn-item.active {
  border-color: #0d80e0;
  background: #f3f9ff;
}
.conn-main{
  width: 300px;
}
.conn-name {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
}
.conn-badge {
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 400;
  color: #fff;
  background: #0d80e0;
}
.conn-meta {
  font-size: 12px;
  color: #8a9099;
  margin-top: 2px;
}
/* 操作按钮组：整体靠右（配合 .conn-item 的 space-between，信息靠左、按钮靠右） */
.conn-actions {
  display: flex;
  gap: 10px;
}
.conn-switch {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 7px;
  background: #0d80e0;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.conn-switch:hover:not(:disabled) {
  opacity: 0.92;
}
.conn-switch:disabled {
  background: #c9d3df;
  cursor: not-allowed;
}
.conn-delete {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #f3c2bd;
  border-radius: 7px;
  background: #fff;
  color: #ea4335;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.conn-delete:hover {
  background: #fdecea;
}

/* 添加数据库表单 + 通用弹窗底部按钮 */
.form-row {
  margin-bottom: 14px;
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
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin: 18px 18px 10px 0;
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
  background: #ea4335;
  color: #fff;
}
.save-btn.danger:hover {
  opacity: 0.92;
}
/* 删除确认弹窗 */
.confirm-dialog {
  max-width: 360px;
}
.confirm-text {
  font-size: 14px;
  color: #4e5969;
  line-height: 1.6;
  margin: 10px 4px 4px;
}
</style>
