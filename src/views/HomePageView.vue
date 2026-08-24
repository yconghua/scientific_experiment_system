<template>
  <div class="hp">
    <!-- ① 顶部横幅：问候语 + 日期 + 系统名/版本 + 当前账号 -->
    <section class="hp-hero">
      <div class="hp-hero-inner">
        <h1 class="hp-greeting">{{ greeting }}，{{ displayName }}</h1>
        <p class="hp-date">{{ todayText }}</p>
        <p class="hp-sys">{{ sysName }}<span v-if="sysVersion"> · v{{ sysVersion }}</span><!--<span v-if="accountName"> · 当前账号：{{ accountName }}</span>--></p>
      </div>
    </section>

    <!-- ② 项目列表与进度（实时拉数据，仅展示，不跳转） -->
    <section class="hp-section">
      <div class="hp-section-head">
        <h2 class="hp-section-title">项目进度</h2>
        <button class="hp-refresh" :disabled="loading" @click="loadAll">{{ loading ? '加载中…' : '↻ 刷新' }}</button>
      </div>

      <p v-if="loading" class="hp-tip">正在加载项目数据…</p>
      <p v-else-if="!displayProjects.length" class="hp-tip">还没有项目，点击下方「新建项目」开始创建。</p>

      <div v-else class="proj-list">
        <div v-for="p in pageProjects" :key="p.id" class="proj-card">
          <!-- 左：项目信息 -->
          <div class="proj-info">
            <div class="proj-name">{{ p.project_no || '' }}<template v-if="p.name"> · {{ p.name }}</template></div>
            <div class="proj-meta">
              <span v-if="p.city_name">城市：{{ p.city_name }}（{{ String(p.city_code || '').padEnd(6, '0') }}）</span>
              <span v-if="p.created_at">创建：{{ fmtDate(p.created_at) }}</span>
            </div>
          </div>

          <!-- 右：进度步骤 + 进度条 -->
          <div class="proj-progress">
            <div class="steps">
              <div
                v-for="(s, i) in STAGES"
                :key="s.key"
                class="step"
                :class="{ done: !!p.prog[s.key] }"
              >
                <div class="step-dot">{{ p.prog[s.key] ? '✓' : i + 1 }}</div>
                <div class="step-label">{{ s.label }}</div>
              </div>
            </div>
            <div class="prog-bar">
              <div class="prog-fill" :style="{ width: (p.prog.percent || 0) + '%' }"></div>
            </div>
            <div class="prog-text">完成度 {{ p.prog.doneCount || 0 }}/{{ STAGES.length }}（{{ p.prog.percent || 0 }}%）</div>
          </div>
        </div>
      </div>

      <!-- 分页：每页 2 个项目 -->
      <div v-if="displayProjects.length > pageSize" class="pager">
        <button class="pager-btn" :disabled="page <= 1" @click="goPage(-1)">‹ 上一页</button>
        <span class="pager-info">共 {{ displayProjects.length }} 个项目 · 第 {{ page }} / {{ totalPages }} 页</span>
        <button class="pager-btn" :disabled="page >= totalPages" @click="goPage(1)">下一页 ›</button>
      </div>
    </section>

    <!-- ③ 功能模块快捷入口（可跳转） -->
    <section class="hp-section">
      <h2 class="hp-section-title">快捷入口</h2>
      <div class="entry-grid">
        <div class="entry-card" @click="go('/exp-11')">
          <div class="entry-icon entry-icon-blue">＋</div>
          <div class="entry-name">新建项目</div>
          <div class="entry-desc">创建新的科研项目</div>
        </div>
        <div class="entry-card" @click="go('/exp-42')">
          <div class="entry-icon entry-icon-green">◎</div>
          <div class="entry-name">可视化</div>
          <div class="entry-desc">查看行政区域与路网</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  listProjects,
  listMapData,
  listCoordData,
  listCalcResults,
  getSysInfo
} from '../api'
import { getSessionUser } from '../session'

const router = useRouter()

// ---------- ① 横幅数据 ----------
const greeting = ref('')
const todayText = ref('')
const accountName = ref('')
const displayName = ref('')
const sysName = ref('科研实验系统')
const sysVersion = ref('')
const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function buildHero() {
  const d = new Date()
  const h = d.getHours()
  greeting.value = h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好'
  todayText.value = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${WEEK[d.getDay()]}`
}

async function loadSysInfo() {
  try {
    const res = await getSysInfo()
    if (res && res.success) {
      sysName.value = res.name || sysName.value
      sysVersion.value = res.version || ''
    }
  } catch (e) {
    // 忽略：系统名保持默认
  }
}

// ---------- ② 项目列表与进度 ----------
const loading = ref(false)
const projects = ref([])
const progressMap = reactive({})

// 工作流阶段（与导航工作流一致）
const STAGES = [
  { key: 'imported', label: '地图导入' },
  { key: 'hasStart', label: '起点坐标' },
  { key: 'hasEnd', label: '终点坐标' },
  { key: 'calcDone', label: '运行计算' },
  { key: 'vizReady', label: '可视化' }
]

// 判断某接口返回是否「有记录」
function ok(res) {
  return !!(res && res.success && Array.isArray(res.records) && res.records.length > 0)
}

// 拉取单个项目的阶段完成情况（并行调用 5 个接口）
async function fetchProgress(p) {
  const id = String(p.id)
  const [apiRes, roadRes, startRes, endRes, calcRes] = await Promise.all([
    listMapData(id, 'api'),
    listMapData(id, 'road'),
    listCoordData(id, 'start'),
    listCoordData(id, 'end'),
    listCalcResults(id)
  ])
  const imported = ok(apiRes) || ok(roadRes)
  const hasStart = ok(startRes)
  const hasEnd = ok(endRes)
  const calcDone = ok(calcRes)
  const vizReady = imported && hasStart && hasEnd
  const flags = { imported, hasStart, hasEnd, calcDone, vizReady }
  const doneCount = Object.values(flags).filter(Boolean).length
  progressMap[id] = {
    ...flags,
    doneCount,
    percent: Math.round((doneCount / STAGES.length) * 100)
  }
}

async function loadAll() {
  loading.value = true
  page.value = 1
  try {
    const res = await listProjects()
    if (res && res.success) {
      projects.value = res.projects || []
      // 每个项目互不影响，单个失败不阻塞整体
      await Promise.all(projects.value.map((p) => fetchProgress(p).catch(() => {})))
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 合并项目 + 进度，供模板直接使用
const displayProjects = computed(() =>
  projects.value.map((p) => ({
    ...p,
    prog: progressMap[String(p.id)] || { doneCount: 0, percent: 0 }
  }))
)

// ---------- 分页：每页 2 个项目 ----------
const page = ref(1)
const pageSize = 2
const totalPages = computed(() => Math.max(1, Math.ceil(displayProjects.value.length / pageSize)))
const pageProjects = computed(() => {
  const start = (page.value - 1) * pageSize
  return displayProjects.value.slice(start, start + pageSize)
})

// 数据变化后修正页码（防止超出总页数）
watch(totalPages, (t) => {
  if (page.value > t) page.value = t
})

function goPage(delta) {
  const target = page.value + delta
  if (target >= 1 && target <= totalPages.value) page.value = target
}

function fmtDate(v) {
  if (!v) return ''
  if (typeof v === 'number') return new Date(v).toLocaleDateString('zh-CN')
  return String(v).slice(0, 10)
}

// ---------- ③ 快捷入口 ----------
function go(path) {
  router.push(path)
}

onMounted(() => {
  buildHero()
  const user = getSessionUser()
  if (user) {
    accountName.value = user.username || ''
    displayName.value = user.real_name || user.username || ''
  }
  loadSysInfo()
  loadAll()
})
</script>

<style scoped>
.hp {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ① 顶部横幅 */
.hp-hero {
  position: relative;
  overflow: hidden;
  text-align: center;
  padding: 38px 20px 34px;
  border-radius: 16px;
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  box-shadow: 0 10px 28px rgba(13, 128, 224, 0.22);
}
.hp-hero::after {
  content: '';
  position: absolute;
  right: -60px;
  top: -60px;
  width: 200px;
  height: 200px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 50%;
}
.hp-greeting {
  position: relative;
  margin: 0;
  font-size: 30px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 1px;
}
.hp-date {
  position: relative;
  margin: 10px 0 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}
.hp-sys {
  position: relative;
  margin: 14px 0 0;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
}

/* ② 区块标题与刷新 */
.hp-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.hp-section-title {
  margin: 0 0 10px 0;
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
}
.hp-refresh {
  border: 1px solid #d0d3d9;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.hp-refresh:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.hp-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.hp-tip {
  margin: 0;
  font-size: 14px;
  color: #8a9099;
}

/* 分页条 */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 6px;
}
.pager-btn {
  border: 1px solid #d0d3d9;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 6px;
  cursor: pointer;
}
.pager-btn:hover:not(:disabled) {
  border-color: #0d80e0;
  color: #0d80e0;
}
.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.pager-info {
  font-size: 13px;
  color: #4e5969;
}

/* 项目卡片 */
.proj-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.proj-card {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px 24px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  padding: 16px 18px;
}
.proj-info {
  flex: 1 1 240px;
  min-width: 200px;
}
.proj-name {
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
}
.proj-meta {
  margin-top: 6px;
  font-size: 13px;
  color: #8a9099;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
}

/* 进度步骤 */
.proj-progress {
  flex: 2 1 320px;
  min-width: 280px;
}
.steps {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #86909c;
  background: #f2f3f5;
  border: 1px solid #c9cdd4;
}
.step.done .step-dot {
  background: #19a558;
  border-color: #19a558;
  color: #fff;
}
.step-label {
  font-size: 12px;
  color: #86909c;
  white-space: nowrap;
}
.step.done .step-label {
  color: #19a558;
}

/* 进度条 */
.prog-bar {
  margin-top: 10px;
  height: 6px;
  border-radius: 3px;
  background: #f2f3f5;
  overflow: hidden;
}
.prog-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #0d80e0, #19a558);
  transition: width 0.4s ease;
}
.prog-text {
  margin-top: 6px;
  font-size: 12px;
  color: #8a9099;
  text-align: right;
}

/* ③ 快捷入口 */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.entry-card {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 12px;
  padding: 20px 18px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.entry-card:hover {
  box-shadow: 0 8px 20px rgba(13, 128, 224, 0.12);
  transform: translateY(-2px);
}
.entry-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 12px;
}
.entry-icon-blue {
  background: linear-gradient(135deg, #0d80e0, #4ca3f0);
}
.entry-icon-green {
  background: linear-gradient(135deg, #19a558, #5ec98f);
}
.entry-name {
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
}
.entry-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #8a9099;
}
</style>
