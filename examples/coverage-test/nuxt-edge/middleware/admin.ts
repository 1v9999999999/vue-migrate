// 命名 middleware, 在 page 用 definePageMeta({ middleware: 'admin' }) 启用
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useState('user', () => null)
  if (!user.value?.isAdmin) {
    return abortNavigation({ statusCode: 403, message: '需要管理员权限' })
  }
})
