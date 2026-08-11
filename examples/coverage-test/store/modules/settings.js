import defaultSettings from '@/settings'

const { showSettings, fixedHeader, sidebarLogo, tagsView } = defaultSettings

const state = {
  showSettings,
  fixedHeader,
  sidebarLogo,
  tagsView,
  theme: localStorage.getItem('vue-admin-beautiful-theme') || '#1890ff',
  themeName: localStorage.getItem('vue-admin-beautiful-themeName') || 'default',
  // 整体风格
  overallStyle: localStorage.getItem('vue-admin-beautiful-overallStyle') || 'light',
  // 布局
  layout: localStorage.getItem('vue-admin-beautiful-layout') || 'vertical',
  // 折叠侧边栏
  collapsed: false
}

const mutations = {
  CHANGE_SETTING: (state, { key, value }) => {
    if (state.hasOwnProperty(key)) {
      state[key] = value
    }
  },
  SET_THEME: (state, { theme, themeName }) => {
    state.theme = theme
    state.themeName = themeName
    localStorage.setItem('vue-admin-beautiful-theme', theme)
    localStorage.setItem('vue-admin-beautiful-themeName', themeName)
  },
  SET_OVERALL_STYLE: (state, style) => {
    state.overallStyle = style
    localStorage.setItem('vue-admin-beautiful-overallStyle', style)
  },
  SET_LAYOUT: (state, layout) => {
    state.layout = layout
    localStorage.setItem('vue-admin-beautiful-layout', layout)
  },
  SET_COLLAPSED: (state, val) => {
    state.collapsed = val
  }
}

const actions = {
  changeSetting({ commit }, data) {
    commit('CHANGE_SETTING', data)
  },
  setTheme({ commit }, theme) {
    commit('SET_THEME', theme)
  },
  setOverallStyle({ commit }, style) {
    commit('SET_OVERALL_STYLE', style)
  },
  setLayout({ commit }, layout) {
    commit('SET_LAYOUT', layout)
  },
  resetSettings({ commit }) {
    return new Promise(resolve => {
      commit('CHANGE_SETTING', { key: 'showSettings', value: showSettings })
      commit('CHANGE_SETTING', { key: 'fixedHeader', value: fixedHeader })
      commit('CHANGE_SETTING', { key: 'sidebarLogo', value: sidebarLogo })
      commit('CHANGE_SETTING', { key: 'tagsView', value: tagsView })
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
