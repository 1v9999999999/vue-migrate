// 完整导航守卫 —— 全局 / 路由内 / 组件内, 每个守卫含真实逻辑
import store from '@/store'
import { getToken } from '@/utils/auth'
import NProgress from 'nprogress'

function isAuthenticated() {
  return !!getToken()
}

function getRoles() {
  const userState = store.state.user
  return (userState && userState.roles) || []
}

// ---------- 全局守卫 ----------
export function setupGuards(router) {
  // 全局前置守卫: 登录态 + 权限校验
  router.beforeEach((to, from, next) => {
    NProgress.start()
    if (to.meta && to.meta.requiresAuth && !isAuthenticated()) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }
    next()
  })

  // 全局解析守卫: 异步数据预取 (所有懒加载组件先加载完再进入)
  router.beforeResolve(async (to, from, next) => {
    if (to.matched && to.matched.length) {
      try {
        await Promise.all(
          to.matched
            .map(r => r.components && r.components.default)
            .filter(Boolean)
            .map(lazy => lazy())
        )
      } catch (err) {
        console.warn('[router] preload failed', err)
      }
    }
    next()
  })

  // 全局后置钩子: 埋点 + 进度条结束 (无 next)
  router.afterEach((to, from) => {
    NProgress.done()
    if (window._hmt) {
      window._hmt.push(['_trackPageview', to.fullPath])
    }
  })

  // 错误处理 (如 chunk 加载失败)
  router.onError(err => {
    NProgress.done()
    console.error('[router] error', err)
  })
}

// ---------- 路由内守卫 ----------
export const adminRoute = {
  path: '/admin',
  name: 'Admin',
  component: () => import('@/views/admin/index.vue'),
  meta: { requiresAuth: true },
  beforeEnter: (to, from, next) => {
    if (getRoles().includes('admin')) {
      next()
    } else {
      next({ path: '/403' })
    }
  }
}

export const routesWithGuards = [
  adminRoute,
  {
    path: '/editor',
    component: () => import('@/views/editor/index.vue'),
    beforeEnter: (to, from, next) => {
      const roles = getRoles()
      if (roles.includes('admin') || roles.includes('editor')) {
        next()
      } else {
        // 中断导航, 留在当前页
        next(false)
      }
    }
  }
]

// ---------- 组件内守卫 ----------
// 实际位于 .vue 文件的 export default, 此处作为组件选项对象导出
export default {
  name: 'GuardedComponent',
  data() {
    return {
      dirty: false,
      detail: null
    }
  },
  methods: {
    fetchData() {
      return this.$store.dispatch('user/getInfo').then(res => {
        this.detail = res
      })
    }
  },
  // 进入前: 无法访问 this, 通过 next(vm => cb) 回调访问实例
  beforeRouteEnter(to, from, next) {
    next(vm => {
      vm.fetchData()
    })
  },
  // 路由参数变化 (同组件复用, 如 /user/1 -> /user/2): 可访问 this
  beforeRouteUpdate(to, from, next) {
    this.detail = null
    this.fetchData().finally(() => next())
  },
  // 离开前: 阻止未保存数据丢失
  beforeRouteLeave(to, from, next) {
    if (this.dirty) {
      const leave = window.confirm('有未保存的修改, 确认离开?')
      if (!leave) {
        next(false)
        return
      }
    }
    next()
  }
}
