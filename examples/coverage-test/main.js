/*
 * Vue 2 main.js 穷举测试
 * iter-087: 入口文件所有写法 (含 Vue 2 静态 API / prototype / 异步 init / 错误处理 / 3rd-party 集成)
 */
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// ============ Vue 2 静态 API 注册 ============
// 全局 plugin
Vue.use(ElementUI, { size: 'small', zIndex: 3000 })
Vue.use(require('@/utils/permission-directive'))
Vue.use(async function install(Vue) {
  // 异步 install (生僻)
  const { default: somePlugin } = await import('@/plugins/some')
  Vue.use(somePlugin)
})

// 全局 component
Vue.component('GlobalComp', { template: '<div>global</div>' })
Vue.component('MyError', { template: '<p>error</p>' })

// 全局 directive
Vue.directive('focus', { inserted: el => el.focus() })
Vue.directive('pin', {
  bind(el, binding) { el.style.position = 'fixed' },
  unbind(el) { el.style.position = '' }
})

// 全局 filter
Vue.filter('uppercase', v => v.toUpperCase())
Vue.filter('currency', (v, sym = '$') => `${sym}${v}`)

// 全局 mixin
Vue.mixin({
  data() { return { globalMix: 1 } },
  created() { console.log('global mixin created') }
})

// Vue.prototype 全局属性 (this-replacer 目标)
Vue.prototype.$http = null
Vue.prototype.$axios = require('axios')
Vue.prototype.$api = require('@/utils/api')
Vue.prototype.$util = { format: s => s }
Vue.prototype.$bus = new Vue()  // 事件总线 (Vue 2 风格)

// 自定义 plugin 通过 Vue.prototype 注入
Vue.prototype.$message = {
  success: msg => console.log('msg:', msg),
  error: msg => console.error('msg:', msg)
}

// ============ Vue.config ============
Vue.config.productionTip = false
Vue.config.devtools = true
Vue.config.silent = process.env.NODE_ENV === 'production'
Vue.config.performance = true
Vue.config.errorHandler = (err, vm, info) => {
  console.error('[GlobalError]', err, info)
  // 异步上报
  fetch('/api/log', { method: 'POST', body: JSON.stringify({ err: err.message, info }) })
    .catch(() => {})
}
Vue.config.warnHandler = (msg, vm, trace) => {
  console.warn('[GlobalWarn]', msg, trace)
}
Vue.config.globalProperties = {  // Vue 3 写法
  $translate: key => i18n[key]
}

// ============ 异步初始化 (生僻: 在 mount 前等异步数据) ============
async function bootstrap() {
  try {
    // 1. 拉取用户信息
    const { data: user } = await Vue.prototype.$axios.get('/api/user/me')
    store.commit('SET_USER', user)

    // 2. 拉取权限
    const { data: perms } = await Vue.prototype.$axios.get('/api/perms')
    store.commit('SET_PERMS', perms)

    // 3. 拉取字典
    const { data: dicts } = await Vue.prototype.$axios.get('/api/dicts')
    store.commit('SET_DICTS', dicts)

    // 4. 初始化 Sentry / 监控
    if (process.env.NODE_ENV === 'production') {
      const Sentry = await import('@sentry/vue')
      Sentry.init({ app: undefined, dsn: process.env.VUE_APP_SENTRY_DSN })
    }
  } catch (err) {
    console.error('Bootstrap failed:', err)
  }

  // 5. 启动 app
  new Vue({
    router,
    store,
    render: h => h(App),
    // Vue 2 自定义配置
    provide: {
      theme: 'light',
      apiBase: process.env.VUE_APP_API_BASE
    },
    // 自定义错误处理 (component 级别)
    errorCaptured(err, vm, info) {
      console.error('[ComponentError]', err, info)
      return false
    }
  }).$mount('#app')
}

// 6. 启动
bootstrap().catch(err => {
  console.error('App failed to start:', err)
  // 兜底: 即使初始化失败也要 mount, 让用户看到错误页
  new Vue({
    router,
    store,
    render: h => h('div', 'App failed to load. Please refresh.')
  }).$mount('#app')
})
