<script setup>
import { ref } from 'vue'

const canvasRef = ref(null)
const rendering = ref(false)

async function renderOffscreen() {
  rendering.value = true
  const canvas = canvasRef.value
  if (!canvas) {
    rendering.value = false
    return
  }
  const offscreen = canvas.transferControlToOffscreen()
  const worker = new Worker(new URL('./canvas-worker.js', import.meta.url), { type: 'module' })
  worker.postMessage({ canvas: offscreen, width: canvas.width, height: canvas.height }, [offscreen])
  await new Promise(r => setTimeout(r, 2000))
  worker.terminate()
  rendering.value = false
}
</script>

<template>
  <div>
    <canvas ref="canvasRef" width="400" height="300" />
    <button @click="renderOffscreen" :disabled="rendering">render</button>
    <p v-if="rendering">渲染中...</p>
  </div>
</template>
