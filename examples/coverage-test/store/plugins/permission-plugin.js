// 自定义 Vuex plugin: 权限检查 mutation
export function permissionPlugin(store) {
  const WHITELIST = [
    'user/SET_TOKEN',
    'user/SET_USER_INFO',
    'user/SET_ROLES',
    'user/SET_PERMISSIONS',
    'user/SET_AVATAR',
    'user/SET_NAME',
    'user/CLEAR_USER',
    'SET_GLOBAL_LOADING',
    'TOGGLE_SIDEBAR',
    'RESET_ALL'
  ]

  store.subscribe((mutation, state) => {
    if (!WHITELIST.includes(mutation.type)) {
      const userRoles = state.user.roles || []
      if (!userRoles.length && mutation.type.startsWith('permission/')) {
        console.warn(`[permission] blocked ${mutation.type}: user not logged in`)
        return
      }
    }

    if (mutation.type === 'permission/SET_ROUTES') {
      // 写入 localStorage 备份
      try {
        localStorage.setItem('vuex-permission-routes', JSON.stringify(mutation.payload))
      } catch (e) {
        console.error('persist routes failed', e)
      }
    }
  })
}
