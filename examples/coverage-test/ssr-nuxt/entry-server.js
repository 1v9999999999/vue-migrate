/**
 * Nuxt 2 SSR 入口 — entry-server.js
 * Vue 2 服务端渲染入口
 * Nuxt 3 改法: createSSRApp, renderToString from @vue/server-renderer
 */
import { createApp } from './entry-client'

// ====== 服务端入口 ======
export default context => {
  return new Promise((resolve, reject) => {
    const { app, router, store } = createApp()

    router.push(context.url)

    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents()

      // 无匹配路由 → 404
      if (!matchedComponents.length) {
        return reject({ code: 404 })
      }

      // 执行所有匹配组件的 asyncData
      Promise.all(matchedComponents.map(Component => {
        if (Component.asyncData) {
          return Component.asyncData({
            store,
            route: router.currentRoute
          })
        }
      })).then(() => {
        // asyncData 执行完后, state 已经更新
        // 把 state 暴露给模板, 用于客户端 hydration
        context.state = store.state
        context.rendered = () => {
          context.state = store.state
        }

        resolve(app)
      }).catch(reject)
    }, reject)
  })
}
