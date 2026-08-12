<script setup>
// === script setup 基础 ===
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  msg: { type: String, required: true },
  count: { type: Number, default: 0 },
  items: { type: Array, default: () => [] }
})

const emit = defineEmits(['change', 'submit', 'cancel'])

// === 顶层 await (只在 <Suspense> 内有效) ===
// 真实场景: 从 API 拉取初始数据
const { data: config } = await fetch('/api/config').then(r => r.json())
const { data: user } = await fetch('/api/me').then(r => r.json())

// === 顶层 binding 自动暴露给 template ===
const localCount = ref(props.count)
const doubled = computed(() => localCount.value * 2)
const isEven = computed(() => localCount.value % 2 === 0)

watch(() => props.count, (newVal) => {
  localCount.value = newVal
})

onMounted(() => {
  console.log('mounted with config:', config)
})

function handleClick() {
  localCount.value++
  emit('change', localCount.value)
}
</script>

<template>
  <div class="script-setup-basic">
    <h2>{{ config.title }}</h2>
    <p>Welcome, {{ user.name }}</p>
    <p>msg: {{ msg }}</p>
    <p>count: {{ localCount }}, doubled: {{ doubled }}, isEven: {{ isEven }}</p>
    <button @click="handleClick">+1</button>
    <ul>
      <li v-for="item in items" :key="item.id">{{ item }}</li>
    </ul>
  </div>
</template>
