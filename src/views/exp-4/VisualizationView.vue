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
let markerLayer = null
let maskLayer = null

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
    markerLayer = null
    maskLayer = null
  }
}

// 绘制起终点标记（Leaflet circleMarker）
async function loadMarkers() {
  if (!map) return
  if (markerLayer) {
    map.removeLayer(markerLayer)
    markerLayer = null
  }
  markerLayer = L.layerGroup().addTo(map)

  const [startRes, endRes] = await Promise.all([
    listCoordData(selectedProjectId.value, 'start'),
    listCoordData(selectedProjectId.value, 'end')
  ])

  const draw = (records, color) => {
    ;(records || []).forEach((p) => {
      const lat = Number(p.latitude)
      const lng = Number(p.longitude)
      if (!isFinite(lat) || !isFinite(lng)) return
      L.circleMarker([lat, lng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1
      })
        .bindTooltip(p.point_name || '', { direction: 'right' })
        .addTo(markerLayer)
    })
  }

  draw(startRes && startRes.success ? startRes.records : [], '#e0483b') // 起点 红
  draw(endRes && endRes.success ? endRes.records : [], '#0d80e0') // 终点 蓝
}

// 初始化 API 分支地图：
// - 仅渲染行政区域 GeoJSON，区域内部填色，其余区域保持白色（不加载底图瓦片）
// - 通过主进程 viz:boundary 获取边界，避免浏览器跨域
async function initApiMap() {
  destroyMap()
  mapError.value = ''
  if (!mapEl.value) return
  if (!currentProject.value) {
    mapError.value = '未选择项目'
    return
  }

  const cityCode = String(currentProject.value.city_code).padEnd(6, '0')

  try {
    const res = await getCityBoundary(cityCode)
    // 主进程返回 { success, geo, message }，需先解包再判断
    if (!res || !res.success) {
      mapError.value = (res && res.message) ? res.message : '未获取到行政区域边界数据'
      return
    }
    const geo = res.geo
    if (!geo || !geo.features || !geo.features.length) {
      mapError.value = '行政区域边界数据为空，请检查项目中的城市编码：' + cityCode
      return
    }

    map = L.map(mapEl.value, {
      center: [28.682, 115.857], // 初值，下面按边界自适应
      zoom: 9,
      attributionControl: true,
      zoomControl: true
    })

    // 在线通用路网底图（高德路网 style=7）：让地图显示真实路网，不再空白
    L.tileLayer('https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
      maxZoom: 18,
      subdomains: '1234',
      attribution: '&copy; 高德地图'
    }).addTo(map)

    // 仅显示行政区域内：用「世界大矩形挖掉行政区整体」的白色遮罩盖住区域外
    // 注意：DataV _full 会返回多个要素（市整体 + 各区县），遮罩只取第一个要素（整体边界）挖洞，
    // 否则后续区县要素会再把市区盖白。GeoJSON 坐标为 [lng,lat]，Leaflet 需 [lat,lng]。
    const worldRect = [[85, -180], [-85, -180], [-85, 180], [85, 180]]
    maskLayer = L.layerGroup().addTo(map)
    const mainFeature = geo.features[0]
    const mg = mainFeature && mainFeature.geometry
    if (mg) {
      const rings = []
      if (mg.type === 'Polygon') rings.push(mg.coordinates[0])
      else if (mg.type === 'MultiPolygon') mg.coordinates.forEach((poly) => rings.push(poly[0]))
      rings.forEach((ring) => {
        const llRing = ring.map((p) => [p[1], p[0]]) // [lng,lat] → [lat,lng]
        L.polygon([worldRect, llRing], {
          stroke: false,
          fillColor: '#ffffff',
          fillOpacity: 1,
          fillRule: 'evenodd',
          interactive: false
        }).addTo(maskLayer)
      })
    }

    // 行政区域：在底图与遮罩之上叠加彩色描边/填充作为高亮（降低填充透明度，路网可透出）
    boundaryLayer = L.geoJSON(geo, {
      style: {
        color: '#2f6fed', // 行政边界线
        weight: 2,
        fillColor: '#9ec3ff', // 行政区域填充色
        fillOpacity: 0
      }
    }).addTo(map)

    if (boundaryLayer.getBounds().isValid()) {
      map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] })
    }

    // 叠加起终点
    await loadMarkers()
  } catch (e) {
    console.error(e)
    mapError.value = '地图加载失败: ' + (e && e.message ? e.message : e)
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
  background: #fff;
}
/* Leaflet 容器背景统一为白色，使行政区域以外保持空白 */
.map-canvas :deep(.leaflet-container) {
  background: #fff;
}
</style>
