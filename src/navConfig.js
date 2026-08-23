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
//   key 会同时用作路由 path（如 home → /home、example-11 → /example-11），需保持唯一。

// 顶部独立导航项（直接跳转，非下拉分组）；数量可自由增减
export const navTopItems = [
  { key: 'home', title: '首页' }
]

export const navGroups = [
  {
    title: '示例导航栏1',
    children: [
      { key: 'example-11', title: '示例小导航栏11' }
    ]
  },
  {
    title: '示例导航栏2',
    children: [
      { key: 'example-12', title: '示例小导航栏12' },
      { key: 'example-13', title: '示例小导航栏13' },
      { key: 'example-14', title: '示例小导航栏14' },
      { key: 'example-15', title: '示例小导航栏15' }
    ]
  },
  {
    title: '示例导航栏3',
    children: [
      { key: 'example-16', title: '示例小导航栏16' }
    ]
  },
  {
    title: '示例导航栏4',
    children: [
      { key: 'example-17', title: '示例小导航栏17' },
      { key: 'example-18', title: '示例小导航栏18' },
      { key: 'example-19', title: '测试项目' }
    ]
  }
]

// 默认重定向：优先顶部项「首页」，否则第一个父项的第一个子项
export const defaultNavPath = navTopItems.length
  ? `/${navTopItems[0].key}`
  : `/${navGroups[0].children[0].key}`
