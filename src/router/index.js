import { createRouter, createWebHashHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'
import HomeView from '../views/HomeView.vue'
import ProfileView from '../views/ProfileView.vue'
import NavView from '../views/NavView.vue'
import HomePageView from '../views/HomePageView.vue'
import TestView from '../views/TestView.vue'
import { navGroups, navTopItems, defaultNavPath } from '../navConfig'
import { isSessionValid, clearSession } from '../session'

// 顶部独立导航项路由（如「首页」）；首页用专属内容组件，其余仍用占位 NavView
const navTopRoutes = navTopItems.map((item) => ({
  path: item.key,
  name: item.key,
  component: item.key === 'home' ? HomePageView : NavView,
  meta: { title: item.title }
}))

// 由导航配置生成下拉子路由：所有子项均使用占位 NavView（标题取自 config）
const navChildren = navGroups.flatMap((group) =>
  group.children.map((child) => {
    const component = child.key === 'example-19' ? TestView : NavView
    return { path: child.key, name: child.key, component, meta: { title: child.title } }
  })
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
