<template>
  <div class="module">
    <h2 class="module-title">项目列表</h2>

    <!-- 筛选区：项目名称 + 省/市/区县 级联 -->
    <div class="filter-bar">
      <div class="filter-item">
        <label class="filter-label">项目名称</label>
        <input
          v-model.trim="filters.name"
          class="filter-input"
          type="text"
          placeholder="输入项目名称搜索"
        />
      </div>
      <div class="filter-item">
        <label class="filter-label">省</label>
        <select v-model="filters.provinceCode" class="filter-select" @change="onFilterProvinceChange">
          <option value="">全部</option>
          <option v-for="p in provinces" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>
      <div class="filter-item">
        <label class="filter-label">市</label>
        <select v-model="filters.cityCode" class="filter-select" :disabled="!filters.provinceCode" @change="onFilterCityChange">
          <option value="">全部</option>
          <option v-for="c in cities" :key="c.value" :value="c.value">{{ c.label }}</option>
        </select>
      </div>
      <div class="filter-item">
        <label class="filter-label">区/县</label>
        <select v-model="filters.districtCode" class="filter-select" :disabled="!filters.cityCode">
          <option value="">全部</option>
          <option v-for="d in districts" :key="d.value" :value="d.value">{{ d.label }}</option>
        </select>
      </div>
      <button class="btn btn-reset" @click="onResetFilter">重置</button>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 96px">项目编号</th>
            <th style="width: 300px">项目名称</th>
            <th>项目地点</th>
            <th>备注</th>
            <th style="width: 140px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in pagedRows" :key="row.id">
            <td>{{ row.project_no }}</td>
            <td>{{ row.name }}</td>
            <td>{{ row.province_name }}{{ row.city_name }}{{ row.district_name }}</td>
            <td class="remark-cell">{{ row.remark || '—' }}</td>
            <td class="op-cell">
              <button class="link-btn link-edit" @click="openEdit(row)">编辑</button>
              <button class="link-btn link-delete" @click="openDelete(row)">删除</button>
            </td>
          </tr>
          <tr v-if="pagedRows.length === 0">
            <td colspan="5" class="empty-cell">{{ loading ? '加载中…' : '暂无符合条件的项目' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页：第 X 页 / 共 Y 页 -->
    <div class="pager">
      <button class="pager-btn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
      <span class="pager-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
      <button class="pager-btn" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editVisible" class="modal-mask" @click.self="closeEdit">
      <div class="modal">
        <div class="modal-head">
          <h3 class="modal-title">编辑项目</h3>
          <button class="modal-close" @click="closeEdit">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label class="form-label">项目编号</label>
            <div class="form-static">{{ editForm.project_no }}</div>
          </div>
          <div class="form-row">
            <label class="form-label">项目名称<span class="req">*</span></label>
            <input v-model.trim="editForm.name" class="form-input" type="text" maxlength="100" placeholder="请输入项目名称" />
          </div>
          <div class="form-row">
            <label class="form-label">项目地点<span class="req">*</span></label>
            <div class="cascader">
              <select v-model="editForm.provinceCode" class="form-input" @change="onEditProvinceChange">
                <option value="">请选择省</option>
                <option v-for="p in provinces" :key="p.value" :value="p.value">{{ p.label }}</option>
              </select>
              <select v-model="editForm.cityCode" class="form-input" :disabled="!editForm.provinceCode" @change="onEditCityChange">
                <option value="">请选择市</option>
                <option v-for="c in editCities" :key="c.value" :value="c.value">{{ c.label }}</option>
              </select>
              <select v-model="editForm.districtCode" class="form-input" :disabled="!editForm.cityCode">
                <option value="">请选择区/县</option>
                <option v-for="d in editDistricts" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <label class="form-label">备注</label>
            <textarea v-model.trim="editForm.remark" class="form-input form-textarea" maxlength="500" placeholder="选填"></textarea>
          </div>
          <p v-if="editError" class="form-error">{{ editError }}</p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-cancel" @click="closeEdit">取消</button>
          <button class="btn btn-submit" :disabled="editSubmitting" @click="saveEdit">
            {{ editSubmitting ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <div v-if="deleteVisible" class="modal-mask" @click.self="closeDelete">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3 class="modal-title">删除项目</h3>
          <button class="modal-close" @click="closeDelete">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-text">
            确定要删除项目「<b>{{ deleteTarget && deleteTarget.project_no }}</b> /
            {{ deleteTarget && deleteTarget.name }}」吗？此操作不可恢复。
          </p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-cancel" @click="closeDelete">取消</button>
          <button class="btn btn-danger" :disabled="deleteSubmitting" @click="confirmDelete">
            {{ deleteSubmitting ? '删除中…' : '确定删除' }}
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
import { reactive, ref, computed, onMounted, watch } from 'vue'
// 全国省 / 市 / 区(县) 三级行政区划数据（与新建项目页一致）
import { regionData } from 'element-china-area-data'
import { listProjects, updateProject, deleteProject } from '../../api'

const provinces = regionData
const PAGE_SIZE = 5

const loading = ref(false)
const projects = ref([])

const filters = reactive({ name: '', provinceCode: '', cityCode: '', districtCode: '' })
const page = ref(1)

// 筛选区级联：选省带出市，选市带出区县
const cities = computed(() => {
  const pv = provinces.find((p) => p.value === filters.provinceCode)
  return pv ? pv.children || [] : []
})
const districts = computed(() => {
  const pv = provinces.find((p) => p.value === filters.provinceCode)
  const ct = pv && pv.children ? pv.children.find((c) => c.value === filters.cityCode) : null
  return ct ? ct.children || [] : []
})
function onFilterProvinceChange() {
  filters.cityCode = ''
  filters.districtCode = ''
}
function onFilterCityChange() {
  filters.districtCode = ''
}
function onResetFilter() {
  filters.name = ''
  filters.provinceCode = ''
  filters.cityCode = ''
  filters.districtCode = ''
}

// 客户端筛选（列表已在服务端按权限返回，数据量小，本地过滤即可）
const filtered = computed(() => {
  const kw = (filters.name || '').trim().toLowerCase()
  const pvName = filters.provinceCode ? labelOf(provinces, filters.provinceCode) : ''
  const ctName = filters.cityCode ? labelOf(cities.value, filters.cityCode) : ''
  const dtName = filters.districtCode ? labelOf(districts.value, filters.districtCode) : ''
  return projects.value.filter((p) => {
    if (kw && !(p.name || '').toLowerCase().includes(kw)) return false
    if (pvName && p.province_name !== pvName) return false
    if (ctName && p.city_name !== ctName) return false
    if (dtName && p.district_name !== dtName) return false
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const currentPage = computed(() => Math.min(page.value, totalPages.value))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

// 任意筛选条件变化都回到第 1 页
watch(filters, () => { page.value = 1 }, { deep: true })

function goPage(n) {
  page.value = Math.min(Math.max(1, n), totalPages.value)
}

function labelOf(list, code) {
  const f = (list || []).find((i) => i.value === code)
  return f ? f.label : ''
}

async function loadProjects() {
  loading.value = true
  try {
    const res = await listProjects()
    if (res && res.success) {
      projects.value = res.projects || []
    } else {
      showToast('error', (res && res.message) || '读取项目列表失败')
    }
  } catch (e) {
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    loading.value = false
  }
}

// -------------------- 编辑弹窗 --------------------
const editVisible = ref(false)
const editSubmitting = ref(false)
const editError = ref('')
const editForm = reactive({
  id: null,
  project_no: '',
  name: '',
  provinceCode: '',
  cityCode: '',
  districtCode: '',
  remark: ''
})

const editCities = computed(() => {
  const pv = provinces.find((p) => p.value === editForm.provinceCode)
  return pv ? pv.children || [] : []
})
const editDistricts = computed(() => {
  const pv = provinces.find((p) => p.value === editForm.provinceCode)
  const ct = pv && pv.children ? pv.children.find((c) => c.value === editForm.cityCode) : null
  return ct ? ct.children || [] : []
})
function onEditProvinceChange() {
  editForm.cityCode = ''
  editForm.districtCode = ''
}
function onEditCityChange() {
  editForm.districtCode = ''
}
function openEdit(row) {
  editError.value = ''
  // 优先用返回编码回填；老数据缺编码时按名称反查
  editForm.id = row.id
  editForm.project_no = row.project_no
  editForm.name = row.name
  editForm.provinceCode = row.province_code || codeOf(provinces, row.province_name)
  editForm.cityCode = row.city_code || codeOf((provinces.find((p) => p.value === editForm.provinceCode) || {}).children, row.city_name)
  editForm.districtCode = row.district_code || codeOf((editForm.cityCode && (provinces.find((p) => p.value === editForm.provinceCode) || {}).children || []).find((c) => c.value === editForm.cityCode), row.district_name)
  editForm.remark = row.remark || ''
  editVisible.value = true
}
function closeEdit() {
  if (editSubmitting.value) return
  editVisible.value = false
}
async function saveEdit() {
  if (!editForm.name) {
    editError.value = '请填写项目名称'
    return
  }
  if (!editForm.provinceCode || !editForm.cityCode || !editForm.districtCode) {
    editError.value = '请完整选择项目地点（省 / 市 / 区或县）'
    return
  }
  editSubmitting.value = true
  editError.value = ''
  try {
    const res = await updateProject({
      id: editForm.id,
      name: editForm.name,
      province_code: editForm.provinceCode,
      province_name: labelOf(provinces, editForm.provinceCode),
      city_code: editForm.cityCode,
      city_name: labelOf(editCities.value, editForm.cityCode),
      district_code: editForm.districtCode,
      district_name: labelOf(editDistricts.value, editForm.districtCode),
      remark: editForm.remark
    })
    if (res && res.success) {
      showToast('success', res.message || '项目已更新')
      editVisible.value = false
      await loadProjects()
    } else {
      editError.value = (res && res.message) || '更新失败'
    }
  } catch (e) {
    editError.value = '网络或数据库异常，请稍后重试'
  } finally {
    editSubmitting.value = false
  }
}
function codeOf(list, name) {
  if (!list || !name) return ''
  const f = list.find((i) => i.label === name)
  return f ? f.value : ''
}

// -------------------- 删除弹窗 --------------------
const deleteVisible = ref(false)
const deleteSubmitting = ref(false)
const deleteTarget = ref(null)
function openDelete(row) {
  deleteTarget.value = row
  deleteVisible.value = true
}
function closeDelete() {
  if (deleteSubmitting.value) return
  deleteVisible.value = false
}
async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteSubmitting.value = true
  try {
    const res = await deleteProject(deleteTarget.value.id)
    if (res && res.success) {
      showToast('success', res.message || '项目已删除')
      deleteVisible.value = false
      await loadProjects()
    } else {
      showToast('error', (res && res.message) || '删除失败')
    }
  } catch (e) {
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    deleteSubmitting.value = false
  }
}

// -------------------- 轻提示 --------------------
const toast = reactive({ type: '', msg: '' })
let toastTimer = null
function showToast(type, msg) {
  toast.type = type
  toast.msg = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.msg = '' }, 4000)
}

onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.module {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  min-height: auto;
}
.module-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}

/* 筛选区 */
.filter-bar {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 16px;
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.filter-label {
  font-size: 13px;
  color: #5b6470;
}
.filter-input,
.filter-select {
  height: 34px;
  width: 165px;
  padding: 0 10px;
  border: 1px solid #d7dce3;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  outline: none;
}
.filter-input:focus,
.filter-select:focus {
  border-color: #0d80e0;
}
.filter-select:disabled {
  background: #f3f5f8;
  color: #aab1bb;
  cursor: not-allowed;
}

/* 表格 */
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
.remark-cell {
  color: #6b7280;
  max-width: 280px;
  word-break: break-all;
}
.empty-cell {
  text-align: center;
  color: #9aa2ad;
  padding: 32px 0;
}
.op-cell {
  white-space: nowrap;
}
.link-btn {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
}
.link-edit {
  color: #0d80e0;
}
.link-delete {
  color: #e0483b;
  margin-left: 8px;
}
.link-btn:hover {
  text-decoration: underline;
}

/* 分页 */
.pager {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
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
  width: 460px;
  max-width: calc(100vw - 32px);
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.modal-sm {
  width: 380px;
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

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.form-label {
  width: 76px;
  flex: none;
  font-size: 14px;
  color: #4a5260;
  padding-top: 8px;
}
.req {
  color: #e0483b;
  margin-left: 2px;
}
.form-static {
  padding-top: 8px;
  font-size: 14px;
  color: #333;
}
.form-input {
  height: 34px;
  width: 100%;
  padding: 0 10px;
  border: 1px solid #d7dce3;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: #0d80e0;
}
.form-input:disabled {
  background: #f3f5f8;
  color: #aab1bb;
  cursor: not-allowed;
}
.form-textarea {
  height: 72px;
  padding: 8px 10px;
  resize: vertical;
  line-height: 1.5;
}
.cascader {
  display: flex;
  gap: 8px;
  flex: 1;
}
.cascader .form-input {
  min-width: 0;
}
.form-error {
  color: #e0483b;
  font-size: 13px;
  margin: 4px 0 0;
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
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
  cursor: pointer;
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
.btn-reset {
  background: #fff;
  border-color: #d7dce3;
  color: #4a5260;
}
.btn-reset:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}

/* 轻提示 */
.toast {
  position: fixed;
  top: 60px;
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
