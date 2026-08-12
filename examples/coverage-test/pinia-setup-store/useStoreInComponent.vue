<template>
  <div class="user-panel">
    <div v-if="userStore.isLoggedIn">
      欢迎, {{ userStore.username }} ({{ userStore.roles.join(', ') }})
      <button @click="handleLogout">退出</button>
    </div>
    <button v-else @click="handleLogin">登录</button>
    <p>管理员权限: {{ userStore.isAdmin ? '是' : '否' }}</p>
    <p>购物车: {{ cartStore.totalCount }} 件 / ¥{{ cartStore.totalPrice }}</p>
  </div>
</template>

<script>
import { useUserStore } from '@/store/user'
import { useCartStore } from '@/store/cart'
import { storeToRefs } from 'pinia'

export default {
  name: 'UserPanel',
  computed: {
    userStore() { return useUserStore() },
    cartStore() { return useCartStore() }
  },
  methods: {
    async handleLogin() { await this.userStore.login({ username: 'admin', password: '123' }) },
    handleLogout() { this.userStore.logout() }
  }
}
</script>
