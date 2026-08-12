<script setup>
// router/auth.js
export function setupAuthGuard(router) {
  router.beforeEach((to, from, next) => {
    const isLoggedIn = !!localStorage.getItem('token')
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]')

    // 白名单
    if (to.meta.public) return next()

    // 登录检查
    if (to.meta.requiresAuth && !isLoggedIn) {
      return next({ path: '/login', query: { redirect: to.fullPath } })
    }

    // 角色检查
    if (to.meta.roles) {
      const allowed = to.meta.roles.some(r => userRoles.includes(r))
      if (!allowed) {
        return next({ path: '/403', query: { required: to.meta.roles.join(',') } })
      }
    }

    next()
  })
}
</script>

<template>
  <div>
    <h3>Auth Guard</h3>
    <p>路由权限守卫 + 角色检查 + 登录重定向</p>
  </div>
</template>
