<template>
  <div class="child-a" :class="'theme-' + injectedTheme">
    <h3>Child A</h3>
    <p>App Name: {{ injectedAppName }}</p>
    <p>Version: {{ injectedVersion }}</p>
    <p>Theme: {{ injectedTheme }}</p>
    <p>User: {{ injectedUser.name }} ({{ injectedUser.role }})</p>
    <p>API: {{ injectedApiBase }}</p>
    <button @click="changeTheme">Change Theme</button>
    <GrandChildA />
  </div>
</template>

<script>
import GrandChildA from './GrandChildA.vue'

export default {
  name: 'ChildA',
  components: { GrandChildA },
  // === inject 对象形式 ===
  inject: {
    injectedAppName: { from: 'appName', default: 'Unknown' },
    injectedVersion: { from: 'version', default: '0.0.0' },
    injectedTheme: { from: 'theme', default: 'light' },
    injectedUser: { from: 'user', default: () => ({ name: 'guest', role: 'none' }) },
    injectedApiBase: { from: 'apiBase', default: '/api' },
    updateTheme: { default: () => {} }
  },
  methods: {
    changeTheme() {
      this.updateTheme(this.injectedTheme === 'dark' ? 'light' : 'dark')
    }
  }
}
</script>

<style scoped>
.child-a {
  border: 1px solid #ccc;
  padding: 15px;
  margin: 10px 0;
}
.theme-dark {
  background: #333;
  color: #fff;
}
.theme-light {
  background: #fff;
  color: #333;
}
</style>
