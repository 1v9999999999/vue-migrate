<script setup>
import { ref } from 'vue'
import init from './assembly/as_wasm.js'

let asInstance = null
const result = ref(null)

async function runSum() {
  if (!asInstance) {
    asInstance = await init()
  }
  const arr = new Int32Array([1, 2, 3, 4, 5])
  result.value = asInstance.exports.sum(arr)
}

async function runFib() {
  if (!asInstance) {
    asInstance = await init()
  }
  result.value = asInstance.exports.fib(20)
}
</script>

<template>
  <div>
    <button @click="runSum">Sum [1..5]</button>
    <button @click="runFib">Fib 20</button>
    <p v-if="result !== null">result: {{ result }}</p>
  </div>
</template>
