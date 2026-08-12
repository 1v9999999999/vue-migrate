<!--
  iter-122a: @Emit / @Watch / @Ref 装饰器 覆盖率测试
  覆盖 事件发射 / 侦听器 / 模板引用
-->
<template>
  <div class="emit-watch-decorator">
    <input ref="inputRef" v-model="name" @keyup.enter="handleSubmit" />
    <button @click="handleSubmit">submit</button>
    <button @click="reset">reset</button>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Emit, Watch, Ref } from 'vue-property-decorator'

@Component
export default class EmitWatchDecorator extends Vue {
  name = ''

  @Ref() readonly inputRef!: HTMLInputElement

  @Emit('submit')
  handleSubmit(): { name: string } {
    return { name: this.name }
  }

  @Emit()
  reset(): void {
    this.name = ''
  }

  @Watch('name')
  onNameChanged(newVal: string, oldVal: string): void {
    console.log('name changed:', newVal, oldVal)
  }

  @Watch('name', { immediate: true, deep: false })
  onNameImmediate(newVal: string): void {
    // immediate watcher
    console.log('immediate:', newVal)
  }

  mounted(): void {
    this.inputRef.focus()
  }
}
</script>

<style scoped>
.emit-watch-decorator {
  display: flex;
  gap: 8px;
}
</style>
