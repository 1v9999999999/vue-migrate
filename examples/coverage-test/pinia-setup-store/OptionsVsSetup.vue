<template>
  <div>count: {{ store.count }}, double: {{ store.double }}</div>
  <button @click="store.increment()">+1</button>
</template>

<script>
// options style
import { defineStore } from 'pinia'
const useCounterOptions = defineStore('counter-opt', {
  state: () => ({ count: 0 }),
  getters: { double: (state) => state.count * 2 },
  actions: { increment() { this.count++ } }
})

// setup style (推荐)
const useCounterSetup = defineStore('counter-set', () => {
  const count = ref(0)
  const double = computed(() => count.value * 2)
  function increment() { count.value++ }
  return { count, double, increment }
})

export default {
  computed: {
    store() { return useCounterSetup() }  // 或 useCounterOptions()
  }
}
</script>
