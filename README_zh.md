# 科研实验系统（Scientific Experiment System）

一个本地运行的科研实验桌面应用，用于计算**点与点之间的最短路径、路径距离与耗时**。它以「项目」为单位，把地图数据导入、起终点坐标管理、路径计算与结果可视化整合到一套清晰流程里，帮助科研人员进行批量、可追溯的路径分析。

基于 Electron + Vue 3 + MySQL 构建；Electron 主进程即后端，直接连接数据库，无需额外部署服务器。

![version](https://img.shields.io/badge/version-1.3.7-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![electron](https://img.shields.io/badge/Electron-31-2b2e42)
![vue](https://img.shields.io/badge/Vue-3.4-42b883)
![mysql](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

[English](./README.md) | [中文](./README_zh.md)

---

## 系统定位

本系统面向需要批量处理「起点 → 终点」路径的科研实验，解决数据分散、流程繁琐、结果不可视三类问题：

- **它是干什么的**：为科研实验提供点与点之间最短路径、距离、耗时的批量计算，并支持在地图上直观查看行政边界、路网与起终点。
- **给谁用**：需要进行批量起终点路径分析的科研人员，适用于交通、物流、可达性等相关研究。
- **核心价值**：一个项目一套数据，全流程可追溯——从导入数据到得出结果，每一步都在项目内归档，进度清晰可查。

## 核心功能

- **项目管理**：以项目为单位管理实验，自动归档地图数据、坐标与计算结果；首页展示各项目进度。
- **地图数据导入**：支持「API 导入」（配置高德 / 百度 / 腾讯 / 天地图等地图服务商接口）或「路网导入」（导入 OSM 路网文件，本地 OSRM 引擎计算），每个项目二选一、互斥。
- **起终点坐标管理**：批量导入起点 / 终点坐标（txt / csv / excel），自动逐行校验经纬度后入库。
- **路径计算**：调用本地 OSRM 引擎或地图 API 批量计算路径距离与耗时，结果按批次归档并汇总（总对数 / 成功 / 失败 / 总里程 / 总时长）。
- **结果可视化**：以行政区域为底图叠加路网瓦片，标记起点（红）与终点（蓝），视野自动贴合区域。
- **系统管理**：多套 MySQL 数据库连接管理、用户与权限管理（管理员）、运行日志查看（管理员）。

## 快速开始

### 方式一：下载安装包（推荐普通用户）

前往 [GitHub Releases](https://github.com/yconghua/scientific_experiment_system/releases) 下载对应系统的安装包，安装后直接打开即可使用。

- 系统已内置默认数据库连接，**打开即用，无需自行准备数据库**；如需使用自己的 MySQL，可在「系统设置 → 切换数据库」中添加（连接账号密码由管理员提供，不会在本文档中公开）。
- 首次登录可使用内置测试账号：
  - 账号：`测试用户001`
  - 密码：`123456`

### 方式二：源码运行（开发者）

环境要求：Node.js 18+（已验证 22.x 可用）、MySQL 5.7+ / 8.x、Windows（主要）/ macOS / Linux。

```bash
npm install      # 安装依赖
npm run dev      # 同时启动 Vite 开发服务器与 Electron 窗口
```

> 说明：可视化中的行政区域边界（阿里云 DataV）与地图瓦片、部分地图 API 计算需要联网；路网计算依赖内置的 OSRM 可执行程序。

## 许可证

[MIT](https://opensource.org/licenses/MIT) © yconghua

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=yconghua/scientific_experiment_system&type=Date)](https://star-history.com/#yconghua/scientific_experiment_system&Date)
