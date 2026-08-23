<template>
  <div class="home-layout">
    <!-- 顶部标题栏 -->
    <header class="home-header">
      <div class="brand-wrap">
        <img class="brand-logo" :src="logoUrl" alt="葱花工作室" />
        <span class="brand">葱花工作室管理系统</span>
      </div>
      <div class="header-right">
        <span class="clock">{{ clock }}</span>
        <RouterLink to="/profile" class="logout-btn">个人主页</RouterLink>
        <button class="logout-btn" @click="onLogout">退出登录</button>
      </div>
    </header>

    <!-- 中间主体：左侧导航 + 右侧内容 -->
    <div class="home-body">
      <nav class="home-nav">
        <div class="nav-top-wrap">
          <RouterLink
            v-for="item in navTopItems"
            :key="item.key"
            :to="`/${item.key}`"
            class="nav-top"
            @click="collapseAll"
          >{{ item.title }}</RouterLink>
        </div>
        <div v-for="(group, gi) in navGroups" :key="gi" class="nav-group">
          <button class="nav-parent" :class="{ active: gi === activeGroup }" @click="toggleGroup(gi)">
            <span class="nav-parent-title">{{ group.title }}</span>
            <span class="nav-caret" :class="{ open: openList[gi] || gi === activeGroup }">▸</span>
          </button>
          <div v-show="openList[gi] || gi === activeGroup" class="nav-children">
            <RouterLink
              v-for="child in group.children"
              :key="child.key"
              :to="`/${child.key}`"
              class="nav-item"
            >{{ child.title }}</RouterLink>
          </div>
        </div>
      </nav>

      <main class="home-content">
        <RouterView />
      </main>
    </div>

    <!-- 底部页脚（仅居中显示系统名） -->
    <footer class="home-footer">葱花工作室管理系统</footer>

    <!-- 退出登录确认弹窗 -->
    <div v-if="showConfirm" class="modal-mask" @click.self="cancelLogout">
      <div class="modal-box">
        <p class="modal-text">确定要退出登录吗？</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="cancelLogout" :disabled="exiting">取消</button>
          <button class="modal-btn ok" @click="confirmLogout" :disabled="exiting">{{ exiting ? '退出中…' : '确定退出' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { logout } from '../api'
import { navGroups, navTopItems } from '../navConfig'
import { clearSession } from '../session'
import logoUrl from '../assets/logo.ico'

const router = useRouter()
const route = useRoute()
const showConfirm = ref(false)

// 当前路由所属的分组索引：用于跳转（含快捷入口 router.push）后自动展开对应分组并高亮父级
const activeGroup = computed(() => {
  const path = route.path
  return navGroups.findIndex((g) =>
    g.children.some((c) => path === `/${c.key}` || path.startsWith(`/${c.key}/`))
  )
})

// 左侧导航：手风琴式 —— 同一时间仅一个分组展开；登录默认全部收起
const openList = ref(navGroups.map(() => false))
// 点击某分组：仅展开它（再次点击则收起），其余分组自动收起
function toggleGroup(gi) {
  const willOpen = !openList.value[gi]
  openList.value = navGroups.map((_, i) => i === gi && willOpen)
}
// 点击顶部「首页」等独立项：收起所有分组
function collapseAll() {
  openList.value = navGroups.map(() => false)
}

// 实时时钟
const clock = ref('')
let timer = null
function tick() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  clock.value =
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
onMounted(() => {
  tick()
  timer = setInterval(tick, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// 退出登录：先弹确认框；确认后延迟 2 秒（弹窗保留）再退出
const exiting = ref(false)
function onLogout() {
  exiting.value = false
  showConfirm.value = true
}
async function confirmLogout() {
  if (exiting.value) return
  exiting.value = true
  await new Promise((resolve) => setTimeout(resolve, 2000))
  showConfirm.value = false
  exiting.value = false
  await logout()
  clearSession()
  router.push('/login')
}
function cancelLogout() {
  if (exiting.value) return
  showConfirm.value = false
}
</script>

<style scoped>
.home-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* 顶部标题栏 */
.home-header {
  height: 56px;
  flex: 0 0 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #eceff3;
}
.brand-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-logo {
  width: 26px;
  height: 26px;
  object-fit: contain;
}
.brand {
  font-size: 15px;
  font-weight: 600;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.clock {
  font-size: 13px;
  color: #8a9099;
  font-variant-numeric: tabular-nums;
}
.logout-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #dfe3e8;
  border-radius: 8px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.logout-btn:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}

/* 中间主体 */
.home-body {
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
/* 左侧固定宽度导航 */
.home-nav {
  flex: 0 0 200px;
  width: 200px;
  background: #fff;
  border-right: 1px solid #eceff3;
  padding: 12px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}
/* 下拉分组：父项（可点击展开 / 收起） */
.nav-group {
  display: flex;
  flex-direction: column;
}
.nav-parent {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  background: transparent;
  border: none;
  border-left: 3px solid transparent;
  cursor: pointer;
  text-align: left;
}
.nav-parent:hover {
  background: #f5f7fa;
}
.nav-parent.active {
  color: #0d80e0;
  border-left-color: #0d80e0;
}
.nav-caret {
  font-size: 12px;
  color: #8a9099;
  transition: transform 0.2s;
}
.nav-caret.open {
  transform: rotate(90deg);
}
.nav-children {
  display: flex;
  flex-direction: column;
}
/* 顶部独立导航项（如「首页」），位于下拉分组上方 */
.nav-top-wrap {
  padding-bottom: 4px;
  margin-bottom: 4px;
  border-bottom: 1px solid #eceff3;
}
.nav-top {
  display: block;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  text-decoration: none;
  border-left: 3px solid transparent;
}
.nav-top:hover {
  background: #f5f7fa;
}
.nav-top.router-link-active {
  color: #0d80e0;
  background: #eef6ff;
  border-left-color: #0d80e0;
  font-weight: 600;
}
/* 子项（缩进显示） */
.nav-item {
  padding: 9px 20px 9px 36px;
  font-size: 13px;
  color: #4e5969;
  text-decoration: none;
  border-left: 3px solid transparent;
}
.nav-item:hover {
  background: #f5f7fa;
}
.nav-item.router-link-active {
  color: #0d80e0;
  background: #eef6ff;
  border-left-color: #0d80e0;
  font-weight: 600;
}
/* 右侧内容区 */
.home-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  background: #f5f7fa;
}

/* 底部页脚：仅居中系统名，高度刚好容纳文字 */
.home-footer {
  flex: 0 0 auto;
  text-align: center;
  padding: 8px 0;
  font-size: 13px;
  color: #8a9099;
  background: #fff;
  border-top: 1px solid #eceff3;
}

/* 退出登录确认弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-box {
  width: 300px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  text-align: center;
}
.modal-text {
  font-size: 15px;
  margin: 0 0 20px;
  color: #1f2329;
}
.modal-actions {
  display: flex;
  gap: 12px;
}
.modal-btn {
  flex: 1;
  height: 38px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid #dfe3e8;
}
.modal-btn.cancel {
  background: #fff;
  color: #4e5969;
}
.modal-btn.ok {
  background: linear-gradient(135deg, #0d80e0 0%, #19a558 100%);
  border: none;
  color: #fff;
  font-weight: 600;
}
.modal-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
