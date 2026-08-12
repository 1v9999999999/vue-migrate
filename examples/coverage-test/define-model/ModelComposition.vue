<script setup>
// iter-coverage: defineModel + computed / watch / 其他 composition API 混合
import { computed, watch } from 'vue'

const count = defineModel('count', { type: Number, default: 0 })
const max = defineModel('max', { type: Number, default: 100 })

const percent = computed(() => Math.min(100, (count.value / max.value) * 100))
const isFull = computed(() => count.value >= max.value)

// watch 联动
watch(count, (newVal, oldVal) => {
  if (newVal > max.value) count.value = max.value
})

function inc() { if (!isFull.value) count.value++ }
function dec() { if (count.value > 0) count.value-- }
</script>

<template>
  <div class="counter">
    <button @click="dec" :disabled="count === 0">-</button>
    <span>{{ count }} / {{ max }}</span>
    <button @click="inc" :disabled="isFull">+</button>
    <div class="bar" :style="{ width: percent + '%' }"></div>
  </div>
</template>
