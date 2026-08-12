// 模块间 rootState / rootGetters 访问 (跨模块 commit / dispatch)
import { login as loginApi } from '@/api/user'

export default {
  namespaced: true,
  state: {
    token: '',
    info: {},
    loginTime: null
  },
  getters: {
    isAuthenticated: state => !!state.token,

    // 访问 rootState (跨模块读 state)
    canAccess: (state, getters, rootState, rootGetters) => {
      const permissions = (rootState.app && rootState.app.permissions) || []
      return permissions.includes('admin')
    },

    // 访问 rootGetters (跨模块读 getter)
    userRole: (state, getters, rootGetters) => rootGetters['permission/role'],

    // 组合本地 state + rootState
    tenantToken: (state, getters, rootState) => ({
      token: state.token,
      tenantId: rootState.app && rootState.app.tenantId
    })
  },
  mutations: {
    SET_TOKEN(state, token) {
      state.token = token
      state.loginTime = Date.now()
    },
    SET_INFO(state, info) {
      state.info = info
    }
  },
  actions: {
    // 跨模块: 读 rootState, 跨模块 dispatch
    async login({ commit, dispatch, rootState, rootGetters }) {
      const tenantId = rootState.app && rootState.app.tenantId
      const res = await loginApi({ tenantId })
      commit('SET_TOKEN', res.token)

      // 跨模块 dispatch (带 root: true)
      await dispatch('permission/generateRoutes', res.roles, { root: true })
      return res
    },

    // 跨模块 commit (带 root: true)
    crossModule({ commit }) {
      commit('app/SET_SIDEBAR', true, { root: true })
    },

    // 读取其它模块 getter
    checkPermission({ state, rootGetters }, required) {
      const role = rootGetters['permission/role']
      if (role !== 'admin') return false
      return !!state.token
    }
  }
}
