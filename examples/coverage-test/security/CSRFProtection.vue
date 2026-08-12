<script setup>
// csrf.js
import axios from 'axios'

// 1. 从 cookie 读 CSRF token (双 token 模式)
export function getCsrfToken() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

// 2. axios interceptor 自动加 header
axios.interceptors.request.use((config) => {
  if (['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase())) {
    config.headers['X-XSRF-TOKEN'] = getCsrfToken()
  }
  return config
})

// 3. sameSite cookie (现代防御)
document.cookie = 'sessionId=xxx; SameSite=Strict; Secure; HttpOnly'
</script>

<template>
  <div>
    <h3>CSRF Protection</h3>
    <p>CSRF token 已通过 axios interceptor 自动注入</p>
  </div>
</template>
