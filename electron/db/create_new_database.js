/**
 * 数据库初始化公共模块
 *
 * 数据库初始化的唯一实现：建库 / 建表均带 IF NOT EXISTS、
 * 默认管理员仅在不存在时插入，重复执行无副作用。
 *
 * 由 electron/main.js 引用：登录页「添加新数据库」时自动建库 + 建表 + 默认管理员。
 */
const mysql = require('mysql2/promise')

// 默认管理员（密码 admin123 已预哈希，与 db/init.js 保持一致）
const ADMIN_DEFAULT = {
  username: 'admin',
  passwordHash: '$2b$10$cPHMkHMubQkZDVOi75fpte.kilWcn/2vFqX7muTMvyOlYCDfqx1/C',
  role: 'admin'
}

// 用户表（两级权限）
const USER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`user\` (
    \`id\`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    \`username\`   VARCHAR(50)  NOT NULL                COMMENT '登录账号（唯一）',
    \`password\`   VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希后的密码',
    \`role\`       VARCHAR(20)  NOT NULL DEFAULT 'user' COMMENT '权限：admin 管理员 / user 普通用户',
    \`created_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_username\` (\`username\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表'
`

// 科研项目表
// 字段：自增主键 id / 项目编号 project_no（XM1,XM2… 全局唯一递增）/
//       项目名称 name / 省市县「编码 + 名称」各两组 / 备注 remark（选填）/
//       创建人 created_by（当前登录账号）/ 创建时间 / 更新时间
// 编号递增依赖 is_deleted 软删除占号：删除项目只是标记 is_deleted=1，
// 该行仍占用编号 → MAX(编号)+1 取号时编号永不复用，且无需额外计数器表。
const PROJECT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`project\` (
    \`id\`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    \`project_no\`    VARCHAR(20)  NOT NULL                COMMENT '项目编号，格式 XM1/XM2…，全局唯一且递增',
    \`name\`          VARCHAR(100) NOT NULL                COMMENT '项目名称',
    \`province_code\` VARCHAR(20)  NOT NULL                COMMENT '省份编码（行政区划代码）',
    \`province_name\` VARCHAR(50)  NOT NULL                COMMENT '省份名称',
    \`city_code\`     VARCHAR(20)  NOT NULL                COMMENT '城市编码',
    \`city_name\`     VARCHAR(50)  NOT NULL                COMMENT '城市名称',
    \`district_code\` VARCHAR(20)  NOT NULL                COMMENT '区/县编码',
    \`district_name\` VARCHAR(50)  NOT NULL                COMMENT '区/县名称',
    \`remark\`        VARCHAR(500) NULL                    COMMENT '备注（选填）',
    \`created_by\`    VARCHAR(50)  NOT NULL                COMMENT '创建人账号（当前登录用户 username）',
    \`created_at\`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    \`updated_at\`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    \`is_deleted\`    TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '软删除标记：0 正常 / 1 已删除（行保留、编号占号，保证编号不复用）',
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_project_no\` (\`project_no\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研项目表'
`

// 确保某列存在（存量库兼容：旧表没有 is_deleted 时补列，避免手工重建）
async function ensureColumn(conn, table, column, ddl) {
  const [cols] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  )
  if (!cols[0] || cols[0].c === 0) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`)
  }
}

// 在已连接的库上确保 project 表存在（幂等，供「启动时补齐存量库」复用）
async function ensureProjectTable(conn) {
  await conn.query(PROJECT_TABLE_SQL)
  // 兼容旧表：缺软删除列则补上（旧数据默认视为正常）
  await ensureColumn(
    conn,
    'project',
    'is_deleted',
    '`is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT \'软删除标记：0 正常 / 1 已删除（编号占号，不复用）\''
  )
}

// 项目地图数据导入表（API 导入 / 路网导入 共用一张表，import_type 区分）
// 每个项目最多一条导入记录：唯一索引 uk_project_one(project_id, import_type) 兜底，
// 跨类型互斥由应用层校验；删除为物理删除（删掉后该项目可再导入新的）。
const MAP_DATA_IMPORT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`map_data_import\` (
    \`id\`                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    \`project_id\`         BIGINT UNSIGNED NOT NULL                COMMENT '所属项目 ID（关联 project.id）',
    \`project_no\`         VARCHAR(20)     NOT NULL                COMMENT '项目编号（冗余，列表直接显示）',
    \`import_type\`        VARCHAR(10)     NOT NULL                COMMENT '导入方式：api=API导入 / road=路网导入',
    \`api_platform\`       VARCHAR(50)     NULL                    COMMENT 'API 提供平台（api 类型必填），如 百度地图/高德地图',
    \`api_key\`            VARCHAR(100)    NULL                    COMMENT 'API Key（api 类型必填），存明文',
    \`api_url\`            VARCHAR(500)    NULL                    COMMENT 'API 网址（api 类型必填）',
    \`road_file_name\`     VARCHAR(255)    NULL                    COMMENT '路网文件名（road 类型必填）',
    \`road_file_path\`     VARCHAR(500)    NULL                    COMMENT '路网文件原始位置（用户选择时的路径）',
    \`road_file_copy_path\` VARCHAR(500)   NULL                    COMMENT '路网文件复制后的路径（userData/projects/{项目编号}/ 下）',
    \`created_by\`         VARCHAR(50)     NOT NULL                COMMENT '创建人账号（当前登录用户 username）',
    \`created_at\`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    \`updated_at\`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    \`is_deleted\`         TINYINT(1)      NOT NULL DEFAULT 0      COMMENT '软删除标记：0 正常 / 1 已删除',
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`uk_project_one\` (\`project_id\`, \`import_type\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目地图数据导入表'
`

// 确保 map_data_import 表存在（幂等；存量库补建、补列，并把普通索引升级为唯一索引）
async function ensureMapDataImportTable(conn) {
  await conn.query(MAP_DATA_IMPORT_TABLE_SQL)
  await ensureColumn(
    conn,
    'map_data_import',
    'road_file_copy_path',
    '`road_file_copy_path` VARCHAR(500) NULL COMMENT \'路网文件复制后的路径（userData/projects/{项目编号}/ 下）\''
  )
  await ensureColumn(
    conn,
    'map_data_import',
    'api_url',
    '`api_url` VARCHAR(500) NULL COMMENT \'API 网址（api 类型必填）\''
  )
  await ensureMapDataImportUnique(conn)
}

// 存量库升级：保证 (project_id, import_type) 唯一（每个项目最多一条导入记录）。
// 旧表是普通索引且可能有多条/软删除残留，先清理再重建唯一索引（幂等，已有唯一索引则跳过）。
async function ensureMapDataImportUnique(conn) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'map_data_import' AND INDEX_NAME = 'uk_project_one'`
  )
  if (rows[0] && Number(rows[0].c) > 0) return // 已是唯一索引
  // 1) 清理历史软删除残留（新规则下删除改为物理删除）
  await conn.query('DELETE FROM `map_data_import` WHERE is_deleted = 1')
  // 2) 每个 (project_id, import_type) 只保留最新一条，其余物理删除
  await conn.query(
    `DELETE d FROM \`map_data_import\` d
       JOIN \`map_data_import\` k
         ON d.project_id = k.project_id AND d.import_type = k.import_type AND k.id > d.id`
  )
  // 3) 移除旧普通索引（若存在），加唯一索引
  const [idxRows] = await conn.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'map_data_import' AND INDEX_NAME = 'idx_project_type'`
  )
  if (idxRows[0] && Number(idxRows[0].c) > 0) {
    await conn.query('ALTER TABLE `map_data_import` DROP INDEX `idx_project_type`')
  }
  await conn.query('ALTER TABLE `map_data_import` ADD UNIQUE KEY `uk_project_one` (`project_id`, `import_type`)')
}

// 坐标数据表（起点 / 终点 共用一张表，point_type 区分）
// 数据来自 txt/csv/excel 文件解析，每条记录 = 文件中的一个点。
const COORD_DATA_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`coord_data\` (
    \`id\`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    \`project_id\` BIGINT UNSIGNED NOT NULL                COMMENT '所属项目 ID（关联 project.id）',
    \`project_no\` VARCHAR(20)     NOT NULL                COMMENT '项目编号（冗余，列表直接显示）',
    \`point_type\` VARCHAR(10)     NOT NULL                COMMENT '数据类型：start=起点 / end=终点',
    \`sort_no\`    INT UNSIGNED    NULL                    COMMENT '文件内序号（表头 No 列）',
    \`point_name\` VARCHAR(100)    NULL                    COMMENT '点名称（表头 Name 列）',
    \`longitude\`  DECIMAL(10,6)   NOT NULL                COMMENT '经度',
    \`latitude\`   DECIMAL(10,6)   NOT NULL                COMMENT '纬度',
    \`created_by\` VARCHAR(50)     NOT NULL                COMMENT '创建人账号（当前登录用户 username）',
    \`created_at\` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    \`updated_at\` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (\`id\`),
    KEY \`idx_project_type\` (\`project_id\`, \`point_type\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='坐标数据表（起点/终点）'
`

// 确保 coord_data 表存在（幂等，供「启动时补齐存量库」复用）
async function ensureCoordDataTable(conn) {
  await conn.query(COORD_DATA_TABLE_SQL)
}

// 路径计算结果表（一次计算 = 一个批次，软删除：清除后数据保留不显示）
const CALC_RESULT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`calc_result\` (
    \`id\`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    \`project_id\`   BIGINT UNSIGNED NOT NULL                COMMENT '所属项目 ID（关联 project.id）',
    \`project_no\`   VARCHAR(20)     NOT NULL                COMMENT '项目编号（冗余）',
    \`batch_no\`     VARCHAR(30)     NOT NULL                COMMENT '批次号（一次计算一批），如 JS20260824_0914',
    \`from_point_id\` BIGINT UNSIGNED NULL                   COMMENT '起点坐标记录 ID（coord_data.id）',
    \`from_name\`    VARCHAR(100)    NULL                    COMMENT '起点名称（快照）',
    \`from_lng\`     DECIMAL(10,6)   NOT NULL                COMMENT '起点经度（快照）',
    \`from_lat\`     DECIMAL(10,6)   NOT NULL                COMMENT '起点纬度（快照）',
    \`to_point_id\`  BIGINT UNSIGNED NULL                    COMMENT '终点坐标记录 ID（coord_data.id）',
    \`to_name\`      VARCHAR(100)    NULL                    COMMENT '终点名称（快照）',
    \`to_lng\`       DECIMAL(10,6)   NOT NULL                COMMENT '终点经度（快照）',
    \`to_lat\`       DECIMAL(10,6)   NOT NULL                COMMENT '终点纬度（快照）',
    \`distance\`     DECIMAL(12,3)   NULL                    COMMENT '距离（米），失败为 NULL',
    \`duration\`     DECIMAL(12,3)   NULL                    COMMENT '时长（秒），失败为 NULL（路网计算无此值）',
    \`status\`       VARCHAR(5)      NOT NULL DEFAULT 'ok'   COMMENT '状态：ok 成功 / fail 失败',
    \`created_by\`   VARCHAR(50)     NOT NULL                COMMENT '创建人账号（当前登录用户 username）',
    \`created_at\`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    \`is_deleted\`   TINYINT(1)      NOT NULL DEFAULT 0      COMMENT '软删除标记：0 正常 / 1 已清除（数据保留不显示）',
    PRIMARY KEY (\`id\`),
    KEY \`idx_project_batch\` (\`project_id\`, \`batch_no\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='路径计算结果表'
`

// 确保 calc_result 表存在（幂等，供「启动时补齐存量库」复用；旧表补 duration 列）
async function ensureCalcResultTable(conn) {
  await conn.query(CALC_RESULT_TABLE_SQL)
  await ensureColumn(
    conn,
    'calc_result',
    'duration',
    '`duration` DECIMAL(12,3) NULL COMMENT \'时长（秒），失败为 NULL（路网计算无此值）\''
  )
}

// 运行日志表（业务日志 + Electron console 日志统一入库，source 字段区分）
const RUN_LOG_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS \`run_log\` (
    \`id\`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
    \`source\`      VARCHAR(20)     NOT NULL DEFAULT 'business' COMMENT '来源：business 业务日志 / console Electron console 日志',
    \`module\`      VARCHAR(50)     NOT NULL DEFAULT '' COMMENT '模块，如 auth/project/calc/console:main',
    \`action\`      VARCHAR(50)     NOT NULL DEFAULT '' COMMENT '动作，如 login/create/run/list',
    \`level\`       VARCHAR(10)     NOT NULL DEFAULT 'info' COMMENT '级别：info / success / warn / error',
    \`success\`     TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '是否成功：1 成功 / 0 失败',
    \`message\`     VARCHAR(500)    NOT NULL DEFAULT '' COMMENT '简短描述',
    \`detail\`      TEXT            NULL COMMENT '详细内容（错误堆栈 / 失败原因 / 参数摘要）',
    \`project_id\`  BIGINT UNSIGNED NULL COMMENT '关联项目 ID',
    \`batch_no\`    VARCHAR(30)     NULL COMMENT '关联计算批次号',
    \`created_by\`  VARCHAR(50)     NOT NULL DEFAULT '' COMMENT '操作用户账号',
    \`cost_ms\`     INT UNSIGNED    NULL COMMENT '耗时（毫秒）',
    \`app_version\` VARCHAR(20)     NULL COMMENT '系统版本号',
    \`created_at\`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (\`id\`),
    KEY \`idx_created_at\` (\`created_at\`),
    KEY \`idx_project\` (\`project_id\`),
    KEY \`idx_module_action\` (\`module\`, \`action\`),
    KEY \`idx_level\` (\`level\`),
    KEY \`idx_source\` (\`source\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='运行日志表（业务 + console）'
`

// 确保 run_log 表存在（幂等，供「启动时补齐存量库」复用）
async function ensureRunLogTable(conn) {
  await conn.query(RUN_LOG_TABLE_SQL)
}

// 初始化目标库：库不存在则自动创建，随后建 user / project / map_data_import / coord_data / calc_result 表、幂等插入默认管理员
async function initDatabase({ host, port, user, password, database }) {
  // 先连 MySQL 服务（不指定库），用于建库
  const conn = await mysql.createConnection({ host, port, user, password })
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_general_ci`
    )
    await conn.query(`USE \`${database}\``)

    // 用户表（两级权限）
    await conn.query(USER_TABLE_SQL)

    // 科研项目表
    await ensureProjectTable(conn)

    // 项目地图数据导入表
    await ensureMapDataImportTable(conn)

    // 坐标数据表（起点/终点）
    await ensureCoordDataTable(conn)

    // 路径计算结果表
    await ensureCalcResultTable(conn)

    // 运行日志表
    await ensureRunLogTable(conn)

    // 幂等插入默认管理员
    await conn.query(
      `INSERT INTO \`user\` (\`username\`, \`password\`, \`role\`)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM \`user\` WHERE \`username\` = ?)`,
      [ADMIN_DEFAULT.username, ADMIN_DEFAULT.passwordHash, ADMIN_DEFAULT.role, ADMIN_DEFAULT.username]
    )
  } finally {
    await conn.end().catch(() => {})
  }
}

module.exports = {
  ADMIN_DEFAULT,
  initDatabase,
  ensureProjectTable,
  ensureMapDataImportTable,
  ensureCoordDataTable,
  ensureCalcResultTable,
  ensureRunLogTable
}
