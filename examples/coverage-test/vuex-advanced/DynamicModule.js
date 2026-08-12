import store from '@/store'

// 1. 动态注册
if (!store.hasModule('notifications')) {
  store.registerModule('notifications', {
    namespaced: true,
    state: () => ({ list: [] }),
    getters: { unread: (state) => state.list.filter(n => !n.read).length },
    mutations: {
      ADD(state, n) { state.list.push(n) },
      MARK_READ(state, id) {
        const item = state.list.find(n => n.id === id)
        if (item) item.read = true
      }
    },
    actions: {
      async fetch({ commit }) {
        const res = await api.getNotifications()
        commit('ADD', res.data)
      }
    }
  })
}

// 2. 嵌套注册
store.registerModule(['user', 'settings'], {
  namespaced: true,
  state: () => ({ theme: 'light', lang: 'zh' }),
  mutations: {
    SET_THEME(state, t) { state.theme = t }
  }
})

// 3. 保留 state (Vue 2.6+)
store.registerModule('v2', { state: {...} }, { preserveState: true })

// 4. 注销
store.unregisterModule('notifications')
