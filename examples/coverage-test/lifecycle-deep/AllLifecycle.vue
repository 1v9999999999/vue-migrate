<template>
  <div>{{ msg }}</div>
</template>

<script>
// beforeCreate, created, beforeMount, mounted, beforeUpdate, updated,
// activated, deactivated, beforeUnmount (was beforeDestroy), unmounted (was destroyed),
// errorCaptured, renderTracked, renderTriggered, serverPrefetch
const lifecycleOrder = []

export default {
  name: 'AllLifecycle',
  data() { return { msg: 'init' } },
  beforeCreate() { lifecycleOrder.push('beforeCreate') },
  created() { lifecycleOrder.push('created') },
  beforeMount() { lifecycleOrder.push('beforeMount') },
  mounted() { lifecycleOrder.push('mounted') },
  beforeUpdate() { lifecycleOrder.push('beforeUpdate') },
  updated() { lifecycleOrder.push('updated') },
  activated() { lifecycleOrder.push('activated') },
  deactivated() { lifecycleOrder.push('deactivated') },
  beforeUnmount() { lifecycleOrder.push('beforeUnmount') },
  unmounted() { lifecycleOrder.push('unmounted') },
  errorCaptured(err, vm, info) { lifecycleOrder.push('errorCaptured'); return false },
  renderTracked() { lifecycleOrder.push('renderTracked') },
  renderTriggered() { lifecycleOrder.push('renderTriggered') },
  serverPrefetch() { lifecycleOrder.push('serverPrefetch') }
}
</script>
