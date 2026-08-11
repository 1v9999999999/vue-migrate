import Vue from 'vue'
import Vuex from 'vuex'

import user from './modules/user'
import app from './modules/app'
import settings from './modules/settings'
import permission from './modules/permission'
import getters from './getters'
import { permissionPlugin } from './plugins/permission-plugin'
import { persistPlugin } from './plugins/persist-plugin'

Vue.use(Vuex)

const store = new Vuex.Store({
  modules: { user, app, settings, permission },
  getters,
  state: {
    // 全局 state
    globalLoading: false,
    sidebarVisible: true
  },
  mutations: {
    SET_GLOBAL_LOADING(state, val) { state.globalLoading = val },
    TOGGLE_SIDEBAR(state) { state.sidebarVisible = !state.sidebarVisible },
    RESET_ALL(state) {
      state.globalLoading = false
      state.sidebarVisible = true
    }
  },
  actions: {
    toggleSidebar({ commit }) {
      commit('TOGGLE_SIDEBAR')
    },
    resetAll({ commit, dispatch }) {
      commit('RESET_ALL')
      dispatch('user/resetToken', null, { root: true })
      dispatch('settings/resetSettings', null, { root: true })
    }
  },
  strict: process.env.NODE_ENV !== 'production',
  plugins: [permissionPlugin, persistPlugin]
})

export default store
