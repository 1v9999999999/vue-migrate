<template>
  <div class="user-info">
    <h2>{{ user.name }}</h2>
    <p>Email: {{ user.email }}</p>
    <p>Role: {{ user.role }}</p>
  </div>
</template>

<script>
// Vue 3 async setup (顶层 await) — 只有在 <Suspense> 里才被等待
const fetchUser = async (id) => {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}

export default {
  async setup(props) {
    const user = await fetchUser(props.userId)
    return { user }
  }
}
</script>
