<template>
  <div class="provide-inject-demo">
    <h2>Provide / Inject Patterns</h2>
    <ChildA />
    <ChildB />
    <DeepNested />
  </div>
</template>

<script>
import ChildA from './ChildA.vue'
import ChildB from './ChildB.vue'
import DeepNested from './DeepNested.vue'

export default {
  name: 'ProvideInjectDemo',
  components: { ChildA, ChildB, DeepNested },
  data() {
    return {
      theme: 'dark',
      user: { name: 'admin', role: 'super' },
      config: { apiBase: '/api', timeout: 5000 },
      _appState: { initialized: false }
    }
  },
  // === 1. 对象形式 provide ===
  provide: {
    appName: 'MyApp',
    version: '2.0.0',
    apiBase: '/api/v1'
  },
  // === 2. 函数形式 provide (可以访问 this) ===
  // provide() {
  //   return {
  //     theme: this.theme,
  //     user: this.user,
  //     config: this.config,
  //     appName: 'MyApp',
  //     updateTheme: this.updateTheme,
  //     _appState: this._appState
  //   }
  // },
  methods: {
    updateTheme(newTheme) {
      this.theme = newTheme
    }
  }
}
</script>

<style scoped>
.provide-inject-demo {
  border: 1px solid #ddd;
  padding: 20px;
  margin: 10px;
}
</style>
