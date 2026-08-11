// 全局 getters
const getters = {
  token: state => state.user.token,
  userInfo: state => state.user.userInfo,
  roles: state => state.user.roles,
  permissions: state => state.user.permissions,
  // app
  sidebar: state => state.app.sidebar,
  device: state => state.app.device,
  // settings
  theme: state => state.settings.theme,
  fixedHeader: state => state.settings.fixedHeader,
  showSettings: state => state.settings.showSettings,
  tagsView: state => state.settings.tagsView,
  // permission
  permission_routes: state => state.permission.routes,
  addRoutes: state => state.permission.addRoutes,
  // 组合 getter
  hasRole: state => role => state.user.roles.includes(role),
  hasPermission: state => perm => state.user.permissions.includes(perm),
  isAdmin: (state, getters) => getters.roles.includes('admin'),
  // 全局
  globalLoading: state => state.globalLoading,
  sidebarVisible: state => state.sidebarVisible
}

export default getters
