// 默认数据库连接清单（首次运行时写入用户数据目录）。
// 连接参数直接内置在此。
// 单独抽出此文件，便于在不改动 main.js 主体的情况下调整预设连接。
function defaultConnections() {
  return {
    active: 'aliyun',
    list: [
      {
        id: 'aliyun',
        name: '云数据库（阿里云MySQL）-2026年11月16日左右到期',
        host: 'rm-cn-z864x1j220001w1o.rwlb.rds.aliyuncs.com',
        port: 3306,
        user: 'alyycqconghuastudio',
        password: 'Aa@147369',
        database: 'scientific_experiment_system_database'
      }
    ]
  }
}

module.exports = { defaultConnections }
