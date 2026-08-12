<script setup lang="ts">
// Vue 3.3+ defineSlots 类型化 slots
interface User {
  id: number
  name: string
  avatar?: string
}

defineProps<{
  user: User
}>()

// 类型化 slots, IDE 会有补全
const slots = defineSlots<{
  // 具名 slot with props
  avatar(props: { user: User; size: 'sm' | 'md' | 'lg' }): any
  // 默认 slot
  default(props: { user: User; formattedName: string }): any
  // 具名 without props
  actions(): any
  // 动态 key
  [key: `item-${string}`]: (props: { id: number }) => any
}>()
</script>

<template>
  <div class="user-card">
    <div class="user-avatar">
      <slot name="avatar" :user="user" :size="'md'">
        <img :src="user.avatar || '/default-avatar.png'" />
      </slot>
    </div>
    <div class="user-info">
      <slot :user="user" :formattedName="user.name.toUpperCase()">
        <h3>{{ user.name }}</h3>
      </slot>
    </div>
    <div class="user-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
