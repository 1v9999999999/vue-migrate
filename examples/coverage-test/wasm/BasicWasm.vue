<script setup>
import { ref, onMounted } from 'vue'
import { ensureInit, add, fibonacci } from './math.js'

const result = ref(null)
const loading = ref(false)

async function calculate() {
  loading.value = true
  await ensureInit()
  result.value = add(40, 2)
  loading.value = false
}

async function fibCalc() {
  loading.value = true
  await ensureInit()
  result.value = fibonacci(40)
  loading.value = false
}
</script>

<template>
  <div>
    <button @click="calculate" :disabled="loading">Add 40+2</button>
    <button @click="fibCalc" :disabled="loading">Fib 40</button>
    <p v-if="loading">计算中...</p>
    <p v-if="result !== null">结果: {{ result }}</p>
  </div>
</template>
