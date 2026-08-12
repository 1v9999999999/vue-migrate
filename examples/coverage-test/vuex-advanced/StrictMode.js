// Vuex strict mode (生产环境禁用, dev 启用)
const store = new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  state: {
    count: 0,
    items: []
  },
  mutations: {
    INCREMENT(state) { state.count++ },
    ADD_ITEM(state, item) {
      // 错误: strict mode 不允许 mutation 之外修改 state
      // setTimeout(() => state.items.push(item), 0)  // 会报错
      // 解决: 用 action
      state.items.push(item) // OK
    },
    REPLACE_STATE(state, newState) {
      // 唯一 mutation 外修改 state 的合法方式
      Object.assign(state, newState)
    }
  },
  actions: {
    async delayedAddItem({ commit }, item) {
      await new Promise(r => setTimeout(r, 100))
      commit('ADD_ITEM', item)
    }
  }
})

export default store
