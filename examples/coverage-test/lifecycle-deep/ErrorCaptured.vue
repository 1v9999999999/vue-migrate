<template>
  <div>
    <h1>App</h1>
    <p v-if="error" class="error">Caught: {{ error }}</p>
    <OuterComp />
  </div>
</template>

<script>
import { defineComponent, h } from 'vue'

// 父级
export default defineComponent({
  name: 'App',
  data() { return { error: null } },
  errorCaptured(err, vm, info) {
    console.log('App errorCaptured:', err.message)
    this.error = err.message
    // return false 阻止向上传播
    return false
  }
})

// 中间层
export const OuterComp = defineComponent({
  name: 'Outer',
  components: { Buggy: () => import('./ErrorCaptured.vue').then(m => m.Buggy) },
  errorCaptured(err, vm, info) {
    console.log('Outer errorCaptured:', info)
    // 不 return false, 继续向上传播
  },
  template: '<div><Buggy /></div>'
})

// 子级 (会抛错)
export const Buggy = defineComponent({
  name: 'Buggy',
  render() {
    throw new Error('intentional error')
  }
})
</script>
