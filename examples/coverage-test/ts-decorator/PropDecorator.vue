<!--
  iter-122a: @Prop / @PropSync / @Model 装饰器 覆盖率测试
  覆盖 vue-property-decorator 的属性声明装饰器
-->
<template>
  <div class="prop-decorator">
    <h1>{{ title }}</h1>
    <span>{{ count }}</span>
    <ul>
      <li v-for="(item, i) in items" :key="i">{{ item }}</li>
    </ul>
    <input
      :value="value"
      @input="$emit('change', $event.target.value)"
    />
    <button @click="showVisible = !showVisible">
      {{ showVisible ? 'hide' : 'show' }}
    </button>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop, PropSync, Model } from 'vue-property-decorator'

@Component
export default class PropDecorator extends Vue {
  @Prop({ type: String, default: '' }) readonly title!: string
  @Prop({ type: Number, required: true }) readonly count!: number
  @Prop(Array) readonly items!: any[]
  @PropSync('visible', { type: Boolean }) showVisible!: boolean
  @Model('change', { type: String }) readonly value!: string

  get fullTitle(): string {
    return `${this.title} (${this.count})`
  }

  onClick(): void {
    this.$emit('change', 'new-value')
  }
}
</script>

<style scoped>
.prop-decorator {
  border: 1px solid #ddd;
}
</style>
