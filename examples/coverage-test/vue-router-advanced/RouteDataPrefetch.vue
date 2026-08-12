// 1. 组件内 asyncData (Nuxt 风格, 自实现)
const asyncDataCache = new Map()

function prefetchAsyncData(route, store) {
  const Component = route.matched[route.matched.length - 1]?.components?.default
  if (!Component?.asyncData) return Promise.resolve()
  if (asyncDataCache.has(route.fullPath)) {
    return Promise.resolve(asyncDataCache.get(route.fullPath))
  }
  return Component.asyncData({ store, route }).then(data => {
    asyncDataCache.set(route.fullPath, data)
    return data
  })
}

router.beforeEach((to, from, next) => {
  prefetchAsyncData(to, store).then(() => next()).catch(next)
})

// 2. 组件内 beforeRouteEnter + next(vm => vm.fetchData())
export default {
  beforeRouteEnter(to, from, next) {
    next(vm => {
      vm.fetchData(to.params.id)
    })
  },
  async fetchData(id) {
    this.loading = true
    this.data = await api.get(id)
    this.loading = false
  }
}
