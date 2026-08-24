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
import AMapLoader from '@amap/amap-jsapi-loader'

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

async function loadMarkers(AMap) {
  // 清除旧标记（如果有）
  if (map._markers) map._markers.forEach(m => map.remove(m))
  map._markers = []

  const [startRes, endRes] = await Promise.all([
    listCoordData(selectedProjectId.value, 'start'),
    listCoordData(selectedProjectId.value, 'end')
  ])

  const draw = (records, color) => {
    records.forEach(p => {
      const lng = Number(p.longitude), lat = Number(p.latitude)
      if (!isFinite(lng) || !isFinite(lat)) return
      const marker = new AMap.Marker({
        position: [lng, lat],
        content: `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;"></div>`,
        offset: new AMap.Pixel(-6, -6),
        label: {
          content: `<div style="background:rgba(255,255,255,0.8);padding:2px 6px;border-radius:4px;font-size:12px;">${p.point_name||''}</div>`,
          direction: 'right'
        }
      })
      marker.setMap(map)
      map._markers.push(marker)
    })
  }

  draw(startRes?.success ? startRes.records : [], '#e0483b')
  draw(endRes?.success ? endRes.records : [], '#0d80e0')
}

const MAP_KEY = 'ae88b2eef81a001a2724af0f8a6b6b0d'

async function initApiMap() {
  destroyMap()
  mapError.value = ''
  if (!mapEl.value) return

  const cityName = currentProject.value?.city_name
  if (!cityName) {
    mapError.value = '项目缺少城市名称'
    return
  }
  console.log('查询城市:', cityName)

  try {
    const AMap = await AMapLoader.load({
      key: MAP_KEY,
      version: '2.0',
      plugins: ['AMap.DistrictSearch']
    })

    map = new AMap.Map(mapEl.value, {   // 直接传入 DOM 元素
      zoom: 11,
      viewMode: '3D',
      mapStyle: 'amap://styles/whitesmoke',
      center: [115.857, 28.682], // 暂时固定南昌中心，测试用
      showIndoorMap: false
    })

    const districtSearch = new AMap.DistrictSearch({
      level: 'city',
      extensions: 'all'
    })

    districtSearch.search(cityName, (status, result) => {
      console.log('查询状态:', status)
      console.log('查询结果:', result)
      if (status === 'complete' && result.info === 'OK') {
        const boundaries = result.districtList[0]?.boundaries
        if (boundaries && boundaries.length > 0) {
          // ... 构造 mask 的代码（与之前相同）
          // 记得调用 map.setFitView()
        } else {
          mapError.value = '无边界数据，可能城市名称不匹配'
        }
      } else {
        mapError.value = '行政区划查询失败'
      }
    })
  } catch (e) {
    console.error(e)
    mapError.value = '高德地图加载失败: ' + e.message
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
