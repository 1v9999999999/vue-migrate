<template>
  <div>keep-alive component</div>
</template>

<script>
export default {
  name: 'CachedComp',
  data() { return { lastVisit: Date.now() } },
  activated() {
    // 每次进入显示
    this.lastVisit = Date.now()
  },
  deactivated() {
    // 离开但保留状态
    this.pauseTimers()
  },
  mounted() {
    this.timer = setInterval(() => this.tick(), 1000)
  },
  beforeUnmount() {
    clearInterval(this.timer)
  },
  methods: {
    tick() { this.count++ },
    pauseTimers() {
      // 暂停但不清除
    }
  }
}
</script>
