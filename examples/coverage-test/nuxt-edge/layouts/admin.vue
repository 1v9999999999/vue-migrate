<template>
  <div class="admin-layout">
    <aside>
      <nav>
        <NuxtLink to="/admin/users">Users</NuxtLink>
        <NuxtLink to="/admin/settings">Settings</NuxtLink>
      </nav>
    </aside>
    <section>
      <slot />
    </section>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'admin',
  middleware: ['auth-admin']
})
</script>
