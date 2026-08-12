<!--
  iter-122a: vue-class-component @Component 基础 覆盖率测试
  覆盖 class 属性 = data, getter = computed, 方法 = methods
-->
<template>
  <div class="basic-decorator">
    <p>{{ computedMsg }}</p>
    <button @click="handleClick">{{ msg }}</button>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'

@Component
export default class BasicDecorator extends Vue {
  msg = 'hello'

  get computedMsg(): string {
    return this.msg.toUpperCase()
  }

  handleClick(): void {
    this.msg = 'clicked'
  }
}
</script>

<style scoped>
.basic-decorator {
  padding: 10px;
}
</style>
