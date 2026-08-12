<script setup>
import { useTemplateRef, onMounted, ref } from 'vue'

// Vue 3.5+ useTemplateRef (推荐)
const inputRef = useTemplateRef('inputEl')

// 普通字符串 ref (Vue 2 风格)
const oldInputRef = ref(null)

// 函数 ref (复杂场景)
const divRef = (el) => {
  console.log('div mounted:', el)
}

onMounted(() => {
  inputRef.value?.focus()
  oldInputRef.value?.focus()
})
</script>

<template>
  <input ref="inputEl" />
  <input ref="oldInputRef" />
  <div :ref="divRef">函数 ref</div>
</template>
