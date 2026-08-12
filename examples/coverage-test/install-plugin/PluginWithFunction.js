import Vue from 'vue'

// plugin 可以是 function (install 默认 = plugin 本身)
function LoggerPlugin(Vue, options) {
  Vue.config.errorHandler = function(err, vm, info) {
    console.error(`[${options.appName}]`, err, info)
  }
  Vue.mixin({
    mounted() {
      if (options.trackMount) {
        console.log(`[${options.appName}] mounted:`, this.$options.name)
      }
    }
  })
}

Vue.use(LoggerPlugin, { appName: 'MyApp', trackMount: true })

export default LoggerPlugin
