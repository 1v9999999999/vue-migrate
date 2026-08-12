// 登录后根据用户角色动态添加路由
export function setupDynamicRoutes(router, userRole) {
  // 清空旧动态路由
  if (router.options.routes.length > baseRoutes.length) {
    for (let i = router.options.routes.length - 1; i >= baseRoutes.length; i--) {
      router.removeRoute(router.options.routes[i].name)
    }
  }

  // 添加新路由
  if (userRole === 'admin') {
    router.addRoute({
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/Admin.vue'),
      meta: { requiresAuth: true }
    })
    router.addRoute({
      path: '/admin/users',
      name: 'AdminUsers',
      component: () => import('@/views/admin/Users.vue')
    })
  } else {
    router.addRoute({
      path: '/profile',
      name: 'Profile',
      component: () => import('@/views/Profile.vue')
    })
  }

  // 最后添加 catch-all
  router.addRoute({
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  })
}

// 嵌套添加
router.addRoute('Admin', {
  path: 'settings',
  name: 'AdminSettings',
  component: () => import('@/views/admin/Settings.vue')
})
