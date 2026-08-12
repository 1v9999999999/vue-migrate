<template>
  <div class="deep-nested">
    <h3>Deep Nested (3 levels deep)</h3>
    <p>App: {{ app }}</p>
    <p>Theme: {{ currentTheme }}</p>
    <p>User: {{ userInfo.name }}</p>
    <button @click="toggle">Toggle Theme</button>
    <GrandChildA />
    <GrandChildB />
  </div>
</template>

<script>
import GrandChildA from './GrandChildA.vue'
import GrandChildB from './GrandChildB.vue'

export default {
  name: 'DeepNested',
  components: { GrandChildA, GrandChildB },
  inject: {
    app: { from: 'appName', default: 'N/A' },
    currentTheme: { from: 'theme', default: 'light' },
    userInfo: { from: 'user', default: () => ({ name: 'guest' }) },
    updateTheme: { default: () => {} }
  },
  methods: {
    toggle() {
      this.updateTheme(this.currentTheme === 'dark' ? 'light' : 'dark')
    }
  }
}
</script>

<style scoped>
.deep-nested {
  border: 2px solid #ff9800;
  padding: 15px;
  margin: 10px 0;
}
</style>
