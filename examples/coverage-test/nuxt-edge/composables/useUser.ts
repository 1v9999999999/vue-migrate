// composables/useUser.ts - 自动导入
export function useUser() {
  const user = useState('user', () => null)
  const config = useRuntimeConfig()

  async function login(credentials) {
    const { $api } = useNuxtApp()
    const res = await $api('/auth/login', { method: 'POST', body: credentials })
    user.value = res.user
    const token = useCookie('token')
    token.value = res.token
    return res
  }

  function logout() {
    user.value = null
    const token = useCookie('token')
    token.value = null
  }

  return { user: readonly(user), login, logout, isLoggedIn: computed(() => !!user.value) }
}
