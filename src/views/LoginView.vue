<template>
  <div class="login-page" :style="{ backgroundImage: `url(${loginBg})` }">
    <!-- 上：系统标题 -->
    <header class="login-header">
      <img :src="logoUrl" class="brand-mark" alt="科研实验系统" />
      <h1 class="brand-title">科研实验系统</h1>
    </header>

    <!-- 中：简介（左） + 登录表单（右） -->
    <main class="login-main">
      <section class="intro-panel">
        <img :src="jianjieUrl" class="intro-image" alt="科研实验系统" />
        <div class="intro-overlay">
          <div class="intro-wrapper">

            <!-- 描述 -->
            <p class="intro-desc">
              赋予每一次路径规划以科学与精确
            </p>

            <!-- 三个核心功能亮点 -->
            <div class="intro-features">
              <div class="feature-item">
                <span class="feature-icon">🛤️</span>
                <div class="feature-info">
                  <span class="feature-label">最短路径计算</span>
                  <span class="feature-desc">地图API 或 自主路网</span>
                </div>
              </div>
              <div class="feature-item">
                <span class="feature-icon">📂</span>
                <div class="feature-info">
                  <span class="feature-label">路网导入</span>
                  <span class="feature-desc">支持自定义路网数据</span>
                </div>
              </div>
              <div class="feature-item">
                <span class="feature-icon">🗺️</span>
                <div class="feature-info">
                  <span class="feature-label">路径可视化</span>
                  <span class="feature-desc">计算结果直观呈现</span>
                </div>
              </div>
            </div>
            <!-- 使用说明 -->
            <div class="intro-usage">
              <p class="usage-title">📋 使用说明</p>
              <ul class="usage-list">
                <li>请使用管理员分配的账号和密码登录系统</li>
                <li>首次登录后建议及时修改初始密码</li>
                <li>如忘记密码，请联系系统管理员重置</li>
                <li>请勿将账号密码泄露给他人</li>
              </ul>
            </div>
          </div>
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

            <label class="agree-row">
              <input type="checkbox" v-model="agreed" class="agree-check" />
              <span class="agree-text">阅读并接受
                <span class="agree-link" @click="showTerms = true">服务条款</span>
                和
                <span class="agree-link" @click="showPrivacy = true">隐私协议</span>
              </span>
            </label>

            <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>

            <button class="submit-btn" type="submit" :disabled="loading || !agreed">
              {{ loading ? '登录中…' : '登 录' }}
            </button>

            <p class="forgot-tip">忘记密码请联系<span class="admin-link" @click="showAdminContact = true">管理员</span>重置</p>
          </form>

        </div>
      </section>
    </main>

    <!-- 下：页脚 -->
    <footer class="login-footer">
      <div class="footer-bottom">
        <p class="footer-copy">
          Copyright © 2025–{{ copyrightYear }} Scientific Experiment System
          <a href="https://github.com/yconghua" target="_blank" rel="noopener noreferrer">yconghua</a>
          All Rights Reserved.
          <button type="button" class="footer-link" @click="openSettings">Setting</button>
        </p>
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
          <p>（1）管理员联系方式：1509054114@qq.com</p>
          <p>（2）不用联系我，直接使用这个测试账号密码登入即可；</p>
          <p>账号是测试用户001，密码是123456</p>
          <p>（3）目前系统自带有一个阿里云MySQL云数据库（不允许被删除！）；</p>
          <p>如果您想使用自己电脑上面的MySQL数据库，请点击登录页面下方setting，进行数据库连接配置。</p>
          <p>最后，祝您生活越快。</p>
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
            更新日期：2026年8月25日
          </p>
          <p class="privacy-lead">
            科研实验系统（以下简称"本系统"）重视您的隐私。本隐私协议说明本系统在运行过程中如何收集、存储与使用您的信息。
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
            更新日期：2026年8月25日
          </p>
          <p class="privacy-lead">            
            欢迎使用科研实验系统（以下简称"本系统"）。本系统面向科研实验提供数据导入、路径计算与地图可视化等功能。使用前请仔细阅读以下服务条款，登录并使用本系统即视为您已同意本条款。
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
            <input v-model="addForm.database" class="field-input" type="text" placeholder="如：scientific_experiment_system_database" />
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
// 是否阅读并接受服务条款与隐私协议（每次启动需重新勾选）
const agreed = ref(false)

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
    title: '一、服务说明',
    body: '本系统为本地桌面应用，面向科研实验场景提供路网数据导入与管理、路径规划与最短路径计算、计算结果可视化展示等功能。系统功能随版本迭代可能优化调整，具体以实际界面为准。'
  },
  {
    title: '二、账号使用',
    body: '本系统账号由管理员统一分配与管理，仅限本人使用，严禁转借、共享或泄露给任何第三方。用户应对其账号下的所有操作行为承担全部责任。'
  },
  {
    title: '三、账号安全',
    body: '请妥善保管账号密码，建议定期更换密码。如发现账号被盗用或存在异常登录，应立即联系管理员进行冻结或重置密码，因用户自身原因导致账号泄露的后果由用户自行承担。'
  },
  {
    title: '四、使用规范',
    body: '用户使用本系统时须遵守中华人民共和国法律法规及公序良俗，不得利用本系统从事任何违法、违规或损害他人权益的活动，不得恶意干扰系统正常运行或破坏系统数据安全。'
  },
  {
    title: '五、数据责任',
    body: '用户应对导入本系统的所有数据（包括但不限于坐标、路网、地图配置、项目信息等）的合法性、真实性及准确性负责，确保数据来源正当、用途合规。因数据问题引发的任何纠纷或责任由用户自行承担。'
  },
  {
    title: '六、第三方服务',
    body: '本系统部分功能（如行政区域边界查询、在线地图底图加载、地图 API 距离计算等）依赖第三方在线服务。使用相关功能时，用户需同时遵守对应第三方服务商的条款与政策。'
  },
  {
    title: '七、行为监督',
    body: '管理员有权对账号使用行为进行监督，如发现违反本条款或法律法规的行为，可采取警告、暂停或终止账号权限等措施。'
  },
  {
    title: '八、责任承担',
    body: '通过本账号进行的所有操作均视为用户本人行为，用户需对其账号下的全部操作承担相应法律责任。'
  },
  {
    title: '九、知识产权',
    body: '本系统的软件代码、界面设计、文字、图片、标识等内容均受知识产权法律法规保护，未经书面许可，用户不得擅自复制、传播、修改或进行反向工程等行为。'
  },
  {
    title: '十、条款更新',
    body: '本条款可根据系统功能变化及法律法规要求进行调整，更新后的条款将在本页面公布。继续使用本系统即视为接受更新后的条款。'
  },
  {
    title: '十一、联系我们',
    body: '如您对本条款有任何疑问，请联系：1509054114@qq.com'
  }
]


// 管理员联系方式弹窗
const showAdminContact = ref(false)

// 隐私协议弹窗
const showPrivacy = ref(false)
const privacySections = [
  {
    title: '一、我们收集的信息',
    body: '本系统在运行过程中可能收集以下信息：账号信息（用户名、登录密码，密码经加密存储）；业务数据（您导入的项目信息、起终点坐标、路网数据、地图配置、计算结果等）；使用数据（操作日志、登录记录等），用于保障系统安全与稳定运行。'
  },
  {
    title: '二、信息使用目的',
    body: '我们收集的信息仅用于向您提供本系统的各项服务，包括路网管理、路径计算、结果展示、系统优化等。未经您的明确同意，我们不会将您的信息用于其他用途。'
  },
  {
    title: '三、信息存储与保护',
    body: '您的账号信息与业务数据均存储在您本机（或您指定的）MySQL 数据库中，由您自行管理。我们采用算法对密码进行加密存储，无法获知您的明文密码。同时我们采取符合业界标准的安全措施，防止信息被非法访问、泄露或损坏。'
  },
  {
    title: '四、联网与第三方服务',
    body: '本系统为本地桌面应用，但在使用行政区域边界查询、在线地图底图加载、地图 API 距离计算等功能时可能需要联网。通信时仅向第三方服务商传输功能所必需的少量数据（如城市编码、坐标点等），我们不会将您的个人信息共享给第三方用于其他目的。'
  },
  {
    title: '五、用户权利',
    body: '您有权查看、修改您的个人资料信息，有权删除您自行导入的业务数据。如您对个人信息处理有任何疑问或投诉，可通过下方联系方式联系我们。'
  },
  {
    title: '六、未成年人保护',
    body: '如您为未满 18 周岁的未成年人，请在法定监护人指导下阅读并决定是否接受本协议。'
  },
  {
    title: '七、协议更新',
    body: '本协议可根据法律法规变化或系统功能调整进行修订，更新后的协议将在本页面公布。继续使用本系统即视为接受更新后的协议。'
  },
  {
    title: '八、联系我们',
    body: '如您对本协议有任何疑问、意见或建议，请通过以下方式联系我们：电子邮箱 1509054114@qq.com'
  }
]

async function onSubmit() {
  errorMsg.value = ''

  // 必须先阅读并接受服务条款与隐私协议
  if (!agreed.value) {
    errorMsg.value = '请先阅读并接受服务条款和隐私协议'
    return
  }

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
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
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
  inset: 0;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.3);
  padding: 40px 44px;
}
.intro-wrapper {
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #1d2129;
}
.intro-desc {
  margin: 0 0 4px;
  font-size: 17px;
  line-height: 1.7;
  color: #1e2b3a;
  font-weight: 400;
  letter-spacing: 0.3px;
}
.intro-features {
  display: flex;
  gap: 18px;
  flex-wrap: wrap;
  margin: 4px 0;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: background 0.25s, box-shadow 0.25s;
  flex: 0 1 auto;
}
.feature-item:hover {
  background: #ffffff;
  box-shadow: 0 4px 12px rgba(13, 128, 224, 0.1);
}
.feature-icon {
  font-size: 22px;
  line-height: 1;
}
.feature-info {
  display: flex;
  flex-direction: column;
}
.feature-label {
  font-size: 14px;
  font-weight: 600;
  color: #1d2129;
  line-height: 1.3;
}
.feature-desc {
  font-size: 12px;
  color: #4a5b6e;
  line-height: 1.3;}

/* 使用说明 */
.intro-usage {
  margin: 8px 0 0;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 0, 0, 1);
}
.usage-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: rgba(5, 5, 5, 1);
  letter-spacing: 0.5px;
}
.usage-list {
  margin: 0;
  padding-left: 16px;
  list-style: none;
}
.usage-list li {
  position: relative;
  padding-left: 12px;
  font-size: 15px;
  line-height: 1.8;
  color: rgba(0, 0, 0, 1);
  letter-spacing: 0.3px;
}
.usage-list li::before {
  content: "·";
  position: absolute;
  left: 0;
  color: rgba(0, 0, 0, 1);
  font-weight: 700;
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
.agree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  font-size: 13px;
  color: #4e5969;
  cursor: pointer;
  user-select: none;
}
.agree-check {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  accent-color: #0d80e0;
}
.agree-text {
  line-height: 1.5;
}
.agree-link {
  color: #0d80e0;
  cursor: pointer;
  text-decoration: none;
}
.agree-link:hover {
  text-decoration: underline;
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
.footer-link {
  background: none;
  border: none;
  padding: 0;
  color: #8a9099;
  font-size: 12px;
  cursor: pointer;
  text-decoration: none;
  vertical-align: baseline;
}
.footer-link:hover {
  text-decoration: underline;
}
.footer-copy {
  margin: 0;
  font-size: 12px;
  color: #8a9099;
}
.footer-copy a {
  color: inherit;       
  text-decoration: none;   
}
.footer-copy a:hover {
  text-decoration: underline;
  cursor: pointer;   
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
