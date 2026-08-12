/**
 * Nuxt 2 SSR 入口 — entry-client.js
 * Vue 2 + vue-router + vuex SSR 客户端 hydration
 * Nuxt 3 改法: createSSRApp, useFetch, useAsyncData
 */
import Vue from 'vue'
import { createRouter } from './router'
import { createStore } from './store'
import App from './App.vue'

Vue.config.productionTip = false

// ====== 客户端入口 ======
export function createApp() {
  const router = createRouter()
  const store = createStore()

  const app = new Vue({
    router,
    store,
    render: h => h(App)
  })

  return { app, router, store }
}

// ====== 客户端 hydration ======
const { app, router, store } = createApp()

// 同步服务端 state (window.__INITIAL_STATE__)
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__)
}

router.onReady(() => {
  // 挂载前添加路由钩子处理 asyncData
  router.beforeResolve((to, from, next) => {
    const matched = router.getMatchedComponents(to)
    const prevMatched = router.getMatchedComponents(from)

    // 找出差异组件
    let diffed = false
    const activated = matched.filter((comp, i) => {
      return diffed || (diffed = (prevMatched[i] !== comp))
    })

    // 对没有 asyncData 的组件跳过
    if (!activated.some(c => c.asyncData)) {
      return next()
    }

    // 执行所有 asyncData
    Promise.all(activated.map(c => {
      if (c.asyncData) {
        return c.asyncData({
          store,
          route: to
        })
      }
    })).then(() => {
      next()
    }).catch(next)
  })

  // 实际挂载
  app.$mount('#app')
})
