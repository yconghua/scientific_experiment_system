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

// 初始化目标库：库不存在则自动创建，随后建 user 表、幂等插入默认管理员
async function initDatabase({ host, port, user, password, database }) {
  // 先连 MySQL 服务（不指定库），用于建库
  const conn = await mysql.createConnection({ host, port, user, password })
  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_general_ci`
    )
    await conn.query(`USE \`${database}\``)

    // 用户表（两级权限）
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
        \`username\`   VARCHAR(50)  NOT NULL                COMMENT '登录账号（唯一）',
        \`password\`   VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希后的密码',
        \`role\`       VARCHAR(20)  NOT NULL DEFAULT 'user' COMMENT '权限：admin 管理员 / user 普通用户',
        \`created_at\` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_username\` (\`username\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表'
    `)

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

module.exports = { ADMIN_DEFAULT, initDatabase }
