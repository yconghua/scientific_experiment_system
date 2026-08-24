<template>
  <div class="module">
    <h2 class="module-title">可视化和计算结果</h2>
    <p class="module-tip">选择项目后按导入方式展示地图：API 导入显示市行政区域与起终点，路网导入敬请期待。</p>

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
      <p class="placeholder-text">该项目还没有地图数据导入记录，请先在「地图数据导入」中选择一种方式导入后再来。</p>
    </div>

    <!-- 路网导入：占位（正在开发中） -->
    <div v-if="selectedProjectId && importType === 'road'" class="placeholder-card">
      <p class="placeholder-text">路网导入的地图可视化正在开发中。</p>
    </div>

    <!-- API 导入：地图可视化（独立实现） -->
    <div v-if="selectedProjectId && importType === 'api'" class="map-section">
      <div class="map-head">
        <h3 class="map-title">{{ currentProject ? currentProject.city_name + ' 行政区域' : '行政区域' }}</h3>
        <div class="legend">
          <span class="legend-item"><i class="dot dot-start"></i>起点</span>
          <span class="legend-item"><i class="dot dot-end"></i>终点</span>
        </div>
      </div>
      <p v-if="mapError" class="map-error">{{ mapError }}</p>
      <div ref="mapEl" class="map-canvas"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { listProjects, listMapData, listCoordData, getCityBoundary } from '../../api'

const projects = ref([])
const projectsLoading = ref(false)
const selectedProjectId = ref('')
// 当前项目的导入类型：'api' / 'road' / ''（未导入）
const importType = ref('')
const mapEl = ref(null)
const mapError = ref('')

// Leaflet 实例与图层引用（API 分支专属，切换项目/卸载时销毁）
let map = null
let boundaryLayer = null

const currentProject = computed(() =>
  projects.value.find((p) => String(p.id) === String(selectedProjectId.value)) || null
)

// -------------------- 数据加载 --------------------
async function loadProjects() {
  projectsLoading.value = true
  try {
    const res = await listProjects()
    if (res && res.success) {
      projects.value = res.projects || []
    }
  } catch (e) {
    // 忽略
  } finally {
    projectsLoading.value = false
  }
}

// 判断当前项目导入类型（api / road / 未导入）
async function loadImportType() {
  importType.value = ''
  if (!selectedProjectId.value) return
  try {
    const [apiRes, roadRes] = await Promise.all([
      listMapData(selectedProjectId.value, 'api'),
      listMapData(selectedProjectId.value, 'road')
    ])
    if (apiRes && apiRes.success && (apiRes.records || []).length > 0) {
      importType.value = 'api'
    } else if (roadRes && roadRes.success && (roadRes.records || []).length > 0) {
      importType.value = 'road'
    }
  } catch (e) {
    // 忽略
  }
}

// -------------------- 地图（API 分支） --------------------
function destroyMap() {
  if (map) {
    map.remove()
    map = null
    boundaryLayer = null
  }
}

async function initApiMap() {
  destroyMap()
  mapError.value = ''
  if (!mapEl.value) return

  // 1) 初始化地图（高德瓦片，国内访问快、无需 key）
  map = L.map(mapEl.value, { zoomControl: true }).setView([28.19, 112.97], 8)
  L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    { subdomains: '1234', maxZoom: 18, attribution: '高德地图' }
  ).addTo(map)

  const allPoints = []

  // 2) 市行政区域边界（统一走主进程 IPC：主进程请求 DataV，开发/生产一致，无跨域、不依赖 Vite 代理）
  const cityCode = currentProject.value && currentProject.value.city_code
  if (cityCode) {
    try {
      const res = await getCityBoundary(cityCode)
      const geo = res && res.success ? res.geo : null
      if (geo && geo.features && geo.features.length) {
        boundaryLayer = L.geoJSON(geo, {
          style: { color: '#0d80e0', weight: 2, fillColor: '#0d80e0', fillOpacity: 0.08 }
        }).addTo(map)
        map.fitBounds(boundaryLayer.getBounds())
      } else {
        mapError.value = (res && res.message) || '行政区域边界加载失败，请检查网络'
      }
    } catch (e) {
      mapError.value = '行政区域边界加载失败，请检查网络'
    }
  } else {
    mapError.value = '该项目缺少市信息（city_code）'
  }

  // 3) 起点（红）/ 终点（蓝）标记
  const drawPoints = (rows, color) => {
    for (const r of rows || []) {
      const lat = Number(r.latitude)
      const lng = Number(r.longitude)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
      allPoints.push([lat, lng])
      const marker = L.circleMarker([lat, lng], {
        radius: 6,
        color: '#ffffff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9
      }).addTo(map)
      marker.bindPopup(`<b>${r.point_name || '未命名'}</b><br/>经度 ${lng}，纬度 ${lat}`)
    }
  }
  const [startRes, endRes] = await Promise.all([
    listCoordData(selectedProjectId.value, 'start'),
    listCoordData(selectedProjectId.value, 'end')
  ])
  drawPoints(startRes && startRes.success ? startRes.records : [], '#e0483b')
  drawPoints(endRes && endRes.success ? endRes.records : [], '#0d80e0')

  // 4) 边界加载失败时，用所有点位自适应视野
  if (!boundaryLayer && allPoints.length > 0) {
    map.fitBounds(allPoints)
  }
}

// -------------------- 生命周期 --------------------
watch(selectedProjectId, () => {
  importType.value = ''
  loadImportType()
})

watch(importType, async (t) => {
  if (t === 'api') {
    await nextTick()
    initApiMap()
  } else {
    destroyMap()
  }
})

onMounted(() => {
  loadProjects()
})

onUnmounted(() => {
  destroyMap()
})
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

/* 占位卡片（未导入 / 路网占位） */
.placeholder-card {
  margin-bottom: 18px;
  padding: 48px 20px;
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

/* 地图区（API 分支） */
.map-section {
  border: 1px solid #eceff3;
  border-radius: 8px;
  padding: 14px;
}
.map-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.map-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
}
.legend {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: #4a5260;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.dot-start {
  background: #e0483b;
}
.dot-end {
  background: #0d80e0;
}
.map-error {
  margin: 0 0 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: #e0483b;
  background: #fdecec;
  border-radius: 6px;
}
.map-canvas {
  height: 520px;
  border-radius: 8px;
  overflow: hidden;
}
</style>
