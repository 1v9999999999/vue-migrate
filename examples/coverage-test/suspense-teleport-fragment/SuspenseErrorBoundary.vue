<template>
  <div>
    <div v-if="error" class="error">出错了: {{ error }}</div>
    <Suspense v-else>
      <template #default>
        <FailingComponent :should-fail="fail" />
      </template>
      <template #fallback>
        <div>loading...</div>
      </template>
    </Suspense>
    <button @click="fail = !fail">toggle fail</button>
  </div>
</template>

<script>
export default {
  data() {
    return { fail: false, error: null }
  },
  errorCaptured(err) {
    this.error = err.message
    return false
  }
}
</script>
