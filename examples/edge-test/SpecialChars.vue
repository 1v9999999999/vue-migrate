<template>
  <div>test</div>
</template>

<script>
export default {
  // 嵌套 this.xxx in 字符串
  data() {
    return {
      name: 'vue',
      msg: `Hello ${this.name}`  // template literal
    }
  }
}
</script>
