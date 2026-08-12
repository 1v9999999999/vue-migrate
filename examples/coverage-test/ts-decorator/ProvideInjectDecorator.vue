<!--
  iter-122a: @Provide / @Inject / @ProvideReactive / @InjectReactive 覆盖率测试
  覆盖 依赖注入 装饰器
-->
<template>
  <div class="provide-inject-decorator">
    <p>theme: {{ theme }}</p>
    <p>rootData: {{ rootData }}</p>
    <p>globalTheme: {{ globalTheme }}</p>
    <p>apiBase: {{ apiBase }}</p>
    <p>reactiveCount: {{ reactiveCount }}</p>
    <p>sharedState: {{ sharedState }}</p>
    <button @click="increment">+1</button>
  </div>
</template>

<script lang="ts">
import {
  Component,
  Vue,
  Provide,
  Inject,
  ProvideReactive,
  InjectReactive
} from 'vue-property-decorator'

@Component
export default class ProvideInjectDecorator extends Vue {
  @Provide() theme = 'dark'
  @Provide('rootKey') rootData = { a: 1 }

  @Inject() readonly globalTheme!: string
  @Inject('apiBase') readonly apiBase!: string
  @Inject({ from: 'optionalKey', default: 'fallback' }) readonly optional!: string

  @ProvideReactive() reactiveCount = 0
  @InjectReactive() readonly sharedState!: any
  @InjectReactive('customShared') readonly customShared!: any

  get displayCount(): string {
    return String(this.reactiveCount)
  }

  increment(): void {
    this.reactiveCount++
    this.rootData.a++
  }
}
</script>

<style scoped>
.provide-inject-decorator {
  border: 1px dashed #999;
}
</style>
