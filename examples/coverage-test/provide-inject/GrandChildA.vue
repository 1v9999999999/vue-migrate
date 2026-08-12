<template>
  <div class="grandchild-a">
    <h4>GrandChild A (deep inject)</h4>
    <p>App Name (deep): {{ deepAppName }}</p>
    <p>Theme (deep): {{ deepTheme }}</p>
    <p>Has updateTheme: {{ canUpdateTheme }}</p>
  </div>
</template>

<script>
export default {
  name: 'GrandChildA',
  // === 深层 inject (隔代传递) ===
  inject: {
    deepAppName: { from: 'appName', default: 'unknown' },
    deepTheme: { from: 'theme', default: 'light' },
    updateTheme: { default: null }
  },
  computed: {
    canUpdateTheme() {
      return typeof this.updateTheme === 'function'
    }
  }
}
</script>

<style scoped>
.grandchild-a {
  border: 1px dashed #999;
  padding: 10px;
  margin: 5px 0;
  font-size: 14px;
}
</style>
