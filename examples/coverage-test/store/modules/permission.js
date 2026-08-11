import { constantRoutes, asyncRoutes } from '@/router'
import { filterAsyncRoutes, sortRoutes } from '@/utils/route'

const state = {
  routes: [],     // 完整路由表 (静态 + 动态)
  addRoutes: []   // 动态添加的路由
}

const mutations = {
  SET_ROUTES: (state, routes) => {
    state.addRoutes = routes
    state.routes = constantRoutes.concat(routes)
  },
  RESET_ROUTES: (state) => {
    state.addRoutes = []
    state.routes = constantRoutes
  }
}

const actions = {
  // 根据 roles 生成可访问的路由表
  generateRoutes({ commit }, roles) {
    return new Promise(resolve => {
      let accessedRoutes
      if (roles.includes('admin')) {
        accessedRoutes = asyncRoutes || []
      } else {
        accessedRoutes = filterAsyncRoutes(asyncRoutes, roles)
      }
      // 按 sort 字段排序
      accessedRoutes = sortRoutes(accessedRoutes)
      commit('SET_ROUTES', accessedRoutes)
      resolve(accessedRoutes)
    })
  },
  resetRoutes({ commit }) {
    return new Promise(resolve => {
      commit('RESET_ROUTES')
      resolve()
    })
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}
