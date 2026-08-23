# 科研实验系统 (Scientific Experiment System)

> 📅 更新日期：2026年8月23日
>
> 🗂 一个本地运行的桌面应用（Electron + Vue 3 + MySQL），面向科研实验场景：项目管理、地图数据导入、坐标数据处理一体化。Electron 主进程即后端，直接连接 MySQL，无需独立服务。

![Version](https://img.shields.io/badge/version-1.1.0-blue)
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
- [🏗 架构要点](#架构要点)
- [📄 许可证](#许可证)

---

## ✨ 功能特性

- **本地桌面、数据私有**：基于 Electron 打包，主进程直连本地 / 云端 MySQL，无需独立后端服务，数据落库在你自己的数据库。
- **账号体系**：登录 / 退出 / 修改密码；会话基于 `localStorage`（默认 24h），未登录自动跳回登录页；管理员可进行用户管理（新增 / 编辑 / 删除）。
- **项目全流程管理**：
  - **新建项目**：项目名称 + 省 / 市 / 区（县）三级联动选址 + 备注；项目编号（XM1、XM2…）自动生成、严格递增、删除后不复用；创建人自动记录当前登录账号。
  - **项目列表**：按项目名称、省、市、区县多条件筛选；每页 5 行分页；编辑 / 删除（弹窗确认）；每个用户只看到自己创建的项目。
- **地图数据导入**（每项目仅限一种方式，二选一互斥，切换项目时红色提示）：
  - **API 导入**：录入 API 提供平台、API Key、API 网址；
  - **路网导入**：系统文件框选择路网文件，自动复制到项目目录（重名自动改名不覆盖），记录原始路径与复制路径。
- **坐标数据处理**：
  - **起点 / 终点坐标数据**：支持 txt / csv / excel 三种文件，提交时读取并解析文件内容、逐行校验经纬度后入库；提供 txt / csv / excel 三种示例文件下载；数据表格每页 5 行分页，支持编辑 / 删除。
- **系统管理**：查看系统名称 / 版本号、当前数据库连接信息；支持多套数据库连接的新增、切换、删除。

---

## 🛠 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | Vue 3 (`<script setup>`) + Vue Router 4 |
| 构建工具 | Vite 5 |
| 桌面外壳 | Electron 31 |
| 数据库 | MySQL（`mysql2` 驱动） |
| 认证 | `bcryptjs`（密码哈希） |
| 行政区划 | `element-china-area-data`（省市区数据） |
| 表格解析 | `xlsx`（Excel 文件解析与生成） |
| 打包 | `electron-builder` |

---

## 📁 目录结构

```
scientific_experiment_system/
├── electron/
│   ├── main.js          # Electron 主进程：窗口管理 + 全部 IPC（auth / sys / project / mapData / coord / dialog）
│   ├── preload.js       # 预加载脚本，向 window.api 暴露各业务接口
│   └── db/
│       ├── create_new_database.js          # 建库建表（user / project / map_data_import / coord_data + 默认管理员）
│       └── database_default_connections.js # 默认数据库连接清单
├── src/
│   ├── api/index.js      # 前端 IPC 统一封装
│   ├── App.vue / main.js
│   ├── navConfig.js      # 左侧导航配置（数据驱动）
│   ├── router/index.js   # 路由（由 navConfig 自动生成子路由）
│   ├── session.js        # 登录态（localStorage，默认 24h）
│   ├── assets/           # 登录背景、Logo 等图片资源
│   └── views/            # 页面组件（按导航栏分文件夹）
│       ├── LoginView.vue / HomeView.vue / HomePageView.vue / NavView.vue / ProfileView.vue
│       ├── exp-1/        # 新建项目
│       │   ├── NewProjectView.vue   # 新建项目表单
│       │   └── ProjectListView.vue  # 项目列表
│       ├── exp-2/        # 地图数据导入
│       │   ├── ApiImportView.vue    # API 导入
│       │   └── RoadImportView.vue   # 路网导入
│       └── exp-3/        # 加载点位数据
│           ├── StartCoordView.vue   # 起点坐标数据
│           └── EndCoordView.vue     # 终点坐标数据
├── build/icon.ico
├── index.html
├── vite.config.mjs
└── package.json
```

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

无需手动执行初始化脚本：在登录页「系统设置 → 添加数据库」时，主进程会自动建库（不存在则建）、创建业务表（`user` / `project` / `map_data_import` / `coord_data`）并写入默认管理员（账号 `admin` / 密码 `admin123`）。应用启动时也会对当前生效的数据库幂等补齐缺失的表。默认的阿里云连接已初始化，可直接登录使用。

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

导航由 `src/navConfig.js` 数据驱动，路由由 `src/router/index.js` 自动生成。

### 新建项目
- **新建项目**：填写项目名称、省 / 市 / 区（县）三级联动选择项目地点、备注；提交后项目编号（XM1、XM2…）自动生成（严格递增，删除后不复用），创建人自动记录为当前登录账号。
- **项目列表**：展示当前用户创建的项目（项目编号 / 名称 / 地点 / 备注 / 操作）；支持按项目名称、省、市、区县筛选；每页 5 行、显示「第 X 页 / 共 Y 页」；支持编辑与删除（弹窗确认）。

### 地图数据导入（每个项目只能使用其中一种方式）
- **API 导入**：选择项目 → 录入 API 提供平台、API Key、API 网址 → 提交入库；下方表格展示该项目的 API 导入记录，支持编辑 / 删除。
- **路网导入**：选择项目 → 通过系统文件框选择路网文件（自动复制到 `userData/projects/{项目编号}/`，重名自动改名、不覆盖原文件）→ 提交入库；下方表格展示该项目的路网导入记录，支持编辑 / 删除。
- 若某项目已使用其中一种方式，在另一页面选择该项目时，会以红色文字持续提示互斥。

### 加载点位数据
- **起点坐标数据 / 终点坐标数据**：选择项目 → 通过系统文件框选择坐标文件（支持 txt / csv / excel，表头格式为 `No,Name,Longitude,Latitude`）→ 提交后由后端解析文件内容、逐行校验经纬度并入库；页面提供 txt / csv / excel 三种示例文件下载；下方表格展示解析入库的数据行（序号 / 点名称 / 经度 / 纬度），每页 5 行，支持编辑 / 删除。

### 个人空间
- **个人中心**：查看系统信息（系统名称 / 版本号）、当前数据库连接信息；管理员可进行用户管理（新增 / 编辑 / 删除用户）；支持修改密码。

---

## 🏗 架构要点

- **Electron 主进程即后端**：`electron/main.js` 监听 `auth` / `sys` / `project` / `mapData` / `coord` / `dialog` 等 IPC，直接操作 MySQL 业务表；文件解析、文件复制等操作也在主进程完成。
- **前端通过 `window.api` 调用**：`electron/preload.js` 仅暴露白名单接口，`src/api/index.js` 统一封装。
- **数据权限在服务端控制**：所有业务数据的 `created_by` 由主进程注入当前登录账号，列表查询按当前用户过滤，前端无法伪造。
- **路由采用 hash 模式**：打包后通过 `file://` 打开也能正确定位子路由，避免白屏。
- **数据驱动导航**：`navGroups.flatMap` 自动由 `navConfig` 生成子路由。
- **文件数据解析**：坐标文件（txt / csv / excel）在提交时读取并解析成结构化数据后入库；路网文件选择后复制到项目专属目录（`userData/projects/{项目编号}/`）。

---

## 📄 许可证

[MIT](https://opensource.org/licenses/MIT) © conghua
