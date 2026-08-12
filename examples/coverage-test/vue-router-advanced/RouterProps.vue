<!-- 路由定义 -->
<template>
  <!-- 路由配置: props: true 动态解耦 -->
  <!-- { path: '/user/:id', component: UserDetail, props: true } -->
</template>

<script>
// 子组件直接通过 props 接收, 不用 this.$route.params.id
export default {
  name: 'UserDetail',
  props: {
    id: { type: [String, Number], required: true }
  },
  watch: {
    id(newId) { this.fetchUser(newId) }
  },
  methods: {
    async fetchUser(id) {
      const user = await api.getUser(id)
      this.user = user
    }
  }
}
</script>
