<!--
  父组件:
  <MyInput v-model.uppercase="text" />
  <MyInput v-model.capitalize.number="age" />
-->

<script setup>
// iter-coverage: v-model 修饰符 + 自定义 modifier 处理 (Vue 3)
const [model, modifiers] = defineModel({
  set(value) {
    if (modifiers.uppercase) return value.toUpperCase()
    if (modifiers.capitalize) return value.charAt(0).toUpperCase() + value.slice(1)
    if (modifiers.number) return Number(value)
    return value
  }
})
</script>

<template>
  <input v-model="model" />
</template>
