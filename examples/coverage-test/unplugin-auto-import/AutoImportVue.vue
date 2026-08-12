<script setup>
// Vue 3 API (ref, computed, watch 等) 自动导入, 无需 import
// 需 vite.config.js 配置:
//   AutoImport({ imports: ['vue', 'vue-router', 'pinia'] })

const count = ref(0)  // 自动从 vue 导入
const double = computed(() => count.value * 2)
watch(count, (newVal) => console.log('changed:', newVal))

const router = useRouter()  // 自动从 vue-router 导入
const route = useRoute()
const userStore = useUserStore()  // 自动从 pinia 导入 (store 自动注册)

function handleClick() {
  count.value++
  router.push('/about')
}
</script>

<template>
  <div>
    <p>count: {{ count }}, double: {{ double }}</p>
    <p>current route: {{ route.path }}</p>
    <button @click="handleClick">click</button>
  </div>
</template>
