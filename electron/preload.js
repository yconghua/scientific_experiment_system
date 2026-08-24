/**
 * 预加载脚本
 *
 * 在主进程与渲染层之间架桥：只把「认证相关」的 API 通过 contextBridge
 * 暴露到 window.api，渲染层拿不到 ipcRenderer 本体，安全性更高。
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', { username, password }),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user'),
    changePassword: (username, oldPassword, newPassword) =>
      ipcRenderer.invoke('auth:change-password', { username, oldPassword, newPassword }),
    listUsers: () => ipcRenderer.invoke('auth:list-users'),
    createUser: (payload) =>
      ipcRenderer.invoke('auth:create-user', payload),
    updateUser: (payload) => ipcRenderer.invoke('auth:update-user', payload),
    deleteUser: (id) => ipcRenderer.invoke('auth:delete-user', { id })
  },
  sys: {
    info: () => ipcRenderer.invoke('sys:info'),
    dbInfo: () => ipcRenderer.invoke('sys:db-info'),
    dbConnections: () => ipcRenderer.invoke('sys:db-connections'),
    switchDb: (id) => ipcRenderer.invoke('sys:switch-db', { id }),
    addDb: (payload) => ipcRenderer.invoke('sys:add-db', payload),
    deleteDb: (id) => ipcRenderer.invoke('sys:delete-db', { id })
  },
  project: {
    create: (payload) => ipcRenderer.invoke('project:create', payload),
    list: () => ipcRenderer.invoke('project:list'),
    update: (payload) => ipcRenderer.invoke('project:update', payload),
    delete: (id) => ipcRenderer.invoke('project:delete', { id })
  },
  mapData: {
    list: (payload) => ipcRenderer.invoke('mapData:list', payload),
    create: (payload) => ipcRenderer.invoke('mapData:create', payload),
    update: (payload) => ipcRenderer.invoke('mapData:update', payload),
    delete: (id) => ipcRenderer.invoke('mapData:delete', { id })
  },
  coord: {
    list: (payload) => ipcRenderer.invoke('coord:list', payload),
    create: (payload) => ipcRenderer.invoke('coord:create', payload),
    update: (payload) => ipcRenderer.invoke('coord:update', payload),
    delete: (id) => ipcRenderer.invoke('coord:delete', { id }),
    clear: (payload) => ipcRenderer.invoke('coord:clear', payload)
  },
  calc: {
    run: (payload) => ipcRenderer.invoke('calc:run', payload),
    apiRun: (payload) => ipcRenderer.invoke('apiCalc:run', payload),
    list: (projectId) => ipcRenderer.invoke('calc:list', { projectId }),
    clear: (projectId) => ipcRenderer.invoke('calc:clear', { projectId }),
    onProgress: (cb) => {
      const listener = (_e, data) => cb(data)
      ipcRenderer.on('calc:progress', listener)
      return () => ipcRenderer.removeListener('calc:progress', listener)
    }
  },
  file: {
    select: (projectNo) => ipcRenderer.invoke('dialog:select-file', { projectNo }),
    pick: () => ipcRenderer.invoke('dialog:pick-file')
  }
})
