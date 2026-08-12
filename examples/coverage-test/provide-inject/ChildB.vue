<template>
  <div class="child-b">
    <h3>Child B</h3>
    <p>Config: {{ JSON.stringify(config) }}</p>
    <p>Timeout: {{ configTimeout }}</p>
    <GrandChildB />
  </div>
</template>

<script>
import GrandChildB from './GrandChildB.vue'

export default {
  name: 'ChildB',
  components: { GrandChildB },
  // === inject 数组形式 (简写) ===
  inject: ['config', 'apiBase'],
  computed: {
    configTimeout() {
      return this.config?.timeout || 3000
    }
  }
}
</script>

<style scoped>
.child-b {
  border: 1px solid #4caf50;
  padding: 15px;
  margin: 10px 0;
}
</style>
