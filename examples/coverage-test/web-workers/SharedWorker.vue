<template>
  <div>
    <p>SharedWorker 已挂载,跨 tab 广播消息</p>
    <ul>
      <li v-for="(msg, idx) in messages" :key="idx">{{ msg }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const port = ref(null)
const messages = ref([])

onMounted(() => {
  const worker = new SharedWorker(new URL('./shared-worker.js', import.meta.url), { type: 'module' })
  port.value = worker.port
  port.value.onmessage = (e) => {
    console.log('shared worker msg:', e.data)
    messages.value.push(JSON.stringify(e.data))
  }
  port.value.start()
})
</script>
