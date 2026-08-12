<template>
  <div class="event-bus">
    <h3>EventBus Demo</h3>
    <p>当前计数: {{ count }}</p>
    <p>就绪状态: {{ ready ? '已就绪' : '未就绪' }}</p>
    <button @click="increment">本地 +1</button>
    <button @click="broadcast">全局广播 refresh</button>
    <button @click="externalEmit">通过外部 $bus 触发 refresh</button>
  </div>
</template>

<script>
import Vue from 'vue'

// 全局 EventBus: const bus = new Vue(); bus.$emit(...)
const bus = new Vue()

// 外部事件总线引用(挂在 window 或模块上的单例)
const externalBus = new Vue()

export default {
  name: 'EventBus',
  data() {
    return {
      count: 0,
      ready: false
    }
  },
  created() {
    // 组件内 this.$on('event', this.handler)
    this.$on('event', this.handler)

    // this.$once('ready', fn) —— 只触发一次
    this.$once('ready', () => {
      this.ready = true
    })
  },
  mounted() {
    // mounted 注册 + beforeDestroy 注销模式
    bus.$on('refresh', this.onRefresh)
    bus.$on('reset', this.onReset)

    // 通过外部 $bus 引用监听
    this.$bus = externalBus
    externalBus.$on('refresh', this.onExternalRefresh)

    // 触发一次 ready
    this.$emit('ready')
  },
  beforeDestroy() {
    // this.$off('event') 移除指定事件
    this.$off('event', this.handler)

    // this.$off('refresh') 移除单个事件的所有回调
    bus.$off('refresh', this.onRefresh)

    // this.$off() 全部移除 —— 不传参数移除所有事件监听器
    this.$off()

    // 外部总线注销
    externalBus.$off('refresh', this.onExternalRefresh)
  },
  destroyed() {
    // destroyed 钩子里再次清理(覆盖另一种常见写法)
    bus.$off()
  },
  methods: {
    handler(payload) {
      this.count += payload || 1
    },
    onRefresh() {
      this.count = 0
    },
    onReset() {
      this.count = 0
      this.ready = false
    },
    onExternalRefresh() {
      // this.$bus.$emit('refresh') 外部事件总线引用触发
      this.$bus.$emit('refresh')
    },
    increment() {
      this.$emit('event', 1)
    },
    broadcast() {
      // 全局 EventBus: bus.$emit(...)
      bus.$emit('refresh')
    },
    externalEmit() {
      // this.$bus.$emit('refresh')
      this.$bus.$emit('refresh')
    }
  }
}
</script>

<style scoped>
.event-bus {
  padding: 16px;
  border: 1px solid #eee;
}
.event-bus button {
  margin-right: 8px;
}
</style>
