/**
 * Nuxt 2 配置文件 — nuxt.config.js
 * 覆盖 Nuxt 特有配置项
 */
export default {
  // 模式 (universal = SSR, spa = 客户端)
  mode: 'universal',

  // 服务端配置
  server: {
    port: 3000,
    host: '0.0.0.0'
  },

  // 头部配置
  head: {
    title: 'My Nuxt App',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'Nuxt 2 app' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },

  // 全局 CSS
  css: [
    'element-ui/lib/theme-chalk/index.css',
    '@/assets/styles/main.scss'
  ],

  // 插件 (Nuxt 特有, 运行在 Vue 实例化前)
  plugins: [
    { src: '@/plugins/element-ui', ssr: true },
    { src: '@/plugins/axios', ssr: false },
    { src: '@/plugins/i18n' }
  ],

  // 中间件
  router: {
    middleware: ['auth', 'i18n'],
    extendRoutes(routes, resolve) {
      routes.push({
        name: 'custom',
        path: '/custom',
        component: resolve(__dirname, 'pages/custom.vue')
      })
    }
  },

  // Vuex store (Nuxt 自动扫描 store/ 目录)
  store: true,

  // 构建配置
  build: {
    transpile: [/^element-ui/],
    extend(config, { isDev, isClient }) {
      if (isDev && isClient) {
        config.devtool = 'source-map'
      }
      config.resolve.alias['@'] = resolve(__dirname, 'src')
    },
    extractCSS: process.env.NODE_ENV === 'production',
    babel: {
      plugins: [
        ['@babel/plugin-proposal-decorators', { legacy: true }],
        ['@babel/plugin-proposal-class-properties', { loose: true }]
      ]
    }
  },

  // 环境变量
  env: {
    apiBase: process.env.API_BASE || 'http://localhost:3000/api'
  },

  // 模块
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/auth',
    '@nuxtjs/pwa',
    'nuxt-i18n'
  ],

  // axios 模块配置
  axios: {
    baseURL: process.env.API_BASE || 'http://localhost:3000/api',
    credentials: true,
    proxyHeaders: true
  },

  // auth 模块
  auth: {
    strategies: {
      local: {
        endpoints: {
          login: { url: '/auth/login', method: 'post', propertyName: 'token' },
          logout: { url: '/auth/logout', method: 'post' },
          user: { url: '/auth/user', method: 'get', propertyName: 'data' }
        }
      }
    },
    redirect: {
      login: '/login',
      logout: '/',
      callback: '/login',
      home: '/'
    }
  },

  // i18n 配置
  i18n: {
    locales: [
      { code: 'zh', iso: 'zh-CN', name: '中文', file: 'zh.json' },
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' }
    ],
    defaultLocale: 'zh',
    strategy: 'prefix_except_default',
    vueI18n: {
      fallbackLocale: 'zh',
      messages: {
        zh: { welcome: '欢迎' },
        en: { welcome: 'Welcome' }
      }
    }
  },

  // PWA 配置
  pwa: {
    manifest: {
      name: 'My Nuxt App',
      short_name: 'NuxtApp',
      display: 'standalone',
      background_color: '#ffffff'
    },
    workbox: {
      runtimeCaching: [
        {
          urlPattern: 'https://fonts.googleapis.com/.*',
          handler: 'cacheFirst',
          strategyOptions: { cacheName: 'google-fonts' }
        }
      ]
    }
  },

  // 页面过渡
  pageTransition: 'page',
  layoutTransition: 'layout'
}
