<script setup>
import { ref } from 'vue'
import { loadWasmStreaming } from './streaming.js'

const result = ref(null)
const loading = ref(false)
const wasmUrl = '/calc.wasm'

async function loadAndRun() {
  loading.value = true
  try {
    const instance = await loadWasmStreaming(wasmUrl)
    if (instance.exports.add) {
      result.value = instance.exports.add(20, 22)
    } else if (instance.exports.fibonacci) {
      result.value = instance.exports.fibonacci(20)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <button @click="loadAndRun" :disabled="loading">Load WASM (streaming)</button>
    <p v-if="loading">加载并编译中...</p>
    <p v-if="result !== null">结果: {{ result }}</p>
  </div>
</template>
