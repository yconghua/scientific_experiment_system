<template>
  <div class="module">
    <h2 class="module-title">起点坐标数据（WGS84坐标系）</h2>
    <p class="module-tip">选择项目后导入起点坐标文件（txt / csv / excel），提交时解析文件内容并存入数据库。</p>

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

    <!-- 示例文件下载 -->
    <div class="sample-bar">
      <span class="sample-label">示例文件下载：</span>
      <button class="btn btn-file" @click="downloadText('txt')">下载 txt 示例</button>
      <button class="btn btn-file" @click="downloadText('csv')">下载 csv 示例</button>
      <button class="btn btn-file" @click="downloadExcel()">下载 excel 示例</button>
    </div>

    <!-- 表单 -->
    <form v-if="selectedProjectId" class="form" @submit.prevent="onSubmit">
      <div class="form-row">
        <label class="form-label">坐标文件 <span class="req">*</span></label>
        <div class="file-row">
          <button type="button" class="btn btn-file" :disabled="picking" @click="onPickFile">
            {{ picking ? '选择中…' : '文件选择' }}
          </button>
          <span class="file-name">{{ coordForm.fileName || '未选择文件（只支持 txt / csv / excel）' }}</span>
        </div>
      </div>
      <div class="form-row">
        <label class="form-label">文件位置 <span class="req">*</span></label>
        <input
          v-model.trim="coordForm.filePath"
          class="form-input"
          type="text"
          maxlength="500"
          placeholder="选择文件后自动填入，也可手动修改"
        />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-submit" :disabled="submitting">
          {{ submitting ? '解析中…' : '提交' }}
        </button>
        <button type="button" class="btn btn-reset" @click="onReset">重置</button>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </form>

    <!-- 数据表格 -->
    <div v-if="selectedProjectId" class="list-section">
      <div class="list-head">
        <h3 class="list-title">起点坐标数据（共 {{ records.length }} 条）</h3>
        <button
          class="btn btn-danger-ghost"
          :disabled="records.length === 0 || clearing"
          @click="openClear"
        >
          {{ clearing ? '清空中…' : '清空数据' }}
        </button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 70px">序号</th>
              <th>点名称</th>
              <th>经度</th>
              <th>纬度</th>
              <th style="width: 140px">创建时间</th>
              <th style="width: 140px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pagedRows" :key="row.id">
              <td>{{ row.sort_no ?? '—' }}</td>
              <td>{{ row.point_name || '—' }}</td>
              <td>{{ fmtCoord(row.longitude) }}</td>
              <td>{{ fmtCoord(row.latitude) }}</td>
              <td>{{ fmtTime(row.created_at) }}</td>
              <td class="op-cell">
                <button class="link-btn link-edit" @click="openEdit(row)">编辑</button>
                <button class="link-btn link-delete" @click="openDelete(row)">删除</button>
              </td>
            </tr>
            <tr v-if="pagedRows.length === 0">
              <td colspan="6" class="empty-cell">{{ listLoading ? '加载中…' : '暂无数据，请导入文件' }}</td>
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

    <!-- 编辑弹窗 -->
    <div v-if="editVisible" class="modal-mask" @click.self="closeEdit">
      <div class="modal">
        <div class="modal-head">
          <h3 class="modal-title">编辑坐标数据</h3>
          <button class="modal-close" @click="closeEdit">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label class="form-label">序号</label>
            <input v-model.trim="editForm.sortNo" class="form-input" type="number" min="0" placeholder="选填" />
          </div>
          <div class="form-row">
            <label class="form-label">点名称</label>
            <input v-model.trim="editForm.pointName" class="form-input" type="text" maxlength="100" placeholder="选填" />
          </div>
          <div class="form-row">
            <label class="form-label">经度 <span class="req">*</span></label>
            <input v-model.trim="editForm.longitude" class="form-input" type="number" step="0.000001" placeholder="-180 ~ 180" />
          </div>
          <div class="form-row">
            <label class="form-label">纬度 <span class="req">*</span></label>
            <input v-model.trim="editForm.latitude" class="form-input" type="number" step="0.000001" placeholder="-90 ~ 90" />
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
          <h3 class="modal-title">删除坐标数据</h3>
          <button class="modal-close" @click="closeDelete">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-text">
            确定要删除「<b>{{ deleteTarget && (deleteTarget.point_name || deleteTarget.sort_no || '该条') }}</b>」
            （经度 {{ deleteTarget && fmtCoord(deleteTarget.longitude) }}，纬度 {{ deleteTarget && fmtCoord(deleteTarget.latitude) }}）吗？
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

    <!-- 清空确认弹窗 -->
    <div v-if="clearVisible" class="modal-mask" @click.self="closeClear">
      <div class="modal modal-sm">
        <div class="modal-head">
          <h3 class="modal-title">清空数据</h3>
          <button class="modal-close" @click="closeClear">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-text">
            确定要清空当前项目全部 <b>{{ records.length }}</b> 条起点坐标数据吗？此操作不可恢复。
          </p>
        </div>
        <div class="modal-foot">
          <button class="btn btn-cancel" @click="closeClear">取消</button>
          <button class="btn btn-danger" :disabled="clearing" @click="confirmClear">
            {{ clearing ? '清空中…' : '确定清空' }}
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
import * as XLSX from 'xlsx'
import { listProjects, listCoordData, createCoordData, updateCoordData, deleteCoordData, clearCoordData, pickFile } from '../../api'

const POINT_TYPE = 'start'
const PAGE_SIZE = 5

// 示例数据（>=5 条，表头 No,Name,Longitude,Latitude）
const SAMPLE_ROWS = [
  { No: 1, Name: '天心阁', Longitude: 112.982, Latitude: 28.19 },
  { No: 2, Name: '岳麓山', Longitude: 112.93, Latitude: 28.19 },
  { No: 3, Name: '橘子洲', Longitude: 112.956, Latitude: 28.197 },
  { No: 4, Name: '五一广场', Longitude: 112.978, Latitude: 28.193 },
  { No: 5, Name: '长沙南站', Longitude: 113.02, Latitude: 28.152 }
]

const projects = ref([])
const projectsLoading = ref(false)
const selectedProjectId = ref('')

const coordForm = reactive({ fileName: '', filePath: '' })
const picking = ref(false)
const submitting = ref(false)
const formError = ref('')

const records = ref([])
const listLoading = ref(false)
const page = ref(1)

const currentProject = computed(() =>
  projects.value.find((p) => String(p.id) === String(selectedProjectId.value)) || null
)

const totalPages = computed(() => Math.max(1, Math.ceil(records.value.length / PAGE_SIZE)))
const currentPage = computed(() => Math.min(page.value, totalPages.value))
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return records.value.slice(start, start + PAGE_SIZE)
})

function fmtTime(s) {
  return s ? String(s).slice(0, 16) : '—'
}
function fmtCoord(v) {
  if (v === null || v === undefined || v === '') return '—'
  return String(Number(v))
}
function goPage(n) {
  page.value = Math.min(Math.max(1, n), totalPages.value)
}

// -------------------- 示例文件下载 --------------------
function sampleText() {
  const head = 'No,Name,Longitude,Latitude'
  const lines = SAMPLE_ROWS.map((r) => `${r.No},${r.Name},${r.Longitude},${r.Latitude}`)
  return [head, ...lines].join('\n')
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
function downloadText(ext) {
  const blob = new Blob([sampleText()], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, `坐标数据示例.${ext}`)
}
function downloadExcel() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS)
  XLSX.utils.book_append_sheet(wb, ws, '示例数据')
  const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  downloadBlob(blob, '坐标数据示例.xlsx')
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

async function loadRecords() {
  if (!selectedProjectId.value) {
    records.value = []
    return
  }
  listLoading.value = true
  page.value = 1
  try {
    const res = await listCoordData(selectedProjectId.value, POINT_TYPE)
    if (res && res.success) {
      records.value = res.records || []
    } else {
      records.value = []
      showToast('error', (res && res.message) || '读取坐标数据失败')
    }
  } catch (e) {
    records.value = []
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    listLoading.value = false
  }
}

watch(selectedProjectId, () => {
  onReset()
  loadRecords()
})

function onReset() {
  coordForm.fileName = ''
  coordForm.filePath = ''
  formError.value = ''
}

async function onPickFile() {
  picking.value = true
  try {
    const res = await pickFile()
    if (res && res.success) {
      coordForm.fileName = res.name
      coordForm.filePath = res.path
    } else if (res && res.canceled) {
      // 用户取消
    } else {
      showToast('error', (res && res.message) || '文件选择失败')
    }
  } catch (e) {
    showToast('error', '文件选择失败，请稍后重试')
  } finally {
    picking.value = false
  }
}

async function onSubmit() {
  if (!coordForm.filePath) {
    formError.value = '请先选择文件'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    const res = await createCoordData({
      project_id: selectedProjectId.value,
      point_type: POINT_TYPE,
      file_path: coordForm.filePath
    })
    if (res && res.success) {
      showToast('success', res.message || '导入成功')
      onReset()
      await loadRecords()
    } else {
      formError.value = (res && res.message) || '导入失败，请稍后重试'
    }
  } catch (e) {
    formError.value = '网络或数据库异常，请稍后重试'
  } finally {
    submitting.value = false
  }
}

// -------------------- 编辑 --------------------
const editVisible = ref(false)
const editSubmitting = ref(false)
const editError = ref('')
const editForm = reactive({ id: null, sortNo: '', pointName: '', longitude: '', latitude: '' })

function openEdit(row) {
  editError.value = ''
  editForm.id = row.id
  editForm.sortNo = row.sort_no == null ? '' : String(row.sort_no)
  editForm.pointName = row.point_name || ''
  editForm.longitude = row.longitude == null ? '' : String(Number(row.longitude))
  editForm.latitude = row.latitude == null ? '' : String(Number(row.latitude))
  editVisible.value = true
}
function closeEdit() {
  if (editSubmitting.value) return
  editVisible.value = false
}
async function saveEdit() {
  const lng = Number(editForm.longitude)
  const lat = Number(editForm.latitude)
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    editError.value = '请填写合法经度（-180 ~ 180）'
    return
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    editError.value = '请填写合法纬度（-90 ~ 90）'
    return
  }
  editSubmitting.value = true
  editError.value = ''
  try {
    const res = await updateCoordData({
      id: editForm.id,
      sort_no: editForm.sortNo,
      point_name: editForm.pointName,
      longitude: lng,
      latitude: lat
    })
    if (res && res.success) {
      showToast('success', res.message || '坐标数据已更新')
      editVisible.value = false
      await loadRecords()
    } else {
      editError.value = (res && res.message) || '更新失败'
    }
  } catch (e) {
    editError.value = '网络或数据库异常，请稍后重试'
  } finally {
    editSubmitting.value = false
  }
}

// -------------------- 删除 --------------------
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
    const res = await deleteCoordData(deleteTarget.value.id)
    if (res && res.success) {
      showToast('success', res.message || '坐标数据已删除')
      deleteVisible.value = false
      await loadRecords()
    } else {
      showToast('error', (res && res.message) || '删除失败')
    }
  } catch (e) {
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    deleteSubmitting.value = false
  }
}

// -------------------- 清空（删除当前项目全部起点坐标数据） --------------------
const clearVisible = ref(false)
const clearing = ref(false)
function openClear() {
  if (records.value.length === 0 || clearing.value) return
  clearVisible.value = true
}
function closeClear() {
  if (clearing.value) return
  clearVisible.value = false
}
async function confirmClear() {
  clearing.value = true
  try {
    const res = await clearCoordData(selectedProjectId.value, POINT_TYPE)
    if (res && res.success) {
      showToast('success', res.message || '数据已清空')
      clearVisible.value = false
      await loadRecords()
    } else {
      showToast('error', (res && res.message) || '清空失败')
    }
  } catch (e) {
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    clearing.value = false
  }
}

// -------------------- 轻提示 --------------------
const toast = reactive({ type: '', msg: '' })
let toastTimer = null
function showToast(type, msg) {
  toast.type = type
  toast.msg = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.msg = '' }, 2600)
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
  width: 200px;
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

/* 示例文件下载 */
.sample-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  padding: 12px 16px;
  background: #f0f6fd;
  border: 1px dashed #9cc6ea;
  border-radius: 8px;
}
.sample-label {
  font-size: 14px;
  color: #4a5260;
}

/* 表单 */
.form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 24px;
}
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin: 5px;
}
.form-label {
  flex: 0 0 90px;
  font-size: 14px;
  color: #1f2329;
  padding-top: 9px;
  text-align: right;
}
.req {
  color: #f53f3f;
}
.form-input {
  flex: 1 1 auto;
  max-width: 420px;
  height: 38px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}
.form-input:focus {
  border-color: #0d80e0;
}
.file-row {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.file-name {
  font-size: 14px;
  color: #5b6470;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.form-actions {
  display: flex;
  gap: 12px;
  padding-left: 106px;
}
.form-error {
  margin: 0 0 0 106px;
  font-size: 13px;
  color: #f53f3f;
}

/* 列表 */
.list-section {
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
  width: 440px;
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
  border-color: #dfe3e8;
  color: #4e5969;
}
.btn-reset:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.btn-file {
  background: #fff;
  border: 1px solid #0d80e0;
  color: #0d80e0;
}
.btn-file:hover:not(:disabled) {
  background: #eaf4fd;
}
.btn-file:disabled {
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
