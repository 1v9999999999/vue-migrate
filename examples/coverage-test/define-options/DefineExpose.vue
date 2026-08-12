<script setup>
import { ref } from 'vue'
const count = ref(0)
function increment() { count.value++ }
function reset() { count.value = 0 }

// 显式暴露给父组件 ref
defineExpose({ count, increment, reset })
</script>

<template>
  <div>{{ count }}</div>
</template>
