import Vue from 'vue'
import Router from 'vue-router'
import Vuex from 'vuex'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import VueI18n from 'vue-i18n'
import VueLazyload from 'vue-lazyload'

Vue.use(Router)
Vue.use(Vuex)
Vue.use(ElementUI, { size: 'small' })
Vue.use(VueI18n)
Vue.use(VueLazyload, {
  preLoad: 1.3,
  error: '/img/error.png',
  loading: '/img/loading.gif',
  attempt: 1
})

// 路由 + store + i18n 实例化
const router = new Router({ routes: [] })
const store = new Vuex.Store({ state: {} })
const i18n = new VueI18n({ locale: 'zh-CN' })

new Vue({
  router,
  store,
  i18n,
  render: h => h(App)
}).$mount('#app')

export { router, store, i18n }
