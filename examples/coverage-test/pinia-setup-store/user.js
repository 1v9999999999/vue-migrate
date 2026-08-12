// iter-coverage: Pinia setup-style store - 基础 (ref + computed + actions)
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, getUserInfoApi } from '@/api/user'

export const useUserStore = defineStore('user', () => {
  // state (ref)
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(null)
  const roles = ref([])
  const permissions = ref([])

  // getters (computed)
  const isLoggedIn = computed(() => !!token.value)
  const username = computed(() => userInfo.value?.name || 'guest')
  const isAdmin = computed(() => roles.value.includes('admin'))
  const canEdit = computed(() => permissions.value.includes('edit'))

  // actions (function)
  async function login(credentials) {
    const res = await loginApi(credentials)
    token.value = res.token
    userInfo.value = res.user
    roles.value = res.user.roles
    localStorage.setItem('token', res.token)
    return res
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    roles.value = []
    permissions.value = []
    localStorage.removeItem('token')
  }

  async function fetchUserInfo() {
    const info = await getUserInfoApi()
    userInfo.value = info
    roles.value = info.roles
    permissions.value = info.permissions
  }

  return { token, userInfo, roles, permissions, isLoggedIn, username, isAdmin, canEdit, login, logout, fetchUserInfo }
})
