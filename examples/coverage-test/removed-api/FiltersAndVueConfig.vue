<template>
  <div class="filters-config">
    <h3>Filters &amp; Vue.config Demo</h3>
    <p>capitalize: {{ 'hello world' | capitalize }}</p>
    <p>truncate(10): {{ 'this is a long sentence' | truncate(10) }}</p>
    <p>配置见 script, 全局生效</p>
  </div>
</template>

<script>
import Vue from 'vue'

// Vue.config.productionTip = false
Vue.config.productionTip = false

// Vue.config.silent = true
Vue.config.silent = true

// Vue.config.devtools = false
Vue.config.devtools = false

// Vue.config.ignoredElements = ['x-custom']
Vue.config.ignoredElements = ['x-custom']

// Vue.config.errorHandler = (err, vm, info) => {...}
Vue.config.errorHandler = (err, vm, info) => {
  console.error('[errorHandler]', info, err)
  if (vm) {
    console.error('[errorHandler vm]', vm.$options.name)
  }
}

// Vue.config.warnHandler = (msg, vm, trace) => {...}
Vue.config.warnHandler = (msg, vm, trace) => {
  console.warn('[warnHandler]', msg, trace)
  if (vm) {
    console.warn('[warnHandler vm]', vm.$options.name)
  }
}

// Vue.filter('capitalize', function(v) {...})
Vue.filter('capitalize', function (value) {
  if (!value) return ''
  value = String(value)
  return value.charAt(0).toUpperCase() + value.slice(1)
})

// Vue.filter('truncate', (v, n) => v.slice(0, n))
Vue.filter('truncate', (value, length) => {
  if (!value) return ''
  return String(value).slice(0, length)
})

export default {
  name: 'FiltersAndVueConfig'
}
</script>

<style scoped>
.filters-config {
  padding: 16px;
  border: 1px solid #eee;
}
</style>
