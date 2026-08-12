import Vue from 'vue'

Vue.config.productionTip = false
Vue.config.silent = process.env.NODE_ENV === 'production'
Vue.config.devtools = process.env.NODE_ENV !== 'production'
Vue.config.performance = true
Vue.config.errorHandler = (err, vm, info) => {
  console.error('Vue error:', err, info)
  // 上报
  if (window.Sentry) window.Sentry.captureException(err)
}
Vue.config.warnHandler = (msg, vm, trace) => {
  console.warn('Vue warn:', msg, trace)
}
Vue.config.keyCodes = {
  f1: 112,
  mediaPlayPause: 179,
  up: [38, 87]
}
Vue.config.ignoredElements = [
  'x-icon', 'x-button', /^x-/  // 正则匹配
]
Vue.config.async = false  // 强制同步更新 (Vue 2.6+, 删)
Vue.config.optionMergeStrategies = {
  // 自定义合并策略
  customOption: (parentVal, childVal) => {
    return childVal !== undefined ? childVal : parentVal
  }
}

// 全局 errorHandler 测试触发
Vue.config.errorHandler.call(null, new Error('test'), null, 'test info')
