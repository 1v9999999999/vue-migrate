export default {
  scrollBehavior(to, from, savedPosition) {
    // 1. 后退/前进按钮 → 还原位置
    if (savedPosition) return savedPosition

    // 2. hash 锚点
    if (to.hash) {
      return { selector: to.hash, behavior: 'smooth', offset: { x: 0, y: 60 } }
    }

    // 3. query 控制 (e.g. ?scroll=top)
    if (to.query.scroll === 'top') return { x: 0, y: 0 }

    // 4. meta 控制
    if (to.meta.scrollTo) {
      return { selector: to.meta.scrollTo, behavior: 'smooth' }
    }

    // 5. 默认
    return { x: 0, y: 0 }
  }
}

// 配合: 路由 meta scrollTo
const routes = [
  { path: '/list', component: List, meta: { scrollTo: '#list-end' } }
]
