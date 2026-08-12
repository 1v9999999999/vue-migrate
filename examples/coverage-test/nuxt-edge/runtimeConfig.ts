// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // 私有 (服务端 only)
    apiSecret: process.env.API_SECRET,
    dbUrl: process.env.DATABASE_URL,
    // 公开
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
      appName: 'My App',
      version: '1.0.0'
    }
  }
})

// 在组件/composable 用
const config = useRuntimeConfig()
console.log(config.apiSecret)  // 服务端 only
console.log(config.public.appName)  // 客户端可用
