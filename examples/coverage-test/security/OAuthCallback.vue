<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const { code, state, error } = route.query

  if (error) {
    console.error('OAuth error:', error)
    return router.push('/login?error=' + error)
  }

  // 1. 验证 state 防止 CSRF
  const savedState = sessionStorage.getItem('oauth-state')
  if (state !== savedState) {
    return router.push('/login?error=state_mismatch')
  }

  // 2. 用 code 换 token (PKCE 模式)
  const codeVerifier = sessionStorage.getItem('oauth-code-verifier')
  try {
    const res = await fetch('/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, code_verifier: codeVerifier })
    })
    const { access_token, refresh_token } = await res.json()
    localStorage.setItem('token', access_token)
    localStorage.setItem('refresh_token', refresh_token)
    router.push('/dashboard')
  } catch (e) {
    router.push('/login?error=token_exchange_failed')
  }
})
</script>

<template>
  <div>
    <h3>OAuth 回调处理中...</h3>
  </div>
</template>
