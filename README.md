# Scientific Experiment System

[English](./README.md) | [中文](./README_zh.md)

---
A locally-run desktop application for scientific experiments: from **map data import → coordinate data processing → path distance calculation → result visualization**, all within a "project" unit. Built on Electron + Vue 3 + MySQL, with the Electron main process acting as the backend, connecting directly to the database – no need for a separate server deployment.

![version](https://img.shields.io/badge/version-1.3.6-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![electron](https://img.shields.io/badge/Electron-31-2b2e42)
![vue](https://img.shields.io/badge/Vue-3.4-42b883)
![mysql](https://img.shields.io/badge/MySQL-5.7%2B%20%7C%208.x-cb3837)

## Table of Contents

- [System Positioning](#system-positioning)
- [Main Features](#main-features)
- [Technology Stack](#technology-stack)
- [Directory Structure](#directory-structure)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
- [Common Scripts](#common-scripts)
- [Architecture Highlights](#architecture-highlights)
- [License](#license)
- [Star History](#star-history)

## System Positioning

This system is designed for scientific experiments involving "origin → destination" path distance/duration calculations. It addresses the issues of scattered data, cumbersome workflows, and non‑visual results:

- **One project, one dataset** – each experiment project is managed independently. Imported map data, origin/destination coordinates, and calculation results are archived per project, with progress clearly shown on the homepage (5 stages per project).
- **Two data paths** – a project can choose either **API import** (configure map service provider APIs for online distance calculation) or **road network import** (upload OSM road network files, computed locally via the OSRM engine). These options are mutually exclusive.
- **Batch calculation & visualization** – compute path distances and durations in batch based on imported data, and visually present administrative regions, road networks, and origin/destination points on a map.

Ideal for scientific experiments that require batch processing of origin‑destination distances/durations, such as transportation, logistics, accessibility, and related research.

## Main Features

### Project Management

- **Create Project** – project name + province/city/district (county) three‑level cascade selection + notes; project IDs (XM1, XM2, …) auto‑increment and are not reused after deletion; creator is automatically set to the currently logged‑in user.
- **Project List** – filter by name / province / city / district, paginated display, support edit and delete; each user sees only their own projects.

### Map Data Import (one of two, mutually exclusive per project)

- **API Import** – configure map service providers (Amap / Baidu / Tencent / Tianditu) with platform, API Key, and base URL; supports custom URL parameter templates with real‑time preview of the complete request URL.
- **Road Network Import** – select `.osm` / `.osm.pbf` files via system file dialog; the file is automatically copied to the project‑specific directory (renamed if duplicate, never overwriting the original).

### Coordinate Data Processing

- **Origin / Destination Coordinates** – import from txt / csv / excel files; each row is validated for latitude/longitude before storage; three sample file formats are provided for download; table pagination supports edit / delete.

### Run Calculation

- **Road Network Calculation** – invokes the local OSRM engine (extract / partition / customize / routed) to pre‑process the imported road network file and batch calculate route distances.
- **API Calculation** – batches requests to the configured map service provider’s online distance API, returning distance and duration.
- Results are archived by batch, with summaries (total pairs / success / failure / total mileage / total duration).

### Visualization

- Uses administrative boundaries as the base map (Alibaba Cloud DataV data), overlays Amap road network tiles, and only displays roads within the administrative area. Origins are marked red, destinations blue; the view automatically fits to the administrative area.
- Currently supports projects using **API Import**; the **Road Network Import** branch is under development.

### System Management

- Manage multiple MySQL database connections (add / switch / delete); view system info and version; user management (admin); personal profile and password change.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend Framework | Vue 3 (`<script setup>`) + Vue Router 4 |
| Build Tool | Vite 5 |
| Desktop Shell | Electron 31 |
| Database | MySQL (mysql2 driver) |
| Administrative Divisions | element-china-area-data |
| Route Calculation | OSRM (external executables) |
| Packaging | electron-builder |

## Directory Structure

```
scientific_experiment_system/
├── electron/
│   ├── main.js                      # Main process: window management + all IPC handlers
│   ├── preload.js                   # Preload script, exposes whitelisted APIs to window.api
│   ├── db/
│   │   ├── create_new_database.js             # Create database/tables + default admin
│   │   └── database_default_connections.js    # Default database connection list
│   ├── osrm/
│   │   ├── calc.js                  # OSRM route calculation (spawn exe + concurrency pool)
│   │   └── bin/                     # OSRM executables and car.lua configuration
│   └── mapapi/
│       └── calc.js                  # API distance calculation (Amap / Baidu / Tencent / Tianditu)
├── src/
│   ├── api/index.js                 # Frontend IPC unified wrapper
│   ├── router/index.js              # Routes auto‑generated from navConfig
│   ├── navConfig.js                 # Left navigation configuration (data‑driven)
│   ├── session.js                   # Login session (localStorage, default 24h)
│   ├── views/
│   │   ├── LoginView.vue            # Login page
│   │   ├── HomeView.vue             # Main layout (left nav + content area)
│   │   ├── HomePageView.vue         # Homepage (project progress overview + quick actions)
│   │   ├── exp-1/                   # Create Project / Project List
│   │   ├── exp-2/                   # API Import / Road Network Import
│   │   ├── exp-3/                   # Origin Coordinates / Destination Coordinates
│   │   └── exp-4/                   # Calculation Results / Visualization
│   └── assets/                      # Images and static assets
├── build/icon.ico
├── index.html
├── vite.config.mjs
└── package.json
```

## Requirements

- **Node.js** 18+ (tested with 22.x)
- **MySQL** 5.7+ / 8.x
- **Operating System**: Windows (primary) / macOS / Linux

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Initialization (Automatic)

No manual initialisation scripts are required: on startup, the application idempotently creates any missing tables (`user`, `project`, `map_data_import`, `coord_data`, `calc_result`) for the currently active database. A default Alibaba Cloud connection is pre‑initialised and can be used immediately; you may also add your own databases (local or cloud).

### 3. Start Development Mode

```bash
npm run dev
```

This starts both the Vite development server (on port 5173) and the Electron window simultaneously.

> Notes:
> - Administrative boundary data (Alibaba Cloud DataV) and Amap road network tiles require internet access.
> - Road network calculation depends on the OSRM executables (`extract`, `partition`, `customize`, `routed`) located in `electron/osrm/bin/` and the `profiles/car.lua` configuration.

## Common Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development mode: Vite + Electron together |
| `npm run vite` | Start Vite dev server only |
| `npm run build` | Build frontend to `dist/` |
| `npm run start` | Launch Electron only (requires `build` first) |
| `npm run pack` | Build and package as an installer, output to `release/` |

> Packaging note: It is recommended to run `npm run pack` in an administrator terminal. To run on a different machine, update the default connection settings in `electron/db/database_default_connections.js` to match your MySQL instance.

## Architecture Highlights

- **Electron main process as backend**: `electron/main.js` listens for IPC channels (`auth`, `sys`, `project`, `mapData`, `coord`, `calc`, `apiCalc`, `viz`, `file`) and directly accesses MySQL. File parsing, file copying, calculation scheduling, etc., are all handled in the main process.
- **Frontend calls via `window.api`**: `electron/preload.js` exposes only whitelisted APIs; `src/api/index.js` provides a unified wrapper.
- **Data permissions controlled server‑side**: All business data has a `created_by` field injected by the main process from the logged‑in user; list queries are filtered by the current user, preventing frontend forgery.
- **Hash‑based routing**: After packaging, opening via `file://` still correctly resolves sub‑routes, avoiding white screens.
- **Data‑driven navigation**: `navConfig.js` is a single configuration that generates the left navigation and all child routes.

## License

[MIT](https://opensource.org/licenses/MIT) © yconghua

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yconghua/scientific_experiment_system&type=Date)](https://star-history.com/#yconghua/scientific_experiment_system&Date)
