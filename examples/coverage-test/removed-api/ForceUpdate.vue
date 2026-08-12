<template>
  <div class="force-update">
    <h3>ForceUpdate Demo</h3>
    <p>响应式时间: {{ reactiveTime }}</p>
    <p>非响应式时间: {{ nonReactiveTime }}</p>
    <p>watch 监听值: {{ deepObj.a.b.c }}</p>

    <button @click="updateReactive">更新响应式</button>
    <button @click="updateNonReactive">更新非响应式</button>
    <button @click="forceRender">this.$forceUpdate 重渲染</button>
  </div>
</template>

<script>
export default {
  name: 'ForceUpdate',
  data() {
    return {
      reactiveTime: 0,
      // 非响应式数据 —— 修改不会触发视图更新
      nonReactiveTime: 0,
      deepObj: {
        a: {
          b: {
            c: 0
          }
        }
      }
    }
  },
  created() {
    // this.$watch('deep.path', fn, { deep: true, immediate: true }) 动态 watch
    this.unwatch = this.$watch(
      'deepObj.a.b.c',
      (newVal, oldVal) => {
        console.log('deep watch:', oldVal, '->', newVal)
      },
      { deep: true, immediate: true }
    )
  },
  beforeDestroy() {
    // 手动停止动态 watch
    if (this.unwatch) {
      this.unwatch()
    }
  },
  methods: {
    updateReactive() {
      this.reactiveTime = Date.now()
    },
    // 修改非响应式数据 —— 视图不会自动更新
    updateNonReactive() {
      this.nonReactiveTime = Date.now()
      // this.$forceUpdate() 手动触发重渲染
      this.$forceUpdate()
    },
    forceRender() {
      // this.$forceUpdate() 配合非响应式数据
      this.nonReactiveTime = Date.now()
      this.$forceUpdate()
      // this.$nextTick(() => ...) 配合 forceUpdate
      this.$nextTick(() => {
        console.log('forceUpdate 渲染完成, 当前值:', this.nonReactiveTime)
      })
    }
  }
}
</script>

<style scoped>
.force-update {
  padding: 16px;
  border: 1px solid #eee;
}
.force-update button {
  margin-right: 8px;
}
</style>
