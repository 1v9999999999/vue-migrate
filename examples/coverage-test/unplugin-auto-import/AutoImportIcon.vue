<template>
  <div>
    <i-ep-edit @click="edit" />
    <i-ep-delete @click="del" />
    <i-mdi-account-circle />
    <i-carbon-logo-vue />
    <!-- 自动从 @iconify-json/ep / @iconify-json/mdi / @iconify-json/carbon 加载 -->
  </div>
</template>

<script setup>
import { ref } from 'vue'
const editing = ref(false)
function edit() { editing.value = true }
function del() { console.log('del') }
</script>
