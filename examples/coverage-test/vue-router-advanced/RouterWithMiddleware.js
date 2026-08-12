// 1. 全局 middleware 注册
router.beforeEach(async (to, from, next) => {
  // 检查 token
  if (to.meta.requiresAuth) {
    const token = localStorage.getItem('token')
    if (!token) return next('/login')
  }
  // 检查权限
  if (to.meta.permission) {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    if (!user.permissions?.includes(to.meta.permission)) return next('/403')
  }
  next()
})

// 2. 路由表 + 路由内守卫
export const routes = [
  {
    path: '/admin',
    component: () => import('@/views/Admin.vue'),
    beforeEnter: (to, from, next) => {
      if (isAdmin()) next()
      else next({ name: 'Forbidden' })
    },
    meta: { requiresAuth: true, permission: 'admin.view' },
    children: [
      {
        path: 'users',
        component: () => import('@/views/admin/Users.vue'),
        meta: { title: '用户管理' }
      },
      {
        path: 'settings',
        component: () => import('@/views/admin/Settings.vue'),
        meta: { title: '系统设置' },
        beforeEnter: (to, from, next) => {
          if (hasRole('super_admin')) next()
          else next({ name: 'Forbidden' })
        }
      }
    ]
  }
]
