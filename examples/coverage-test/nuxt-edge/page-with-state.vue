<template>
  <div>
    <h1>{{ data?.title }}</h1>
    <div v-for="item in data?.items" :key="item.id">
      {{ item.name }}
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  title: 'Users',
  // Nuxt 3 page 配置
})

// useAsyncData 替代 asyncData
const { data, pending, error, refresh } = await useAsyncData('users', () => $fetch('/api/users'))

// useState 跨组件共享 (替代 Vuex)
const sharedState = useState('app-state', () => ({ count: 0 }))

// useFetch 自动 refresh
const { data: config } = await useFetch('/api/config')

// 客户端 hydrate 后才能用
onMounted(() => {
  sharedState.value.count++
})
</script>
