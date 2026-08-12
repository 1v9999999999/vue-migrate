<script setup>
// Vue 3 顶层 await (只在 <Suspense> 包裹时有效)
const config = await fetch('/api/config').then(r => r.json())
const user = await getCurrentUser()

async function getCurrentUser() {
  const res = await fetch('/api/me')
  return res.json()
}
</script>

<template>
  <div>
    <h1>{{ config.title }}</h1>
    <p>Welcome, {{ user.name }}</p>
  </div>
</template>
