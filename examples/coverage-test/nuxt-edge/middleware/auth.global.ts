// 全局 middleware, 每次路由都跑
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useState('user', () => null)

  // 公开路由白名单
  const publicRoutes = ['/', '/login', '/about']
  if (publicRoutes.includes(to.path)) return

  if (!user.value) {
    return navigateTo('/login?redirect=' + encodeURIComponent(to.fullPath))
  }
})
