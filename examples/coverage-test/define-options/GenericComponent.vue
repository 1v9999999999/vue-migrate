<script setup lang="ts" generic="T extends string | number">
// Vue 3.3+ generic 组件
defineProps<{
  items: T[]
  selected: T
}>()

const emit = defineEmits<{
  select: [item: T]
}>()
</script>

<template>
  <ul>
    <li
      v-for="item in items"
      :key="item"
      :class="{ active: item === selected }"
      @click="emit('select', item)"
    >
      {{ item }}
    </li>
  </ul>
</template>
