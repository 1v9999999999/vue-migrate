<template>
  <div>
    <button @click="runCompute" :disabled="loading">运行 Worker 计算</button>
    <p v-if="loading">计算中...</p>
    <p v-if="result !== null">结果: {{ result }}</p>
    <p v-if="error" class="error">错误: {{ String(error) }}</p>
  </div>
</template>

<script setup>
import { useWorker } from './useWorker'

// 通过 composable 封装 worker 调用
const fibFactory = () => import('./worker.js')
const { result, error, loading, run } = useWorker(fibFactory)

async function runCompute() {
  await run('fibonacci', 35)
}
</script>
