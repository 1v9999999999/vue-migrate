<!-- 无需 import, components/ElButton.vue 自动注册为 <ElButton> -->
<!-- 需 vite.config.js 配置 Components({ dirs: ['src/components'], dts: 'src/components.d.ts' }) -->
<template>
  <div>
    <ElButton type="primary" @click="onSubmit">提交</ElButton>
    <ElInput v-model="username" placeholder="用户名" />
    <ElTable :data="users">
      <ElTableColumn prop="name" label="姓名" />
    </ElTable>
  </div>
</template>

<script setup>
const username = ref('')
const users = ref([])

function onSubmit() {
  console.log('submit', username.value)
}
</script>
