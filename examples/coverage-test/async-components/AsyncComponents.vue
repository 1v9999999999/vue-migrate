<template>
  <div class="async-components">
    <h2>Async Components Demo</h2>

    <!-- Vue 2 异步组件: () => import() -->
    <AsyncChart v-if="showChart" :data="chartData" />

    <!-- Vue 2 异步组件: 工厂函数 resolve/reject -->
    <AsyncForm v-if="showForm" @submit="onSubmit" />

    <!-- Vue 2 异步组件: 高级配置 (loading/error/delay/timeout) -->
    <AsyncHeavy v-if="showHeavy" :config="heavyConfig" />

    <!-- 动态组件 + 异步 -->
    <component :is="currentAsync" v-if="currentAsync" />

    <!-- 条件加载 -->
    <button @click="loadChart">Load Chart</button>
    <button @click="loadForm">Load Form</button>
    <button @click="loadHeavy">Load Heavy Component</button>
    <button @click="toggleDynamic">Toggle Dynamic</button>
  </div>
</template>

<script>
import Vue from 'vue'

// === 1. 基本异步组件 (import 工厂) ===
const AsyncChart = () => import('./AsyncChart.vue')

// === 2. resolve/reject 工厂函数 (旧写法) ===
const AsyncForm = (resolve, reject) => {
  // 模拟异步加载
  setTimeout(() => {
    // 动态 import
    import('./AsyncForm.vue')
      .then(module => resolve(module.default))
      .catch(err => reject(err))
  }, 200)
}

// === 3. 高级异步组件配置 ===
const AsyncHeavy = () => ({
  // 加载组件
  component: import('./AsyncHeavy.vue'),
  // loading 组件
  loading: {
    render(h) {
      return h('div', { class: 'async-loading' }, 'Loading Heavy...')
    }
  },
  // error 组件
  error: {
    render(h, ctx) {
      return h('div', { class: 'async-error' }, 'Failed to load')
    }
  },
  // 延迟显示 loading (ms)
  delay: 200,
  // 超时时间 (ms), 超后显示 error
  timeout: 10000
})

// === 4. 动态异步组件 ===
const asyncComponents = {
  ChartA: () => import('./ChartA.vue'),
  ChartB: () => import('./ChartB.vue'),
  ChartC: () => import('./ChartC.vue')
}

export default {
  name: 'AsyncComponents',
  components: {
    AsyncChart,
    AsyncForm,
    AsyncHeavy
  },
  data() {
    return {
      showChart: false,
      showForm: false,
      showHeavy: false,
      chartData: [1, 2, 3, 4, 5],
      heavyConfig: { mode: 'full' },
      currentAsync: null,
      dynamicIndex: 0
    }
  },
  methods: {
    loadChart() {
      this.showChart = true
    },
    loadForm() {
      this.showForm = true
    },
    loadHeavy() {
      this.showHeavy = true
    },
    toggleDynamic() {
      const keys = Object.keys(asyncComponents)
      this.dynamicIndex = (this.dynamicIndex + 1) % keys.length
      const key = keys[this.dynamicIndex]
      this.currentAsync = asyncComponents[key]
    },
    onSubmit(payload) {
      console.log('form submitted:', payload)
    }
  }
}

// === 5. Vue.component 异步注册 ===
// Vue.component('async-global', () => import('./AsyncGlobal.vue'))

// === 6. 异步组件 + webpack chunk name ===
// const AsyncNamed = () => import(/* webpackChunkName: "charts" */ './AsyncChart.vue')
</script>

<style scoped>
.async-components {
  padding: 20px;
}
button {
  margin: 5px;
  padding: 8px 16px;
  cursor: pointer;
}
.async-loading {
  color: #409eff;
  padding: 20px;
  text-align: center;
}
.async-error {
  color: #f56c6c;
  padding: 20px;
  text-align: center;
}
</style>
