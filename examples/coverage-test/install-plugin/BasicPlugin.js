import Vue from 'vue'

// 1. 定义一个 plugin
const MyPlugin = {
  install(Vue, options = {}) {
    // 1.1 全局组件
    Vue.component('plugin-button', {
      template: '<button :class="className"><slot/></button>',
      props: ['className']
    })
    // 1.2 全局指令
    Vue.directive('plugin-focus', {
      inserted(el) { el.focus() }
    })
    // 1.3 全局 mixin
    Vue.mixin({
      created() {
        this.$pluginName = options.name || 'MyPlugin'
      }
    })
    // 1.4 注入全局属性
    Vue.prototype.$myMethod = function() { return options.prefix || 'default' }
    // 1.5 全局 provide
    Vue.prototype.$apiBase = options.apiBase || '/api'
  }
}

// 2. 使用
Vue.use(MyPlugin, { name: 'AuthPlugin', prefix: 'auth-', apiBase: '/api/v2' })

export default MyPlugin
