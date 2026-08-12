<template>
  <div class="layout">
    <header>
      <slot name="header">
        <NuxtLink to="/">Home</NuxtLink>
      </slot>
    </header>
    <main>
      <slot />
    </main>
    <footer>
      <slot name="footer">
        <p>&copy; 2024 My App</p>
      </slot>
    </footer>
  </div>
</template>

<script setup>
// Nuxt 3 layout 组件
const route = useRoute()
const config = useRuntimeConfig()
</script>
