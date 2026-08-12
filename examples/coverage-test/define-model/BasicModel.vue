<script setup>
// iter-coverage: defineModel 基础 (Vue 3.4+ 新 API)
const model = defineModel()  // 等价于 props: { modelValue }, emits: ['update:modelValue']
const title = defineModel('title', { default: '' })  // 具名 v-model:title
const count = defineModel('count', { type: Number, default: 0 })
</script>

<template>
  <input v-model="model" />
  <input v-model="title" />
  <input v-model.number="count" />
</template>
