import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// 注意：本文件为 ESM（.mjs），Electron 主进程 electron/main.js 仍为 CommonJS。
export default defineConfig({
  plugins: [vue()],
  // 打包后用相对路径，便于 Electron 以 file:// 加载 dist/index.html
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
