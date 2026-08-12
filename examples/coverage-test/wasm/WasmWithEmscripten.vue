<script setup>
import { ref } from 'vue'
import { processImage } from './emscripten.js'

const resultUrl = ref(null)
const processing = ref(false)

async function process(file) {
  if (!file) return
  processing.value = true
  try {
    const buffer = await file.arrayBuffer()
    const result = await processImage(buffer, 800, 600)
    resultUrl.value = URL.createObjectURL(new Blob([result], { type: 'image/png' }))
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div>
    <input type="file" accept="image/*" @change="process($event.target.files[0])" />
    <p v-if="processing">处理中...</p>
    <img v-if="resultUrl" :src="resultUrl" alt="processed" />
  </div>
</template>
