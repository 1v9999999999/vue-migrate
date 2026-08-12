import Vue from 'vue'
import Vuex from 'vuex'
import createLogger from 'vuex/dist/logger'
import createPersistedState from 'vuex-persistedstate'

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    user: null,
    token: '',
    cart: []
  },
  plugins: [
    createPersistedState({
      key: 'myapp',
      paths: ['user', 'token'] // 只持久化这些
    }),
    process.env.NODE_ENV !== 'production' && createLogger({
      collapsed: true,
      filter: (mutation) => !mutation.type.startsWith('_')
    })
  ],
  modules: {
    // ...
  }
})

// Vuex 4 hot reload (开发时)
if (module.hot) {
  module.hot.accept(['./modules/user'], () => {
    const newUserModule = require('./modules/user').default
    store.hotUpdate({
      modules: { user: newUserModule }
    })
  })
}

export default store
