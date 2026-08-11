// 自定义 Vuex plugin: localStorage 持久化
export function persistPlugin(store) {
  const STORAGE_KEY = 'vuex-state'

  // 初始化: 从 localStorage 恢复
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const state = JSON.parse(saved)
      store.replaceState({ ...store.state, ...state })
    }
  } catch (e) {
    console.warn('restore vuex state failed', e)
  }

  // 订阅 mutation 自动持久化 (debounce)
  let timer = null
  store.subscribe((mutation, state) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        const persistKeys = ['user', 'settings', 'app']
        const toPersist = {}
        persistKeys.forEach(k => {
          if (state[k]) toPersist[k] = state[k]
        })
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist))
      } catch (e) {
        console.error('persist vuex state failed', e)
      }
    }, 300)
  })
}
