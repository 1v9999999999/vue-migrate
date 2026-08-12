<template>
  <div class="grandchild-b">
    <h4>GrandChild B (deep inject)</h4>
    <p>API Base (deep): {{ deepApiBase }}</p>
    <p>Config (deep): {{ JSON.stringify(deepConfig) }}</p>
  </div>
</template>

<script>
export default {
  name: 'GrandChildB',
  // === inject 数组形式 (隔代) ===
  inject: ['apiBase as deepApiBase', 'config as deepConfig']
  // 注意: 上面这种语法是错的, 实际要用 from
  // 正确写法:
  // inject: {
  //   deepApiBase: { from: 'apiBase' },
  //   deepConfig: { from: 'config' }
  // }
}
</script>

<style scoped>
.grandchild-b {
  border: 1px dashed #4caf50;
  padding: 10px;
  margin: 5px 0;
  font-size: 14px;
}
</style>
