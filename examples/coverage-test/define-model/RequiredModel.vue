<script setup>
// iter-coverage: defineModel required + validator (Vue 3.4+)
const password = defineModel('password', {
  type: String,
  required: true,
  validator: (v) => v.length >= 6
})

const email = defineModel('email', {
  type: String,
  required: true,
  validator: (v) => /.+@.+\..+/.test(v)
})
</script>

<template>
  <form>
    <input v-model="password" type="password" required minlength="6" />
    <input v-model="email" type="email" required />
  </form>
</template>
