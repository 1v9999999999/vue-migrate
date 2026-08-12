<script setup lang="ts">
// Vue 3.3+ 类型化 slots
const slots = defineSlots<{
  default(props: { item: { id: number; name: string } }): any
  header(): any
  footer(props: { count: number }): any
  'item-actions'(props: { item: any; index: number }): any
}>()
</script>

<template>
  <div class="card">
    <header v-if="slots.header"><slot name="header" /></header>
    <main>
      <slot :item="{ id: 1, name: 'item' }" />
    </main>
    <footer v-if="slots.footer">
      <slot name="footer" :count="42" />
    </footer>
  </div>
</template>
