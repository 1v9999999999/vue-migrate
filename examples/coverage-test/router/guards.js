import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { getToken } from '@/utils/auth'
import store from '@/store'
import getPageTitle from '@/utils/get-page-title'

NProgress.configure({ showSpinner: false })

// 白名单 (无需登录即可访问)
const whiteList = ['/login', '/auth-redirect', '/register', '/forgot-password']

export function setupRouterGuards(router) {
  // 全局前置守卫
  router.beforeEach(async (to, from, next) => {
    NProgress.start()
    document.title = getPageTitle(to.meta.title)

    const hasToken = getToken()

    if (hasToken) {
      if (to.path === '/login') {
        // 已登录, 跳首页
        next({ path: '/' })
        NProgress.done()
      } else {
        const hasRoles = store.getters.roles && store.getters.roles.length > 0
        if (hasRoles) {
          next()
        } else {
          try {
            const { roles } = await store.dispatch('user/getInfo')
            const accessRoutes = await store.dispatch('permission/generateRoutes', roles)
            router.addRoutes(accessRoutes)
            next({ ...to, replace: true })
          } catch (error) {
            // token 失效
            await store.dispatch('user/fedLogout')
            this.$message.error(error || 'Has Error')
            next(`/login?redirect=${to.path}`)
            NProgress.done()
          }
        }
      }
    } else {
      if (whiteList.indexOf(to.path) !== -1) {
        next()
      } else {
        next(`/login?redirect=${to.path}`)
        NProgress.done()
      }
    }
  })

  // 全局解析守卫
  router.beforeResolve(async (to, from, next) => {
    if (to.matched && to.matched.length) {
      const components = to.matched.map(r => r.components.default)
      try {
        await Promise.all(components.map(c => c()))
      } catch (e) {
        console.warn('preload route failed', e)
      }
    }
    next()
  })

  // 全局后置钩子
  router.afterEach((to, from) => {
    NProgress.done()
    // 滚动恢复
    if (to.meta && to.meta.scrollToTop !== false) {
      window.scrollTo(0, 0)
    }
    // 埋点
    if (window._hmt) {
      window._hmt.push(['_trackPageview', to.fullPath])
    }
  })

  // 错误处理
  router.onError((error) => {
    console.error('router error', error)
    const pattern = /Loading chunk (\S+) failed/
    if (pattern.test(error.message)) {
      // chunk 加载失败, 刷新页面
      window.location.reload()
    }
  })
}
