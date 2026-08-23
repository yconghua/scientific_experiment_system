<template>
  <div class="module">
    <h2 class="module-title">新建项目</h2>
    <p class="module-tip">填写项目基础信息，带 * 为必填项。</p>

    <form class="form" @submit.prevent="onSubmit">
      <!-- 项目名称 -->
      <div class="form-row">
        <label class="form-label" for="projName">项目名称 <span class="req">*</span></label>
        <input
          id="projName"
          v-model.trim="form.name"
          class="form-input"
          type="text"
          maxlength="50"
          placeholder="请输入项目名称"
        />
      </div>

      <!-- 项目地点：省 / 市 / 区或县 三级联动 -->
      <div class="form-row">
        <label class="form-label">项目地点 <span class="req">*</span></label>
        <div class="region-selects">
          <select
            v-model="form.province"
            class="form-select"
            :class="{ placeholder: !form.province }"
            @change="onProvinceChange"
          >
            <option value="">省</option>
            <option v-for="p in provinces" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>

          <select
            v-model="form.city"
            class="form-select"
            :class="{ placeholder: !form.city }"
            :disabled="!form.province"
            @change="onCityChange"
          >
            <option value="">市</option>
            <option v-for="c in cities" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>

          <select
            v-model="form.district"
            class="form-select"
            :class="{ placeholder: !form.district }"
            :disabled="!form.city"
          >
            <option value="">区 / 县</option>
            <option v-for="d in districts" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>
      </div>

      <!-- 备注 -->
      <div class="form-row">
        <label class="form-label" for="projRemark">备注</label>
        <textarea
          id="projRemark"
          v-model.trim="form.remark"
          class="form-textarea"
          rows="3"
          maxlength="200"
          placeholder="可填写补充说明（选填）"
        ></textarea>
      </div>

      <!-- 操作按钮 -->
      <div class="form-actions">
        <button type="submit" class="btn btn-submit" :disabled="submitting">
          {{ submitting ? '创建中…' : '创建项目' }}
        </button>
        <button type="button" class="btn btn-reset" @click="onReset">重置</button>
      </div>

      <!-- 提交结果提示：成功 = 红色突出显示；错误 = 红色提示 -->
      <p v-if="successMsg" class="submit-success">{{ successMsg }}</p>
      <p v-if="submitMsg && isError" class="submit-msg error">{{ submitMsg }}</p>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
// 全国省 / 市 / 区(县) 三级行政区划数据（纯数据，来自 element-china-area-data）
import { regionData } from 'element-china-area-data'
// 科研项目接口
import { createProject } from '../../api'

const provinces = regionData
const isError = ref(false)
const submitMsg = ref('')
const successMsg = ref('')
const submitting = ref(false)

const form = reactive({
  name: '',
  province: '',
  city: '',
  district: '',
  remark: ''
})

// 根据已选省，计算出可选市列表
const cities = computed(() => {
  const p = provinces.find((x) => x.value === form.province)
  return p && p.children ? p.children : []
})
// 根据已选市，计算出可选区/县列表
const districts = computed(() => {
  const c = cities.value.find((x) => x.value === form.city)
  return c && c.children ? c.children : []
})

// 切换省：清空市、区
function onProvinceChange() {
  form.city = ''
  form.district = ''
}
// 切换市：清空区
function onCityChange() {
  form.district = ''
}

function labelOf(list, value) {
  const item = list.find((x) => x.value === value)
  return item ? item.label : ''
}

function onSubmit() {
  // 重新提交时清掉上一次的成功提示
  successMsg.value = ''
  if (!form.name) {
    isError.value = true
    submitMsg.value = '请填写项目名称'
    return
  }
  if (!form.province || !form.city || !form.district) {
    isError.value = true
    submitMsg.value = '请完整选择项目地点（省 / 市 / 区或县）'
    return
  }

  // 组装落库数据：省市县各存「编码 + 名称」，编码来自表单 value，名称现算
  const payload = {
    name: form.name,
    province_code: form.province,
    province_name: labelOf(provinces, form.province),
    city_code: form.city,
    city_name: labelOf(cities.value, form.city),
    district_code: form.district,
    district_name: labelOf(districts.value, form.district),
    remark: form.remark
  }

  submitting.value = true
  createProject(payload)
    .then((res) => {
      if (res && res.success) {
        isError.value = false
        submitMsg.value = ''
        // 先记下本次创建的名称与编号，再重置表单（重置不会清掉这条成功提示）
        const createdName = form.name
        const createdNo = res.projectNo
        onReset()
        successMsg.value = `已创建项目「${createdName}」，编号：${createdNo}（创建成功）`
      } else {
        isError.value = true
        submitMsg.value = (res && res.message) || '创建失败，请稍后重试'
      }
    })
    .catch(() => {
      isError.value = true
      submitMsg.value = '网络或数据库异常，请稍后重试'
    })
    .finally(() => {
      submitting.value = false
    })
}

function onReset() {
  form.name = ''
  form.province = ''
  form.city = ''
  form.district = ''
  form.remark = ''
  submitMsg.value = ''
  successMsg.value = ''
  isError.value = false
}
</script>

<style scoped>
.module {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  min-height: auto;
  width: 100%;
  margin: 0 auto;
}
.module-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 6px;
}
.module-tip {
  font-size: 13px;
  color: #8a9099;
  margin: 0 0 20px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.form-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.form-label {
  flex: 0 0 84px;
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
.form-textarea {
  flex: 1 1 auto;
  min-height: 80px;
  max-height: 180px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  line-height: 1.5;
  color: #1f2329;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
}
.form-textarea:focus {
  border-color: #0d80e0;
}
.region-selects {
  flex: 1 1 auto;
  display: flex;
  gap: 10px;
}
.form-select {
  flex: 1 1 0;
  min-width: 0;
  height: 38px;
  padding: 0 8px;
  font-size: 14px;
  color: #1f2329;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}
.form-select:focus {
  border-color: #0d80e0;
}
.form-select:disabled {
  background: #f5f7fa;
  color: #b7bdc6;
  cursor: not-allowed;
}
.form-select.placeholder {
  color: #8a9099;
}
.form-actions {
  display: flex;
  gap: 12px;
  padding-left: 100px;
}
.btn {
  height: 38px;
  padding: 0 22px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.btn-submit {
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  color: #fff;
  font-weight: 600;
}
.btn-submit:hover {
  opacity: 0.92;
}
.btn-submit:disabled {
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
.submit-msg {
  margin: 0 0 0 100px;
  font-size: 13px;
  color: #f53f3f;
}
/* 创建成功：红色突出显示 */
.submit-success {
  margin: 0 0 0 100px;
  font-size: 15px;
  font-weight: 700;
  color: #d93026;
  background: #fdecec;
  border: 1px solid #f2b8b0;
  border-radius: 8px;
  padding: 10px 14px;
}
</style>
