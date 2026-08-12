// plugins/api.client.ts
export default defineNuxtPlugin((nuxtApp) => {
  const { $fetch } = useNuxtApp()
  const api = $fetch.create({
    baseURL: '/api',
    onRequest({ options }) {
      const token = useCookie('token')
      if (token.value) options.headers = { ...options.headers, Authorization: `Bearer ${token.value}` }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        navigateTo('/login')
      }
    }
  })
  return {
    provide: { api }
  }
})
