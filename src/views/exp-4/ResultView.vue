<template>
  <div class="module">
    <h2 class="module-title">计算结果</h2>
    <p class="module-tip">选择项目后按导入方式（路网 / API）设置参数并计算全组合路径距离。</p>

    <!-- 项目选择 -->
    <div class="project-pick">
      <label class="pick-label">项目</label>
      <select v-model="selectedProjectId" class="pick-select" :disabled="projectsLoading">
        <option value="">请选择项目</option>
        <option v-for="p in projects" :key="p.id" :value="p.id">
          {{ p.project_no }} · {{ p.name }}
        </option>
      </select>
      <span class="pick-current">
        当前项目：<b>{{ currentProject ? currentProject.project_no + ' · ' + currentProject.name : '未选择' }}</b>
      </span>
    </div>

    <!-- 未导入数据提示 -->
    <div v-if="selectedProjectId && importType === ''" class="placeholder-card">
      <p class="placeholder-text">该项目还没有地图数据导入记录，请先在「地图数据导入」中选择一种方式导入后再来计算。</p>
    </div>

    <!-- ==================== API 导入分支（独立，不与路网共用） ==================== -->
    <div v-if="selectedProjectId && importType === 'api'" class="param-card">
      <h3 class="param-title">API 算法参数设置</h3>
      <div class="form-row">
        <label class="form-label">API 平台</label>
        <span class="static-text">{{ apiInfo.platform || '—' }}</span>
      </div>
      <div class="form-row">
        <label class="form-label">API Key</label>
        <span class="static-text">{{ maskKey(apiInfo.key) || '—' }}</span>
      </div>
      <div class="form-row">
        <label class="form-label">基础网址</label>
        <span class="road-file-text" :title="apiInfo.url">{{ apiInfo.url || '—' }}</span>
      </div>
      <div class="form-row">
        <label class="form-label">URL 参数模板</label>
        <input
          v-model.trim="paramTemplate"
          class="form-input form-input-wide"
          type="text"
          placeholder="如 origin={lng1},{lat1}&destination={lng2},{lat2}&key={key}"
        />
      </div>
      <div class="form-row">
        <label class="form-label">完整 URL</label>
        <div class="road-file">
          <span class="road-file-text road-file-preview" :title="fullUrlPreview">{{ fullUrlPreview || '—' }}</span>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">并发数</label>
        <input v-model.number="apiConcurrency" class="form-input form-input-sm" type="number" min="1" max="50" />
        <span class="form-hint">同时请求数（1~50，默认 10）</span>
      </div>
      <div class="form-row">
        <label class="form-label">超时（秒）</label>
        <input v-model.number="apiTimeout" class="form-input form-input-sm" type="number" min="1" max="120" />
        <span class="form-hint">单个请求超时（1~120，默认 10）</span>
      </div>
      <div class="calc-actions">
        <button class="btn btn-submit btn-lg" :disabled="apiRunning" @click="onRunApiCalc">
          {{ apiRunning ? '计算中…' : '开始计算' }}
        </button>
        <p v-if="apiCalcError" class="form-error">{{ apiCalcError }}</p>
      </div>
    </div>

    <!-- API 分支进度（独立区块） -->
    <div v-if="apiRunning" class="progress-wrap">
      <div class="progress-track">
        <div class="progress-bar" :style="{ width: apiProgressPercent + '%' }"></div>
      </div>
      <div class="progress-text">
        <span>{{ apiStage || '计算中…' }}</span>
        <span v-if="apiProgress.total > 0">已完成 {{ apiProgress.done }} / 共 {{ apiProgress.total }} 对（{{ apiProgressPercent }}%）</span>
      </div>
    </div>

    <!-- API 分支结果（独立模板，展示 calc_result） -->
    <div v-if="selectedProjectId && importType === 'api'" class="result-section">
      <div class="list-head">
        <h3 class="list-title">计算结果</h3>
        <button class="btn btn-danger-ghost" :disabled="records.length === 0" @click="openClear">清除</button>
      </div>
      <div v-if="batchRows.length" class="batch-bar">
        <span class="batch-item">批次：<b>{{ currentBatchNo }}</b></span>
        <span class="batch-item">时间：{{ fmtTime(records[0].created_at) }}</span>
        <span class="batch-item">总对数：<b>{{ batchSummary.total }}</b></span>
        <span class="batch-item ok">成功：{{ batchSummary.ok }}</span>
        <span class="batch-item fail">失败：{{ batchSummary.fail }}</span>
        <span class="batch-item">总里程：<b>{{ batchSummary.totalKm }} km</b></span>
        <span v-if="batchSummary.totalDur > 0" class="batch-item">总时长：<b>{{ batchSummary.totalDur }} 秒</b></span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 60px">序号</th>
              <th>起点</th>
              <th>终点</th>
              <th style="width: 130px">距离</th>
              <th style="width: 110px">时长</th>
              <th style="width: 90px">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in pagedRows" :key="row.id">
              <td>{{ (currentPage - 1) * PAGE_SIZE + i + 1 }}</td>
              <td>{{ coordLabel(row.from_name, row.from_lng, row.from_lat) }}</td>
              <td>{{ coordLabel(row.to_name, row.to_lng, row.to_lat) }}</td>
              <td>{{ fmtKm(row.distance) }}</td>
              <td>{{ fmtDuration(row.duration) }}</td>
              <td>
                <span class="status" :class="row.status === 'ok' ? 'status-ok' : 'status-fail'">
                  {{ row.status === 'ok' ? '成功' : '失败' }}
                </span>
              </td>
            </tr>
            <tr v-if="pagedRows.length === 0">
              <td colspan="6" class="empty-cell">暂无计算结果，请点击开始计算</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pager">
        <button class="pager-btn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
        <span class="pager-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button class="pager-btn" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
      </div>
    </div>

    <!-- ==================== 路网导入分支（独立，不与 API 共用） ==================== -->
    <div v-if="selectedProjectId && importType === 'road'" class="param-card">
      <h3 class="param-title">算法参数设置</h3>
      <div class="form-row">
        <label class="form-label">并发数</label>
        <input v-model.number="concurrency" class="form-input form-input-sm" type="number" min="1" max="100" />
        <span class="form-hint">同时进行的请求数（1~100，默认 20）</span>
      </div>
      <div class="form-row">
        <label class="form-label">OSRM 端口</label>
        <input v-model.number="port" class="form-input form-input-sm" type="number" min="1" max="65535" />
        <span class="form-hint">本机 OSRM 路由服务端口（默认 5000）</span>
      </div>
      <div class="form-row">
        <label class="form-label">路网文件</label>
        <div class="road-file">
          <span class="road-file-text" :title="roadFile">{{ roadFile || '该项目暂无路网导入记录' }}</span>
          <span v-if="roadFile" class="badge">{{ roadFile.endsWith('.pbf') || roadFile.endsWith('.osm') ? '原始文件（自动预处理）' : '未知格式' }}</span>
        </div>
      </div>
      <div class="calc-actions">
        <button class="btn btn-submit btn-lg" :disabled="running" @click="onRunCalc">
          {{ running ? '计算中…' : '开始计算' }}
        </button>
        <p v-if="calcError" class="form-error">{{ calcError }}</p>
      </div>
    </div>

    <!-- 路网分支进度（独立区块） -->
    <div v-if="running" class="progress-wrap">
      <div class="progress-track">
        <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
      </div>
      <div class="progress-text">
        <span>{{ stage || '计算中…' }}</span>
        <span v-if="progress.total > 0">已完成 {{ progress.done }} / 共 {{ progress.total }} 对（{{ progressPercent }}%）</span>
      </div>
    </div>

    <!-- 路网分支结果（独立模板，展示 calc_result） -->
    <div v-if="selectedProjectId && importType === 'road'" class="result-section">
      <div class="list-head">
        <h3 class="list-title">计算结果</h3>
        <button class="btn btn-danger-ghost" :disabled="records.length === 0" @click="openClear">清除</button>
      </div>
      <div v-if="batchRows.length" class="batch-bar">
        <span class="batch-item">批次：<b>{{ currentBatchNo }}</b></span>
        <span class="batch-item">时间：{{ fmtTime(records[0].created_at) }}</span>
        <span class="batch-item">总对数：<b>{{ batchSummary.total }}</b></span>
        <span class="batch-item ok">成功：{{ batchSummary.ok }}</span>
        <span class="batch-item fail">失败：{{ batchSummary.fail }}</span>
        <span class="batch-item">总里程：<b>{{ batchSummary.totalKm }} km</b></span>
        <span v-if="batchSummary.totalDur > 0" class="batch-item">总时长：<b>{{ batchSummary.totalDur }} 秒</b></span>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 60px">序号</th>
              <th>起点</th>
              <th>终点</th>
              <th style="width: 130px">距离</th>
              <th style="width: 110px">时长</th>
              <th style="width: 90px">状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in pagedRows" :key="row.id">
              <td>{{ (currentPage - 1) * PAGE_SIZE + i + 1 }}</td>
              <td>{{ coordLabel(row.from_name, row.from_lng, row.from_lat) }}</td>
              <td>{{ coordLabel(row.to_name, row.to_lng, row.to_lat) }}</td>
              <td>{{ fmtKm(row.distance) }}</td>
              <td>{{ fmtDuration(row.duration) }}</td>
              <td>
                <span class="status" :class="row.status === 'ok' ? 'status-ok' : 'status-fail'">
                  {{ row.status === 'ok' ? '成功' : '失败' }}
                </span>
              </td>
            </tr>
            <tr v-if="pagedRows.length === 0">
              <td colspan="6" class="empty-cell">暂无计算结果，请点击开始计算</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pager">
        <button class="pager-btn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
        <span class="pager-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button class="pager-btn" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
      </div>
    </div>

    <!-- 清除确认弹窗（两种导入共用：同一张结果表） -->
    <div v-if="clearVisible" class="modal-mask" @click.self="closeClear">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3 class="modal-title">清除计算结果</h3>
          <button class="modal-close" @click="closeClear">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-text">确定要清除该项目的全部计算结果吗？</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-cancel" @click="closeClear">取消</button>
          <button class="btn btn-danger" :disabled="clearing" @click="confirmClear">
            {{ clearing ? '清除中…' : '确定清除' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 轻提示 -->
    <transition name="fade">
      <div v-if="toast.msg" class="toast" :class="toast.type">{{ toast.msg }}</div>
    </transition>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  listProjects,
  listMapData,
  runCalc,
  runApiCalc,
  listCalcResults,
  clearCalcResults,
  onCalcProgress
} from '../../api'

const PAGE_SIZE = 10

// 各平台默认 URL 参数模板（前端内置，切换平台自动带出、可手动修改）
const PLATFORM_TEMPLATES = {
  高德地图: 'origin={lng1},{lat1}&destination={lng2},{lat2}&key={key}',
  百度地图: 'origin={lat1},{lng1}&destination={lat2},{lng2}&ak={key}',
  腾讯地图: 'from={lat1},{lng1}&to={lat2},{lng2}&key={key}',
  天地图: 'orig={lat1},{lng1}&dest={lat2},{lng2}&key={key}'
}

const projects = ref([])
const projectsLoading = ref(false)
const selectedProjectId = ref('')
// 当前项目的导入类型：'api' / 'road' / ''（未导入）
const importType = ref('')

// 路网分支参数与状态
const concurrency = ref(20)
const port = ref(5000)
const roadFile = ref('')
const running = ref(false)
const stage = ref('')
const progress = reactive({ done: 0, total: 0 })
const calcError = ref('')

// API 分支参数与状态（独立，不与路网共用）
const apiInfo = reactive({ platform: '', key: '', url: '' })
const paramTemplate = ref('')
const apiConcurrency = ref(10)
const apiTimeout = ref(10)
const apiRunning = ref(false)
const apiStage = ref('')
const apiProgress = reactive({ done: 0, total: 0 })
const apiCalcError = ref('')

// 结果（calc_result 同一张表，两种导入共用数据源）
const records = ref([])
const listLoading = ref(false)
const page = ref(1)

const currentProject = computed(() =>
  projects.value.find((p) => String(p.id) === String(selectedProjectId.value)) || null
)

// 路网进度
const progressPercent = computed(() => {
  if (progress.total <= 0) return 0
  return Math.min(100, Math.round((progress.done / progress.total) * 100))
})
// API 进度
const apiProgressPercent = computed(() => {
  if (apiProgress.total <= 0) return 0
  return Math.min(100, Math.round((apiProgress.done / apiProgress.total) * 100))
})

// 完整 URL 预览（与后端 buildFullUrl 逻辑一致）
const fullUrlPreview = computed(() => {
  const base = (apiInfo.url || '').trim()
  const tpl = (paramTemplate.value || '').trim()
  if (!base || !tpl) return ''
  if (tpl.startsWith('?')) return base + tpl
  return base.includes('?') ? base + '&' + tpl : base + '?' + tpl
})

// 最新批次与汇总（两种导入共用）
const currentBatchNo = computed(() => (records.value.length ? records.value[0].batch_no : ''))
const batchRows = computed(() =>
  records.value.filter((r) => r.batch_no === currentBatchNo.value)
)
const batchSummary = computed(() => {
  let ok = 0
  let fail = 0
  let totalKm = 0
  let totalDur = 0
  for (const r of batchRows.value) {
    if (r.status === 'ok' && r.distance != null) {
      ok++
      totalKm += Number(r.distance) / 1000
      if (r.duration != null) totalDur += Number(r.duration)
    } else {
      fail++
    }
  }
  return {
    total: batchRows.value.length,
    ok,
    fail,
    totalKm: Math.round(totalKm * 1000) / 1000,
    totalDur: Math.round(totalDur)
  }
})

const totalPages = computed(() => Math.max(1, Math.ceil(batchRows.value.length / PAGE_SIZE)))
const currentPage = computed(() => Math.min(page.value, totalPages.value))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return batchRows.value.slice(start, start + PAGE_SIZE)
})

function fmtTime(s) {
  return s ? String(s).slice(0, 16) : '—'
}
function fmtKm(d) {
  if (d === null || d === undefined || d === '') return '—'
  return (Number(d) / 1000).toFixed(3) + ' km'
}
function fmtDuration(d) {
  if (d === null || d === undefined || d === '') return '—'
  return Math.round(Number(d)) + ' 秒'
}
function coordLabel(name, lng, lat) {
  const parts = []
  if (name) parts.push(name)
  if (lng !== null && lng !== undefined && lat !== null && lat !== undefined) {
    parts.push(`${Number(lng)},${Number(lat)}`)
  }
  return parts.join(' · ') || '—'
}
function maskKey(key) {
  if (!key) return ''
  return '****' + String(key).slice(-4)
}
function goPage(n) {
  page.value = Math.min(Math.max(1, n), totalPages.value)
}

// -------------------- 数据加载 --------------------
async function loadProjects() {
  projectsLoading.value = true
  try {
    const res = await listProjects()
    if (res && res.success) {
      projects.value = res.projects || []
    }
  } catch (e) {
    showToast('error', '读取项目列表失败')
  } finally {
    projectsLoading.value = false
  }
}

// 判断当前项目导入类型，并带出对应参数（API 分支取 api 记录 + 平台默认模板；路网分支取路网文件）
async function loadImportType() {
  importType.value = ''
  roadFile.value = ''
  apiInfo.platform = ''
  apiInfo.key = ''
  apiInfo.url = ''
  paramTemplate.value = ''
  if (!selectedProjectId.value) return
  try {
    const [apiRes, roadRes] = await Promise.all([
      listMapData(selectedProjectId.value, 'api'),
      listMapData(selectedProjectId.value, 'road')
    ])
    if (apiRes && apiRes.success && (apiRes.records || []).length > 0) {
      importType.value = 'api'
      const r = apiRes.records[0]
      apiInfo.platform = r.api_platform || ''
      apiInfo.key = r.api_key || ''
      apiInfo.url = r.api_url || ''
      paramTemplate.value = PLATFORM_TEMPLATES[apiInfo.platform] || ''
    } else if (roadRes && roadRes.success && (roadRes.records || []).length > 0) {
      importType.value = 'road'
      const r = roadRes.records[0]
      roadFile.value = r.road_file_copy_path || r.road_file_path || ''
    }
  } catch (e) {
    // 忽略
  }
}

async function loadResults() {
  if (!selectedProjectId.value) {
    records.value = []
    return
  }
  listLoading.value = true
  page.value = 1
  try {
    const res = await listCalcResults(selectedProjectId.value)
    if (res && res.success) {
      records.value = res.records || []
    } else {
      records.value = []
      showToast('error', (res && res.message) || '读取计算结果失败')
    }
  } catch (e) {
    records.value = []
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    listLoading.value = false
  }
}

watch(selectedProjectId, () => {
  calcError.value = ''
  apiCalcError.value = ''
  progress.done = 0
  progress.total = 0
  apiProgress.done = 0
  apiProgress.total = 0
  loadImportType()
  loadResults()
})

// -------------------- 路网计算（独立） --------------------
async function onRunCalc() {
  if (!selectedProjectId.value) {
    calcError.value = '请先选择项目'
    return
  }
  if (importType.value !== 'road') {
    calcError.value = '仅路网导入的项目支持当前计算'
    return
  }
  const c = Number(concurrency.value)
  if (!Number.isInteger(c) || c < 1 || c > 100) {
    calcError.value = '并发数需为 1~100 的整数'
    return
  }
  const pt = Number(port.value)
  if (!Number.isInteger(pt) || pt < 1 || pt > 65535) {
    calcError.value = '端口需为 1~65535 的整数'
    return
  }
  calcError.value = ''
  running.value = true
  stage.value = '正在准备…'
  progress.done = 0
  progress.total = 0
  try {
    const res = await runCalc({ project_id: selectedProjectId.value, concurrency: c, port: pt })
    if (res && res.success) {
      showToast('success', res.message || '计算完成')
      await loadResults()
    } else {
      calcError.value = (res && res.message) || '计算失败'
      showToast('error', (res && res.message) || '计算失败')
    }
  } catch (e) {
    calcError.value = '网络或数据库异常，请稍后重试'
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    running.value = false
    stage.value = ''
  }
}

// -------------------- API 计算（独立） --------------------
async function onRunApiCalc() {
  if (!selectedProjectId.value) {
    apiCalcError.value = '请先选择项目'
    return
  }
  if (importType.value !== 'api') {
    apiCalcError.value = '仅 API 导入的项目支持当前计算'
    return
  }
  if (!paramTemplate.value) {
    apiCalcError.value = '请填写 URL 参数模板'
    return
  }
  const c = Number(apiConcurrency.value)
  if (!Number.isInteger(c) || c < 1 || c > 50) {
    apiCalcError.value = '并发数需为 1~50 的整数'
    return
  }
  const t = Number(apiTimeout.value)
  if (!Number.isInteger(t) || t < 1 || t > 120) {
    apiCalcError.value = '超时需为 1~120 的整数'
    return
  }
  apiCalcError.value = ''
  apiRunning.value = true
  apiStage.value = '正在准备…'
  apiProgress.done = 0
  apiProgress.total = 0
  try {
    const res = await runApiCalc({
      project_id: selectedProjectId.value,
      param_template: paramTemplate.value,
      concurrency: c,
      timeout: t
    })
    if (res && res.success) {
      showToast('success', res.message || '计算完成')
      await loadResults()
    } else {
      apiCalcError.value = (res && res.message) || '计算失败'
      showToast('error', (res && res.message) || '计算失败')
    }
  } catch (e) {
    apiCalcError.value = '网络或数据库异常，请稍后重试'
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    apiRunning.value = false
    apiStage.value = ''
  }
}

// -------------------- 清除（软删除该项目全部结果） --------------------
const clearVisible = ref(false)
const clearing = ref(false)
function openClear() {
  if (records.value.length === 0) return
  clearVisible.value = true
}
function closeClear() {
  if (clearing.value) return
  clearVisible.value = false
}
async function confirmClear() {
  clearing.value = true
  try {
    const res = await clearCalcResults(selectedProjectId.value)
    if (res && res.success) {
      showToast('success', res.message || '计算结果已清除')
      clearVisible.value = false
      await loadResults()
    } else {
      showToast('error', (res && res.message) || '清除失败')
    }
  } catch (e) {
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    clearing.value = false
  }
}

// -------------------- 进度事件（按当前激活分支分发） --------------------
let unsubProgress = null
onMounted(() => {
  loadProjects()
  unsubProgress = onCalcProgress((data) => {
    if (!data) return
    if (apiRunning.value) {
      if (data.stage) apiStage.value = data.stage
      if (typeof data.done === 'number' && typeof data.total === 'number') {
        apiProgress.done = data.done
        apiProgress.total = data.total
      }
    } else if (running.value) {
      if (data.stage) stage.value = data.stage
      if (typeof data.done === 'number' && typeof data.total === 'number') {
        progress.done = data.done
        progress.total = data.total
      }
    }
  })
})
onUnmounted(() => {
  if (unsubProgress) unsubProgress()
})

// -------------------- 轻提示 --------------------
const toast = reactive({ type: '', msg: '' })
let toastTimer = null
function showToast(type, msg) {
  toast.type = type
  toast.msg = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.msg = '' }, 2600)
}
</script>

<style scoped>
.module {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  height: auto;
}
.module-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
}
.module-tip {
  font-size: 13px;
  color: #8a9099;
  margin: 0 0 18px;
}

/* 项目选择 */
.project-pick {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px 16px;
  background: #f7f9fc;
  border-radius: 8px;
}
.pick-label {
  font-size: 14px;
  color: #4a5260;
  flex: none;
}
.pick-select {
  height: 34px;
  width: 220px;
  padding: 0 10px;
  border: 1px solid #d7dce3;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  outline: none;
}
.pick-select:focus {
  border-color: #0d80e0;
}
.pick-current {
  font-size: 14px;
  color: #4a5260;
}
.pick-current b {
  color: #0d80e0;
}

/* 占位卡片（未导入） */
.placeholder-card {
  margin-bottom: 18px;
  padding: 36px 20px;
  border: 1px dashed #c8d0da;
  border-radius: 8px;
  background: #fafbfc;
  text-align: center;
}
.placeholder-text {
  font-size: 14px;
  color: #8a9099;
  margin: 0;
}

/* 参数卡片 */
.param-card {
  margin-bottom: 18px;
  padding: 16px 18px;
  border: 1px solid #eceff3;
  border-radius: 8px;
}
.param-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 14px;
}
.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.form-label {
  flex: 0 0 110px;
  font-size: 14px;
  color: #1f2329;
  text-align: right;
}
.form-input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid #dfe3e8;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus {
  border-color: #0d80e0;
}
.form-input-sm {
  width: 90px;
}
.form-input-wide {
  flex: 1;
  min-width: 0;
  max-width: 520px;
}
.form-hint {
  font-size: 13px;
  color: #8a9099;
}
.static-text {
  font-size: 14px;
  color: #1f2329;
}
.road-file {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.road-file-text {
  font-size: 13px;
  color: #5b6470;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.road-file-preview {
  color: #0d80e0;
}
.badge {
  flex: none;
  font-size: 12px;
  color: #0d80e0;
  background: #eaf4fd;
  border-radius: 4px;
  padding: 2px 8px;
}
.calc-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-left: 122px;
  margin-top: 6px;
}
.form-error {
  font-size: 13px;
  color: #f53f3f;
  margin: 0;
}

/* 进度 */
.progress-wrap {
  margin-bottom: 18px;
  padding: 14px 16px;
  background: #f7f9fc;
  border-radius: 8px;
}
.progress-track {
  height: 8px;
  background: #e6ebf1;
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #0d80e0, #19a558);
  border-radius: 4px;
  transition: width 0.25s;
}
.progress-text {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 13px;
  color: #4a5260;
}

/* 结果区 */
.result-section {
  border-top: 1px solid #eceff3;
  padding-top: 18px;
}
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.list-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}
.batch-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-bottom: 12px;
  padding: 10px 14px;
  background: #f7f9fc;
  border-radius: 8px;
  font-size: 13px;
  color: #4a5260;
}
.batch-item b {
  color: #1f2329;
}
.batch-item.ok {
  color: #21a366;
}
.batch-item.fail {
  color: #e0483b;
}
.table-wrap {
  border: 1px solid #eceff3;
  border-radius: 8px;
  overflow: hidden;
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
.data-table thead th {
  background: #f7f9fc;
  color: #4a5260;
  font-weight: 600;
}
.data-table tbody tr:hover {
  background: #fafbfd;
}
.data-table tbody tr:last-child td {
  border-bottom: none;
}
.empty-cell {
  text-align: center;
  color: #9aa2ad;
  padding: 32px 0;
}
.status {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 13px;
}
.status-ok {
  color: #21a366;
  background: #e8f7ef;
}
.status-fail {
  color: #e0483b;
  background: #fdecec;
}

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
  justify-content: flex-end;
}
.pager-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #d7dce3;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}
.pager-btn:disabled {
  color: #b9c0ca;
  cursor: not-allowed;
}
.pager-btn:not(:disabled):hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.pager-info {
  font-size: 14px;
  color: #5b6470;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(20, 30, 45, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  width: 380px;
  max-width: calc(100vw - 32px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f2f5;
}
.modal-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}
.modal-close {
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  color: #9aa2ad;
  cursor: pointer;
}
.modal-body {
  padding: 18px 20px;
}
.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid #f0f2f5;
}
.confirm-text {
  font-size: 14px;
  line-height: 1.6;
  color: #4a5260;
  margin: 0;
}

/* 按钮 */
.btn {
  height: 34px;
  padding: 0 16px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
}
.btn-lg {
  height: 38px;
  padding: 0 30px;
  font-weight: 600;
}
.btn-submit {
  background: #0d80e0;
  color: #fff;
}
.btn-submit:hover:not(:disabled) {
  opacity: 0.92;
}
.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-cancel {
  background: #fff;
  border-color: #d7dce3;
  color: #4a5260;
}
.btn-cancel:hover {
  border-color: #b9c0ca;
}
.btn-danger {
  background: #e0483b;
  color: #fff;
}
.btn-danger:hover:not(:disabled) {
  opacity: 0.92;
}
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-danger-ghost {
  background: #fff;
  border: 1px solid #e0483b;
  color: #e0483b;
}
.btn-danger-ghost:hover:not(:disabled) {
  background: #fdecec;
}
.btn-danger-ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 轻提示 */
.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 18px;
  border-radius: 8px;
  font-size: 14px;
  color: #fff;
  z-index: 200;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}
.toast.success {
  background: #21a366;
}
.toast.error {
  background: #e0483b;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
