# 葱花工作室管理系统 (conghua-studio)

> 📅 更新日期：2026年8月20日
>
> 🗂 一个本地运行的桌面应用骨架（Electron + Vue 3 + MySQL）：登录即用，已内置**账号体系**与**系统管理**；其余业务模块由数据驱动导航统一承载，当前显示为「正在开发中」，随开发进度逐个填充。
> Vue 3 + Vite + Electron + MySQL 技术栈，Electron 主进程即后端。

![Version](https://img.shields.io/badge/version-3.6.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/Electron-31-2b2e42)
![Vue](https://img.shields.io/badge/Vue-3.4-42b883)
![MySQL](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

---

## 📑 目录

- [✨ 功能特性](#功能特性)
- [🛠 技术栈](#技术栈)
- [📁 目录结构](#目录结构)
- [📋 环境要求](#环境要求)
- [🚀 快速开始](#快速开始)
- [📜 常用脚本](#常用脚本)
- [🧩 功能模块](#功能模块)
- [🤝 交互约定](#交互约定)
- [🏗 架构要点](#架构要点)
- [🗺 路线图 / 已知占位](#路线图--已知占位)
- [🤝 参与贡献](#参与贡献)
- [📄 许可证](#许可证)

---

## ✨ 功能特性

- **本地桌面、数据私有**：基于 Electron 打包，主进程直连本地 / 云端 MySQL，无需独立后端服务，数据落库在你自己的数据库。
- **账号与登录守卫**：基于 `localStorage` 的会话过期机制（默认 24h），未登录自动跳回登录页；支持修改密码与用户管理。
- **测试项目**：匹配最短路径脚本（`python_scripts/dijkstra_coord.py`）输入格式的输入测试表单，可生成脚本输入 JSON。
- **可扩展的导航骨架**：左侧导航由 `src/navConfig.js` 数据驱动，新增模块只改配置即可自动生成路由；当前业务模块以「正在开发中」占位，便于后续逐个填充。
- **开发者笔记（本地）**：`DEV_NOTES.md` 仅本地记录、已被 `.gitignore` 忽略，不上传 GitHub。

---

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | Vue 3 (`<script setup>`) + Vue Router 4 |
| 构建工具 | Vite 5 |
| 桌面外壳 | Electron 31 |
| 数据库 | MySQL（通过 `mysql2` 驱动） |
| 认证 | `bcryptjs`（密码哈希） |
| 路径计算 | `geojson-path-finder`、`leaflet`（为最短路径功能规划引入，当前该功能为「正在开发中」占位，尚未接入） |
| 打包 | `electron-builder` |

---

## 📁 目录结构

```
conghua-studio/
├── electron/
│   ├── main.js          # Electron 主进程：窗口管理 + 后端 IPC（auth / sys 两组）
│   ├── preload.js       # 预加载脚本，向 window.api 暴露 auth / sys 接口
│   └── db/
│       └── create_new_database.js # 数据库初始化逻辑（建库 + user 表 + 默认管理员，添加数据库时自动调用）
├── src/
│   ├── api/index.js      # 前端 IPC 封装（仅 auth / sys）
│   ├── App.vue
│   ├── main.js
│   ├── navConfig.js      # 左侧导航配置（数据驱动，增减导航只改此文件）
│   ├── router/index.js   # 路由（由 navConfig 自动生成子路由）
│   ├── session.js        # 登录态（localStorage，默认 24h 有效）
│   ├── assets/           # 登录背景、Logo 等图片资源
│   └── views/            # 页面组件
│       ├── LoginView.vue        # 登录页
│       ├── HomeView.vue         # 应用外壳（侧边导航 + 内容区）
│       ├── HomePageView.vue     # 首页（欢迎 + 模块开发提示）
│       ├── NavView.vue          # 通用占位页（显示「正在开发中」）
│       ├── TestView.vue            # 最短路径脚本输入测试表单
│       └── ProfileView.vue      # 个人中心（系统管理 / 开发者日志 / 用户管理）
├── build/icon.ico
├── DEV_NOTES.md          # 开发者个人笔记（本地，已被 .gitignore 忽略，不上传）
├── index.html
├── vite.config.mjs
└── package.json
```

> 业务数据表（`civil_service_exam` / `central_soe` / `university` / `local_soe` / `private_soe`）及其对应页面已移除以精简项目，当前数据库仅保留 `user` 表。

---

## 📋 环境要求

- **Node.js** 18+（已验证 22.x 可用）
- **MySQL** 5.7+ / 8.x
- **操作系统**：Windows（主要）/ macOS / Linux（Electron 跨平台）

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 数据库初始化（自动完成）

无需手动执行初始化脚本：在登录页「系统设置 → 添加数据库」时，主进程会自动建库（不存在则建）、创建 `user` 表并写入默认管理员（账号 `admin` / 密码 `admin123`）。默认的阿里云连接已初始化，可直接登录使用。

### 3. 启动开发模式

```bash
npm run dev
```

同时启动 Vite 开发服务器（5173 端口）与 Electron 窗口。

---

## 📜 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式：Vite + Electron 同时运行 |
| `npm run vite` | 仅启动 Vite 开发服务器 |
| `npm run build` | 前端构建到 `dist/` |
| `npm run start` | 仅启动 Electron（需先 `build`） |
| `npm run pack` | 构建并打包为安装包，输出到 `release/` |

> **打包注意**：建议使用**管理员终端**执行 `npm run pack`。若要在本地以外的环境运行，请将 `electron/db/database_default_connections.js` 中的默认连接改为对应 MySQL 数据库的相关信息（连接参数直接内置在代码中，不再使用 `.env`）。

---

## 🧩 功能模块

导航由 `src/navConfig.js` 数据驱动，路由由 `src/router/index.js` 自动生成。所有子项统一由 `NavView` 承载，显示「正在开发中」。

### 顶部
- **首页**（`/home`，`HomePageView`）：欢迎横幅 + 「功能模块正在开发中」提示。

### 个人空间
- **测试项目**（`/example-19`，`TestView`）：匹配 `python_scripts/dijkstra_coord.py` 输入格式的测试表单，填写坐标系、节点、边、起终点后一键生成脚本输入 JSON。

### 系统 / 用户
- **个人中心**（`/profile`，`ProfileView`）：含「系统管理」页签，可查看**开发者日志**、进行**用户管理**（查看 / 新增 / 编辑 / 删除用户、修改密码）。

### 其余导航项
- 大分组与子项当前为占位文案（如「示例导航栏1~4」「示例小导航栏11~18」），点击均进入 `NavView` 的「正在开发中」占位页，便于后续逐个接入真实模块。

---

## 🤝 交互约定

- **占位即开发提示**：尚未实现的导航子项由 `NavView` 统一显示「正在开发中」，无需为每个模块单独写页面。
- **登录守卫**：基于 `localStorage` 中的会话过期时间（默认 24h），`router.beforeEach` 拦截未登录访问，主页与子路由均需登录。
- **网页端限制**：`window.api` 由 Electron `preload.js` 注入，网页端（纯 Vite）无此对象。涉及数据库的功能（登录 / 用户管理 / 系统信息）依赖 Electron 环境。
- **删除确认**：用户管理等涉及删除的操作使用自定义页面内弹窗二次确认，不使用浏览器原生 `confirm()` / `alert()`。

---

## 🏗 架构要点

- **Electron 主进程即后端**：`electron/main.js` 仅监听 `auth` / `sys` 两组 IPC，直接操作 MySQL（当前仅 `user` 表）。
- **前端通过 `window.api` 调用**：`electron/preload.js` 仅暴露 `auth` / `sys` 分组，`src/api/index.js` 做统一封装。
- **路由采用 hash 模式**：打包后通过 `file://` 打开也能正确定位子路由，避免白屏。
- **数据驱动导航**：`navGroups.flatMap` 自动由 `navConfig` 生成子路由，所有子项均回退 `NavView` 占位页。

---

## 🗺 路线图 / 已知占位

以下功能当前显示「正在开发中」占位，尚未实现真实内容，计划在后续版本补全：

- 「示例导航栏 / 示例小导航栏」各占位导航项承载的业务模块
- 首页数据概览、我的收藏等聚合模块
- 个人中心的笔记等子模块
- 最短路径计算页接入真实 GeoJSON 路网（`geojson-path-finder`）与 Leaflet 交互地图

---

## 🤝 参与贡献

欢迎通过 Issue 与 Pull Request 参与本项目。提交前请先 `npm install` 并本地 `npm run dev` 自测，确保不影响现有功能与数据库脚本。

---

## 📄 许可证

[MIT](https://opensource.org/licenses/MIT) © conghua
