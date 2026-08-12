<template>
  <div>
    <p>count: {{ count }}</p>
    <button @click="count++">+1</button>
    <input v-model="name" />
  </div>
</template>

<script>
export default {
  name: 'RenderTracked',
  data() { return { count: 0, name: '' } },
  renderTracked({ key, target, type }) {
    console.log(`[tracked] key=${key}, type=${type}`)
  },
  renderTriggered({ key, target, type, newValue, oldValue }) {
    console.log(`[triggered] key=${key}, newVal=${newValue}, oldVal=${oldValue}`)
  }
}
</script>
