<template>
  <div class="module">
    <h2 class="module-title">api导入</h2>
    <p class="module-tip">选择项目后录入 API 平台与 Key，导入记录将绑定到该项目。</p>

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

    <!-- 表单 -->
    <form v-if="selectedProjectId" class="form" @submit.prevent="onSubmit">
      <div class="form-row">
        <label class="form-label">API提供平台 <span class="req">*</span></label>
        <input
          v-model.trim="apiForm.platform"
          class="form-input"
          type="text"
          maxlength="50"
          placeholder="示例：百度地图 / 高德地图"
        />
      </div>
      <div class="form-row">
        <label class="form-label">API Key <span class="req">*</span></label>
        <input
          v-model.trim="apiForm.key"
          class="form-input"
          type="text"
          maxlength="100"
          placeholder="请输入 API Key（最长 100 字符）"
        />
      </div>
      <div class="form-row">
        <label class="form-label">API网址 <span class="req">*</span></label>
        <input
          v-model.trim="apiForm.url"
          class="form-input"
          type="text"
          maxlength="500"
          placeholder="请输入 API 调用网址"
        />
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-submit" :disabled="submitting">
          {{ submitting ? '提交中…' : '提交' }}
        </button>
        <button type="button" class="btn btn-reset" @click="onReset">重置</button>
      </div>
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </form>

    <!-- 导入记录表格 -->
    <div v-if="selectedProjectId" class="list-section">
      <h3 class="list-title">API 导入记录</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 120px">API提供平台</th>
              <th style="width: 160px">API Key</th>
              <th>API网址</th>
              <th style="width: 140px">创建时间</th>
              <th style="width: 140px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pagedRows" :key="row.id">
              <td>{{ row.api_platform }}</td>
              <td>{{ row.api_key }}</td>
              <td class="url-cell" :title="row.api_url">{{ row.api_url || '—' }}</td>
              <td>{{ fmtTime(row.created_at) }}</td>
              <td class="op-cell">
                <button class="link-btn link-edit" @click="openEdit(row)">编辑</button>
                <button class="link-btn link-delete" @click="openDelete(row)">删除</button>
              </td>
            </tr>
            <tr v-if="pagedRows.length === 0">
              <td colspan="5" class="empty-cell">{{ listLoading ? '加载中…' : '暂无导入记录' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <!--
      <div class="pager">
        <button class="pager-btn" :disabled="currentPage <= 1" @click="goPage(currentPage - 1)">上一页</button>
        <span class="pager-info">第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button class="pager-btn" :disabled="currentPage >= totalPages" @click="goPage(currentPage + 1)">下一页</button>
      </div>
      -->
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="editVisible" class="modal-mask" @click.self="closeEdit">
      <div class="modal">
        <div class="modal-head">
          <h3 class="modal-title">编辑导入记录</h3>
          <button class="modal-close" @click="closeEdit">×</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label class="form-label">API提供平台 <span class="req">*</span></label>
            <input v-model.trim="editForm.platform" class="form-input" type="text" maxlength="50" />
          </div>
          <div class="form-row">
            <label class="form-label">API Key <span class="req">*</span></label>
            <input v-model.trim="editForm.key" class="form-input" type="text" maxlength="100" />
          </div>
          <div class="form-row">
            <label class="form-label">API网址 <span class="req">*</span></label>
            <input v-model.trim="editForm.url" class="form-input" type="text" maxlength="500" />
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
          <h3 class="modal-title">删除导入记录</h3>
          <button class="modal-close" @click="closeDelete">×</button>
        </div>
        <div class="modal-body">
          <p class="confirm-text">
            确定要删除「<b>{{ deleteTarget && deleteTarget.api_platform }}</b>」的导入记录吗？此操作不可恢复。
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
import { listProjects, listMapData, createMapData, updateMapData, deleteMapData } from '../../api'

const PAGE_SIZE = 5

const projects = ref([])
const projectsLoading = ref(false)
const selectedProjectId = ref('')

const apiForm = reactive({ platform: '', key: '', url: '' })
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
function goPage(n) {
  page.value = Math.min(Math.max(1, n), totalPages.value)
}

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
    const res = await listMapData(selectedProjectId.value, 'api')
    if (res && res.success) {
      records.value = res.records || []
    } else {
      records.value = []
      showToast('error', (res && res.message) || '读取导入记录失败')
    }
  } catch (e) {
    records.value = []
    showToast('error', '网络或数据库异常，请稍后重试')
  } finally {
    listLoading.value = false
  }
}

// 切换项目：重置表单并刷新表格
watch(selectedProjectId, () => {
  onReset()
  loadRecords()
})

function onReset() {
  apiForm.platform = ''
  apiForm.key = ''
  apiForm.url = ''
  formError.value = ''
}

async function onSubmit() {
  if (!apiForm.platform) {
    formError.value = '请填写 API 提供平台'
    return
  }
  if (!apiForm.key) {
    formError.value = '请填写 API Key'
    return
  }
  if (!apiForm.url) {
    formError.value = '请填写 API 网址'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    const res = await createMapData({
      project_id: selectedProjectId.value,
      import_type: 'api',
      api_platform: apiForm.platform,
      api_key: apiForm.key,
      api_url: apiForm.url
    })
    if (res && res.success) {
      showToast('success', res.message || '导入记录创建成功')
      onReset()
      await loadRecords()
    } else {
      formError.value = (res && res.message) || '创建失败，请稍后重试'
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
const editForm = reactive({ id: null, platform: '', key: '', url: '' })

function openEdit(row) {
  editError.value = ''
  editForm.id = row.id
  editForm.platform = row.api_platform
  editForm.key = row.api_key
  editForm.url = row.api_url
  editVisible.value = true
}
function closeEdit() {
  if (editSubmitting.value) return
  editVisible.value = false
}
async function saveEdit() {
  if (!editForm.platform) {
    editError.value = '请填写 API 提供平台'
    return
  }
  if (!editForm.key) {
    editError.value = '请填写 API Key'
    return
  }
  if (!editForm.url) {
    editError.value = '请填写 API 网址'
    return
  }
  editSubmitting.value = true
  editError.value = ''
  try {
    const res = await updateMapData({
      id: editForm.id,
      api_platform: editForm.platform,
      api_key: editForm.key,
      api_url: editForm.url
    })
    if (res && res.success) {
      showToast('success', res.message || '导入记录已更新')
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
    const res = await deleteMapData(deleteTarget.value.id)
    if (res && res.success) {
      showToast('success', res.message || '导入记录已删除')
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
  min-height: auto;
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
  margin-bottom: 20px;
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
  flex: 0 0 110px;
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
.form-actions {
  display: flex;
  gap: 12px;
  padding-left: 126px;
}
.form-error {
  margin: 0 0 0 126px;
  font-size: 13px;
  color: #f53f3f;
}

/* 列表 */
.list-section {
  border-top: 1px solid #eceff3;
  padding-top: 18px;
}
.list-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 12px;
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
  word-break: break-all;
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
.url-cell {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6b7280;
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
  height: 36px;
  padding: 0 18px;
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
