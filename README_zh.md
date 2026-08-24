# 科研实验系统 · Scientific Experiment System

[English](#english-version) | [中文](#中文版)

---

一个本地运行的科研实验桌面应用：以“项目”为单位，完成 **地图数据导入 → 坐标数据处理 → 路径距离计算 → 结果可视化** 的全流程。基于 Electron + Vue 3 + MySQL 构建，Electron 主进程即后端，直连数据库，无需部署独立服务。

![version](https://img.shields.io/badge/version-1.3.2-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![electron](https://img.shields.io/badge/Electron-31-2b2e42)
![vue](https://img.shields.io/badge/Vue-3.4-42b883)
![mysql](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

## 目录

- [系统定位](#系统定位)
- [主要功能](#主要功能)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [常用脚本](#常用脚本)
- [架构要点](#架构要点)
- [许可证](#许可证)
- [Star 历史](#star-历史)

## 系统定位

本系统面向科研实验中“起点 → 终点”路径距离/时长类的实验场景，解决数据分散、流程繁琐、结果不可视的问题：

- **一个项目一套数据**：每个实验项目独立管理，导入的地图数据、起点/终点坐标、计算结果按项目归档，进度一目了然（首页展示各项目 5 个阶段完成情况）。
- **两条数据路线**：项目可选择「API 导入」（配置地图服务商接口，在线计算距离）或「路网导入」（导入 OSM 路网文件，本地 OSRM 引擎计算），两者互斥。
- **批量计算与可视化**：基于导入的数据批量计算路径距离与时长，并把行政区域、路网与起终点在地图上直观呈现。

适合需要批量处理“起点 → 终点”距离/时长的科研实验，如交通、物流、可达性等相关研究。

## 主要功能

### 项目管理

- **新建项目**：项目名称 + 省 / 市 / 区（县）三级联动选址 + 备注；项目编号（XM1、XM2…）自动递增，删除后不复用；创建人自动记录为当前登录账号。
- **项目列表**：按名称 / 省 / 市 / 区县筛选，分页展示，支持编辑与删除；每个用户只看到自己创建的项目。

### 地图数据导入（每个项目二选一，互斥）

- **API 导入**：配置地图服务商（高德 / 百度 / 腾讯 / 天地图）的平台、API Key 与基础网址，支持自定义 URL 参数模板并实时预览完整请求地址。
- **路网导入**：通过系统文件框选择 `.osm` / `.osm.pbf` 路网文件，自动复制到项目专属目录（重名自动改名、不覆盖原文件）。

### 坐标数据处理

- **起点 / 终点坐标数据**：支持 txt / csv / excel 文件导入，逐行校验经纬度后入库；提供三种示例文件下载；表格分页，支持编辑 / 删除。

### 运行计算

- **路网计算**：调用本地 OSRM 引擎（extract / partition / customize / routed）对导入的路网文件预处理并批量计算路径距离。
- **API 计算**：按配置的地图服务商与参数模板，批量请求在线距离接口，返回距离与时长。
- 计算结果按批次归档，展示汇总（总对数 / 成功 / 失败 / 总里程 / 总时长）。

### 可视化

- 以行政区域边界为底（阿里云 DataV 数据），叠加高德路网瓦片，只显示行政区域范围内的路网；起点红色、终点蓝色标记，视野自动贴合行政区域。
- 目前可视化覆盖「API 导入」项目；「路网导入」分支正在开发中。

### 系统管理

- 多套 MySQL 数据库连接管理（新增 / 切换 / 删除）；系统信息与版本查看；用户管理（管理员）；个人资料与修改密码。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | Vue 3（`<script setup>`）+ Vue Router 4 |
| 构建工具 | Vite 5 |
| 桌面外壳 | Electron 31 |
| 数据库 | MySQL（mysql2 驱动） |
| 行政区划 | element-china-area-data |
| 路网计算 | OSRM（外部可执行程序） |
| 打包 | electron-builder |

## 目录结构

```
scientific_experiment_system/
├── electron/
│   ├── main.js                      # 主进程：窗口管理 + 全部 IPC
│   ├── preload.js                   # 预加载脚本，向 window.api 暴露白名单接口
│   ├── db/
│   │   ├── create_new_database.js             # 建库建表 + 默认管理员
│   │   └── database_default_connections.js    # 默认数据库连接清单
│   ├── osrm/
│   │   ├── calc.js                  # OSRM 路网计算（spawn exe + 并发池）
│   │   └── bin/                     # OSRM 可执行程序与 car.lua 配置
│   └── mapapi/
│       └── calc.js                  # API 距离计算（高德 / 百度 / 腾讯 / 天地图）
├── src/
│   ├── api/index.js                 # 前端 IPC 统一封装
│   ├── router/index.js              # 路由（由 navConfig 自动生成）
│   ├── navConfig.js                 # 左侧导航配置（数据驱动）
│   ├── session.js                   # 登录态（localStorage，默认 24h）
│   ├── views/
│   │   ├── LoginView.vue            # 登录页
│   │   ├── HomeView.vue             # 主框架（左侧导航 + 内容区）
│   │   ├── HomePageView.vue         # 首页（项目进度总览 + 快捷入口）
│   │   ├── exp-1/                   # 新建项目 / 项目列表
│   │   ├── exp-2/                   # API 导入 / 路网导入
│   │   ├── exp-3/                   # 起点坐标 / 终点坐标
│   │   └── exp-4/                   # 计算结果 / 可视化
│   └── assets/                      # 图片资源
├── build/icon.ico
├── index.html
├── vite.config.mjs
└── package.json
```

## 环境要求

- **Node.js** 18+（已验证 22.x 可用）
- **MySQL** 5.7+ / 8.x
- **操作系统**：Windows（主要）/ macOS / Linux

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 数据库初始化（自动完成）

无需手动执行初始化脚本：应用启动时会对当前生效的数据库幂等补齐缺失的表（`user` / `project` / `map_data_import` / `coord_data` / `calc_result`）。默认的阿里云连接已初始化，可直接登录使用；也可自行添加数据库（本地数据库和云数据库均可）。

### 3. 启动开发模式

```bash
npm run dev
```

同时启动 Vite 开发服务器（5173 端口）与 Electron 窗口。

> 说明：
> - 可视化中的行政区域边界（阿里云 DataV）与高德路网瓦片需要联网。
> - 路网计算依赖 `electron/osrm/bin/` 下的 OSRM 可执行程序（extract / partition / customize / routed）与 `profiles/car.lua` 配置。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 开发模式：Vite + Electron 同时运行 |
| `npm run vite` | 仅启动 Vite 开发服务器 |
| `npm run build` | 前端构建到 `dist/` |
| `npm run start` | 仅启动 Electron（需先 `build`） |
| `npm run pack` | 构建并打包为安装包，输出到 `release/` |

> 打包注意：建议使用管理员终端执行 `npm run pack`。若要在本地以外的环境运行，请将 `electron/db/database_default_connections.js` 中的默认连接改为对应 MySQL 数据库的信息。

## 架构要点

- **Electron 主进程即后端**：`electron/main.js` 监听 `auth` / `sys` / `project` / `mapData` / `coord` / `calc` / `apiCalc` / `viz` / `file` 等 IPC，直接操作 MySQL；文件解析、文件复制、计算调度等也都在主进程完成。
- **前端通过 `window.api` 调用**：`electron/preload.js` 仅暴露白名单接口，`src/api/index.js` 统一封装。
- **数据权限在服务端控制**：所有业务数据的 `created_by` 由主进程注入当前登录账号，列表查询按当前用户过滤，前端无法伪造。
- **路由采用 hash 模式**：打包后通过 `file://` 打开也能正确定位子路由，避免白屏。
- **数据驱动导航**：`navConfig.js` 一份配置生成左侧导航与全部子路由。

## 许可证

[MIT](https://opensource.org/licenses/MIT) © yconghua

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=yconghua/scientific_experiment_system&type=Date)](https://star-history.com/#yconghua/scientific_experiment_system&Date)