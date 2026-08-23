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

// 初始化目标库：库不存在则自动创建，随后建 user 表 + project 表、幂等插入默认管理员
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

module.exports = { ADMIN_DEFAULT, initDatabase, ensureProjectTable }
