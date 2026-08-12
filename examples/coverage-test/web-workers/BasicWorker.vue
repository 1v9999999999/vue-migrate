<template>
  <div>
    <button @click="computeHeavy" :disabled="computing">计算</button>
    <p v-if="computing">计算中...</p>
    <p v-if="result">结果: {{ result }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import * as Comlink from 'comlink'

const computing = ref(false)
const result = ref(null)

// 创建 worker
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
const api = Comlink.wrap(worker)

async function computeHeavy() {
  computing.value = true
  try {
    // 调用 worker 里的方法
    result.value = await api.fibonacci(40)
  } finally {
    computing.value = false
  }
}

onUnmounted(() => worker.terminate())
</script>
