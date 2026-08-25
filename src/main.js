import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
// 渲染进程 console / 未捕获异常 → 主进程日志（run_log，source=console）
import './consoleBridge'

createApp(App).use(router).mount('#app')
