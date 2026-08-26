# Scientific Experiment System

A locally-run desktop application for scientific experiments that calculates **the shortest path, distance, and travel time between points**. Organized by "project", it integrates map data import, origin/destination coordinate management, path calculation, and result visualization into one clear workflow—helping researchers perform batch, traceable path analysis.

Built on Electron + Vue 3 + MySQL; the Electron main process acts as the backend, connecting directly to the database with no separate server deployment required.

![version](https://img.shields.io/badge/version-1.3.9-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![electron](https://img.shields.io/badge/Electron-31-2b2e42)
![vue](https://img.shields.io/badge/Vue-3.4-42b883)
![mysql](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

[English](./README.md) | [中文](./README_zh.md)

---

## System Positioning

This system targets scientific experiments that need batch processing of "origin → destination" paths, solving three common problems: scattered data, cumbersome workflows, and non-visual results.

- **What it does**: Provides batch calculation of the shortest path, distance, and travel time between points for scientific experiments, and supports visualizing administrative boundaries, road networks, and origin/destination points on a map.
- **Who it's for**: Researchers who need batch origin-destination path analysis, suitable for transportation, logistics, accessibility, and related studies.
- **Core value**: One project, one dataset, fully traceable—from data import to results, every step is archived within the project, with clear progress tracking.

## Core Features

- **Project Management**: Manage experiments by project; automatically archive map data, coordinates, and results; the homepage shows each project's progress.
- **Map Data Import**: "API Import" (configure map providers like Amap / Baidu / Tencent / Tianditu) or "Road Network Import" (import OSM road network files, computed locally via the OSRM engine); mutually exclusive per project.
- **Origin / Destination Coordinate Management**: Batch-import origin/destination coordinates (txt / csv / excel), validated line-by-line for latitude/longitude before storage.
- **Path Calculation**: Batch-calculate path distance and travel time via the local OSRM engine or map APIs; results archived by batch with a summary (total pairs / success / failure / total mileage / total duration).
- **Visualization**: Administrative regions as the base map with road network tiles overlaid; origins marked red, destinations blue; the view auto-fits the region.
- **System Management**: Manage multiple MySQL database connections, user & role management (admin), and run-log viewing (admin).

## Quick Start

### Option 1: Download Installer (recommended for regular users)

Go to [GitHub Releases](https://github.com/yconghua/scientific_experiment_system/releases) and download the installer for your system, then install and open it directly.

- The system ships with a default database connection pre-initialized, so it **works out of the box—no database setup required**. To use your own MySQL, go to "System Settings → Switch Database" to add one .
- For first login you can use the built-in test account:
  - Account: `测试用户001`
  - Password: `123456`

### Option 2: Run from Source (for developers)

Requirements: Node.js 18+ (verified on 22.x), MySQL 5.7+ / 8.x, Windows (primary) / macOS / Linux

```bash
npm install      # install dependencies
npm run dev      # start Vite dev server and Electron window together
```

> Note: The administrative boundary (Alibaba Cloud DataV) and map tiles in visualization, as well as some map-API calculations, require internet access; road network calculation depends on the built-in OSRM executables.

## License

[MIT](https://opensource.org/licenses/MIT) © yconghua

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yconghua/scientific_experiment_system&type=Date)](https://star-history.com/#yconghua/scientific_experiment_system&Date)
