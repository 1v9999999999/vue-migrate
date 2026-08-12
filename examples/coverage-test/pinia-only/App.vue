<template>
  <div>Pinia-only app</div>
</template>

<script setup>
import { useCounterStore } from './store/counter'
const counter = useCounterStore()
</script>
