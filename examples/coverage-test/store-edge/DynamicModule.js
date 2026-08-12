// 动态模块: registerModule / unregisterModule / hasModule
import store from '@/store'

// ---------- 顶层动态注册 ----------
export function registerDynamicModule() {
  store.registerModule('dynamic', {
    namespaced: true,
    state: { data: [], loading: false },
    mutations: {
      SET_DATA(state, payload) { state.data = payload },
      SET_LOADING(state, val) { state.loading = val }
    },
    actions: {
      async fetchData({ commit }) {
        commit('SET_LOADING', true)
        try {
          const res = await fetch('/api/dynamic').then(r => r.json())
          commit('SET_DATA', res.data || [])
        } finally {
          commit('SET_LOADING', false)
        }
      }
    }
  })
}

// ---------- 嵌套动态注册 ----------
export function registerNestedModule() {
  store.registerModule(['nested', 'deep'], {
    namespaced: true,
    state: { value: 1 },
    mutations: { INC(state) { state.value++ } }
  })
}

// ---------- 注销 (先判断是否已注册) ----------
export function unregisterDynamicModule() {
  if (store.hasModule('dynamic')) {
    store.unregisterModule('dynamic')
  }
  if (store.hasModule(['nested', 'deep'])) {
    store.unregisterModule(['nested', 'deep'])
  }
}

// ---------- 带选项注册: preserveState ----------
export function registerPreservedModule() {
  store.registerModule('preserved', {
    namespaced: true,
    state: () => ({ items: [] }),
    mutations: { ADD_ITEM(state, item) { state.items.push(item) } }
  }, { preserveState: true })
}

// ---------- 组件内动态注册 / 注销 (与生命周期绑定) ----------
export default {
  name: 'DynamicWidget',
  data() {
    return { localValue: null }
  },
  mounted() {
    // 注册局部模块 (仅该组件实例期间存在)
    this.$store.registerModule('local', {
      namespaced: true,
      state: () => ({ local: true }),
      mutations: { SET_LOCAL(state, v) { state.local = v } }
    })
    this.localValue = this.$store.state.local.local
  },
  beforeDestroy() {
    // 必须在销毁前注销, 避免状态残留与内存泄漏
    if (this.$store.hasModule('local')) {
      this.$store.unregisterModule('local')
    }
  }
}
