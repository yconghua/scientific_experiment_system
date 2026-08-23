// 左侧导航配置（数据驱动：父项 / 子项 / 顶部项的数量均可自由增减）
//
// - 顶部项（topItem）：直接跳转的独立导航（如「首页」），内容页显示「正在开发中」；
// - 父项（group）：下拉分组标题，点击展开 / 收起其子项；
// - 子项（child）：实际可点击路由，内容页统一显示「正在开发中」。
//
// 想加导航，只改这个文件即可：
//   新增顶部项 → 往 navTopItems 加一个 { key, title }
//   新增父项   → 往 navGroups 加一个 { title, children: [...] }
//   新增子项   → 往对应父项的 children 加一个 { key, title }
//   key 会同时用作路由 path（如 home → /home、exp-11 → /exp-11），需保持唯一。
//   子项 key 统一使用 exp-数字 格式（原示例用的 example-数字 已弃用）。

// 顶部独立导航项（直接跳转，非下拉分组）；数量可自由增减
export const navTopItems = [
  { key: 'home', title: '首页' }
]

export const navGroups = [
  {
    title: '新建项目',
    children: [
      { key: 'exp-11', title: '新建项目' },
      { key: 'exp-12', title: '项目列表' }
    ]
  },
  {
    title: '地图数据导入',
    children: [
      { key: 'exp-21', title: 'api导入' },
      { key: 'exp-22', title: '路网导入' }
    ]
  },
  {
    title: '加载点位数据',
    children: [
      { key: 'exp-31', title: '起点坐标数据' },
      { key: 'exp-32', title: '终点坐标数据' }
    ]
  },
  {
    title: '运行计算',
    children: [
      { key: 'exp-41', title: '计算结果' },
      { key: 'exp-42', title: '可视化' }
    ]
  }
]

// 默认重定向：优先顶部项「首页」，否则第一个父项的第一个子项
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : `/${navGroups[0].children[0].key}`
