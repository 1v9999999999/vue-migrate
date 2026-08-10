// Comprehensive Vue2 entry file — used to test @vue-migrate/plugin-vue3-entry
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import axios from 'axios'
import GlobalX from './components/GlobalX.vue'
import focusDirective from './directives/focus'

// 1.6 Vue.use → app.use (chain)
Vue.use(ElementUI, { size: 'small' })
Vue.use(router)
Vue.use(store)

// 1.7 Vue.component / directive → app.component / app.directive
Vue.component('GlobalX', GlobalX)
Vue.directive('focus', focusDirective)

// 1.7 Vue.filter / mixin → manual review (no app equivalent)
Vue.filter('upper', (str) => (str || '').toUpperCase())
Vue.mixin({
  created() {
    console.log('global mixin created')
  },
})

// 1.8 Vue.prototype → app.config.globalProperties
Vue.prototype.$axios = axios
Vue.prototype.$bus = new Vue()

// 6.7 Vue.config.* 各项
Vue.config.productionTip = false
Vue.config.silent = true
Vue.config.devtools = true
Vue.config.errorHandler = (err, vm, info) => {
  console.error('[GlobalError]', err, info)
}
Vue.config.warnHandler = (msg, vm, trace) => {
  console.warn('[VueWarn]', msg, trace)
}
Vue.config.keyCodes = { esc: 27, enter: 13 }
Vue.config.async = true
Vue.config.ignoredElements = ['my-el', 'ion-icon']

// 1.14 Vue.observable → reactive (in any file)
const sharedState = Vue.observable({ count: 0, user: null })

// 1.16 入口链
new Vue({
  router,
  store,
  data() {
    return { sharedState }
  },
  render: (h) => h(App),
}).$mount('#app')
