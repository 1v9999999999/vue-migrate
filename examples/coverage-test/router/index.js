import Vue from 'vue'
import VueRouter from 'vue-router'

// 静态路由 (所有人都能访问)
export const constantRoutes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', noAuth: true, icon: 'user' },
    hidden: true
  },
  {
    path: '/404',
    name: 'NotFound',
    component: () => import('@/views/error/404.vue'),
    meta: { title: '404', noAuth: true },
    hidden: true
  },
  {
    path: '/',
    component: () => import('@/layout/index.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '首页', icon: 'home', affix: true, keepAlive: true }
      }
    ]
  }
]

// 动态路由 (需要权限)
export const asyncRoutes = [
  {
    path: '/user',
    component: () => import('@/layout/index.vue'),
    redirect: '/user/list',
    meta: { title: '用户管理', icon: 'user', roles: ['admin', 'editor'] },
    children: [
      {
        path: 'list',
        name: 'UserList',
        component: () => import('@/views/user/list.vue'),
        meta: { title: '用户列表', icon: 'unordered-list', roles: ['admin'] }
      },
      {
        path: 'profile',
        name: 'UserProfile',
        component: () => import('@/views/user/profile.vue'),
        meta: { title: '个人中心', icon: 'user', roles: ['admin', 'editor'] }
      }
    ]
  },
  {
    path: '/nested',
    component: () => import('@/layout/index.vue'),
    redirect: '/nested/menu1',
    meta: { title: '嵌套路由', icon: 'apartment', roles: ['admin', 'editor'] },
    children: [
      {
        path: 'menu1',
        component: () => import('@/views/nested/menu1/index.vue'),
        meta: { title: '菜单 1' },
        children: [
          {
            path: 'menu1-1',
            name: 'Menu1-1',
            component: () => import('@/views/nested/menu1/menu1-1.vue'),
            meta: { title: 'Menu 1-1' }
          },
          {
            path: 'menu1-2',
            name: 'Menu1-2',
            component: () => import('@/views/nested/menu1/menu1-2.vue'),
            meta: { title: 'Menu 1-2' }
          }
        ]
      },
      {
        path: 'menu2',
        name: 'Menu2',
        component: () => import('@/views/nested/menu2.vue'),
        meta: { title: '菜单 2' }
      }
    ]
  },
  {
    path: '/external-link',
    name: 'ExternalLink',
    component: () => import('@/views/external-link.vue'),
    meta: { title: '外链', icon: 'link' }
  },
  // 404 必须放最后
  { path: '*', redirect: '/404', hidden: true }
]

Vue.use(VueRouter)

const router = new VueRouter({
  mode: 'history',
  base: process.env.BASE_URL,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { x: 0, y: 0 }
  },
  routes: constantRoutes
})

// 重置路由 (用于登出 / 切换角色)
export function resetRouter() {
  const newRouter = new VueRouter({
    mode: 'history',
    base: process.env.BASE_URL,
    scrollBehavior: () => ({ x: 0, y: 0 }),
    routes: constantRoutes
  })
  router.matcher = newRouter.matcher
}

export default router
