<script setup lang="ts">
// iter-coverage: defineModel + TS 类型 (Vue 3.4+)
interface Props {
  modelValue: string
  count?: number
}
const model = defineModel<string>()  // ModelRef<string>
const count = defineModel<number>('count', { default: 0 })  // ModelRef<number, number>
</script>

<template>
  <input v-model="model" />
  <input v-model.number="count" />
</template>
