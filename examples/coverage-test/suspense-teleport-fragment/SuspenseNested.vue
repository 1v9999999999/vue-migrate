<template>
  <div>
    <h1>页面</h1>
    <Suspense
      @resolve="onResolve"
      @pending="onPending"
      @fallback="onFallback"
    >
      <template #default>
        <AsyncDashboard />
      </template>
      <template #fallback>
        <div class="outer-loading">外层 loading...</div>
      </template>
    </Suspense>
  </div>
</template>

<script>
import { defineAsyncComponent, ref } from 'vue'
const AsyncDashboard = defineAsyncComponent({
  loader: () => import('./AsyncDashboard.vue'),
  delay: 200,
  timeout: 5000
})

export default {
  components: { AsyncDashboard },
  setup() {
    function onResolve() { console.log('resolved') }
    function onPending() { console.log('pending') }
    function onFallback() { console.log('fallback shown') }
    return { onResolve, onPending, onFallback }
  }
}
</script>
