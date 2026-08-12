// Router 边缘配置 —— 含 Vue 3 废弃/改动的选项
import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

export default new Router({
  // abstract 模式 —— Vue 3 改为 createMemoryHistory()
  mode: 'abstract',

  // 基础路径 —— Vue 3 改为 createWebHistory(base)
  base: '/app/',

  // Vue 3 删除该选项 (history 模式下恒为 false)
  fallback: true,

  // 激活类名 —— Vue 3 移到 <router-link active-class="...">
  linkActiveClass: 'active-link',

  // 精确激活类名 —— Vue 3 移到 <router-link exact-active-class="...">
  linkExactActiveClass: 'exact-active',

  // 滚动行为 —— Vue 3 坐标键由 x/y 改为 top/left, selector 改为 el
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    if (to.hash) {
      return { selector: to.hash }
    }
    return { x: 0, y: 0 }
  },

  // 自定义 query 解析 —— Vue 3 仍由 createRouter 选项提供
  parseQuery(query) {
    const result = {}
    if (!query) return result
    query.replace(/^\?/, '').split('&').forEach(pair => {
      if (!pair) return
      const [key, val] = pair.split('=')
      if (key) result[decodeURIComponent(key)] = decodeURIComponent(val || '')
    })
    return result
  },

  stringifyQuery(obj) {
    if (!obj || !Object.keys(obj).length) return ''
    return '?' + Object.keys(obj)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`)
      .join('&')
  },

  routes: [
    {
      path: '/',
      component: () => import('@/views/home/index.vue')
    },
    {
      path: '/about',
      component: () => import('@/views/about/index.vue')
    },
    // Vue 2 通配符兜底
    { path: '*', redirect: '/' }
  ]
})
