import { login, logout, getInfo } from '@/api/user'
import { setToken, getToken, removeToken } from '@/utils/auth'

const state = {
  token: getToken(),
  userInfo: {},
  roles: [],
  permissions: [],
  avatar: '',
  name: ''
}

const mutations = {
  SET_TOKEN: (state, token) => { state.token = token },
  SET_USER_INFO: (state, info) => { state.userInfo = info },
  SET_ROLES: (state, roles) => { state.roles = roles },
  SET_PERMISSIONS: (state, perms) => { state.permissions = perms },
  SET_AVATAR: (state, url) => { state.avatar = url },
  SET_NAME: (state, name) => { state.name = name },
  CLEAR_USER: (state) => {
    state.token = ''
    state.userInfo = {}
    state.roles = []
    state.permissions = []
    state.avatar = ''
    state.name = ''
  }
}

const actions = {
  // 用户登录
  login({ commit }, userInfo) {
    const { username, password } = userInfo
    return new Promise((resolve, reject) => {
      login({ username: username.trim(), password }).then(response => {
        const { data } = response
        commit('SET_TOKEN', data.token)
        setToken(data.token)
        resolve()
      }).catch(error => reject(error))
    })
  },

  // 获取用户信息
  getInfo({ commit, state }) {
    return new Promise((resolve, reject) => {
      getInfo(state.token).then(response => {
        const { data } = response
        if (!data) reject('Verification failed, please Login again.')
        const { roles, name, avatar, permissions } = data
        if (!roles || roles.length <= 0) reject('getInfo: roles must be a non-null array!')
        commit('SET_ROLES', roles)
        commit('SET_PERMISSIONS', permissions || [])
        commit('SET_NAME', name)
        commit('SET_AVATAR', avatar)
        commit('SET_USER_INFO', data)
        resolve(data)
      }).catch(error => reject(error))
    })
  },

  // 用户登出
  logout({ commit, state }) {
    return new Promise((resolve, reject) => {
      logout(state.token).then(() => {
        commit('CLEAR_USER')
        removeToken()
        resolve()
      }).catch(error => reject(error))
    })
  },

  // 前端登出 (不请求接口)
  fedLogout({ commit }) {
    return new Promise(resolve => {
      commit('CLEAR_USER')
      removeToken()
      resolve()
    })
  },

  // 重置 token
  resetToken({ commit }) {
    return new Promise(resolve => {
      commit('CLEAR_USER')
      removeToken()
      resolve()
    })
  },

  // 动态修改权限
  changeRoles({ commit, dispatch }, role) {
    return new Promise(async resolve => {
      const token = role + '-token'
      commit('SET_TOKEN', token)
      setToken(token)
      const { roles } = await dispatch('getInfo')
      resetRouter()
      const accessRoutes = await dispatch('permission/generateRoutes', roles, { root: true })
      router.addRoutes(accessRoutes)
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
