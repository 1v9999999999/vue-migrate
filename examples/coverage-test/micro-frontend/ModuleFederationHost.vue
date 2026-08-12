<!-- host 引用 remote 组件 -->
<script setup>
// 动态 import remote 组件
const RemoteButton = defineAsyncComponent(() => import('remote_app/Button'))
const RemoteHeader = defineAsyncComponent(() => import('remote_app/Header'))
</script>

<template>
  <RemoteHeader />
  <RemoteButton @click="onClick" />
</template>
