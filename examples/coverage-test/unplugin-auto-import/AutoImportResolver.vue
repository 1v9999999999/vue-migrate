<template>
  <div>
    <Button>点击</Button>
    <InputNumber v-model="count" :min="0" />
    <Table :data="data" :columns="cols" />
  </div>
</template>

<script setup>
const count = ref(0)
const data = ref([])
const cols = [
  { title: '名称', key: 'name' },
  { title: '年龄', key: 'age' }
]
</script>

<!-- 配套 vite.config.js: -->
<!-- import Components from 'unplugin-vue-components/vite' -->
<!-- import { AntDesignVueResolver, ElementPlusResolver } from 'unplugin-vue-components/resolvers' -->
<!-- Components({ -->
<!--   resolvers: [AntDesignVueResolver(), ElementPlusResolver()] -->
<!-- }) -->
