// i18n-ssr.js
import { createI18n } from 'vue-i18n'

export function createSSR_i18n(initialLocale = 'zh-CN') {
  return createI18n({
    legacy: false,
    locale: initialLocale,
    fallbackLocale: 'en',
    messages: {}  // 服务端按需加载
  })
}

// server.js
import { createSSRApp } from 'vue'
import { createSSR_i18n } from './i18n-ssr'

async function createApp(req) {
  const app = createSSRApp(App)
  const i18n = createSSR_i18n(req.cookies.lang)
  // 服务端预加载语言
  const messages = await import(`./locales/${i18n.global.locale.value}.json`)
  i18n.global.setLocaleMessage(i18n.global.locale.value, messages.default)
  app.use(i18n)
  return { app, i18n }
}
