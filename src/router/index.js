import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import ProfileView from '../views/ProfileView.vue'
import NavView from '../views/NavView.vue'
import HomePageView from '../views/HomePageView.vue'
import { navGroups, navTopItems, defaultNavPath } from '../navConfig'
import { isSessionValid, clearSession } from '../session'

// 各子导航页面对应的真实组件（每个页面一个独立文件，按导航栏分文件夹存放）
import AA from '../views/exp-1/NewProjectView.vue'
import AB from '../views/exp-1/ProjectListView.vue'
import BA from '../views/exp-2/ApiImportView.vue'
import BB from '../views/exp-2/RoadImportView.vue'
import CA from '../views/exp-3/StartCoordView.vue'
import CB from '../views/exp-3/EndCoordView.vue'
import DA from '../views/exp-4/ResultView.vue'
import DB from '../views/exp-4/VisualizationView.vue'

// 子项 key → 组件 映射：新增 / 调整导航时，记得在这里登记对应页面组件
const childComponentMap = {
  'exp-11': AA,
  'exp-12': AB,
  'exp-21': BA,
  'exp-22': BB,
  'exp-31': CA,
  'exp-32': CB,
  'exp-41': DA,
  'exp-42': DB
}

// 顶部独立导航项路由（如「首页」）；首页用专属内容组件，其余仍用占位 NavView
const navTopRoutes = navTopItems.map((item) => ({
  path: item.key,
  name: item.key,
  component: item.key === 'home' ? HomePageView : NavView,
  meta: { title: item.title }
}))

// 由导航配置生成下拉子路由：每个子项映射到各自的独立页面组件（标题取自 config）
const navChildren = navGroups.flatMap((group) =>
  group.children.map((child) => ({
    path: child.key,
    name: child.key,
    component: childComponentMap[child.key] || NavView,
    meta: { title: child.title }
  }))
)

const routes = [
  { path: '/login', name: 'login', component: LoginView },
  {
    path: '/',
    component: HomeView,
    children: [
      { path: '', redirect: defaultNavPath },
      ...navTopRoutes,
      ...navChildren,
      { path: 'profile', name: 'profile', component: ProfileView }
    ]
  }
]

const router = createRouter({
  // hash 模式：打包后走 file:// 也能直接定位子路由，不会白屏
  history: createWebHashHistory(),
  routes
})

// 轻量登录守卫：基于 localStorage 中的会话过期时间判断（固定 24 小时有效）
router.beforeEach((to) => {
  const valid = isSessionValid()
  if (!valid) {
    // 过期或缺失：清除陈旧登录态，跳回登录页
    clearSession()
    return to.path === '/login' ? true : '/login'
  }
  if (to.path === '/login') return '/'
  return true
})

export default router
