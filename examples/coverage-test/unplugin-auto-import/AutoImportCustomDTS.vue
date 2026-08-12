// types/auto-imports.d.ts (手动维护)
declare global {
  const $api: typeof import('@/api').default
  const $utils: typeof import('@/utils').default
  const formatDate: (date: Date | string, format?: string) => string
}

<script setup lang="ts">
// 不需要 import, 直接用
const data = await $api.user.getProfile()
const formatted = formatDate(data.createdAt)
</script>
