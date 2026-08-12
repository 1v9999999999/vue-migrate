<template>
  <div>async component</div>
</template>

<script>
import { onMounted, onBeforeUnmount, onUpdated } from 'vue'

export default {
  name: 'AsyncLifecycle',
  async setup() {
    // 1. async setup
    const data = await fetchData()
    onMounted(() => {
      // 启动副作用 (如 event listener)
      window.addEventListener('resize', this.handleResize)
    })
    onBeforeUnmount(() => {
      // 清理副作用
      window.removeEventListener('resize', this.handleResize)
      // abort fetch
      if (this._controller) this._controller.abort()
    })
    onUpdated(() => {
      // DOM 更新后
    })
    return { data }
  },
  methods: {
    handleResize() { this.width = window.innerWidth }
  }
}
</script>
