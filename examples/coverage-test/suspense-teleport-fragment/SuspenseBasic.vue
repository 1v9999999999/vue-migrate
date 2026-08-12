<template>
  <Suspense>
    <template #default>
      <AsyncUserInfo :user-id="userId" />
    </template>
    <template #fallback>
      <div class="loading">加载用户信息中...</div>
    </template>
  </Suspense>
</template>

<script>
import { defineAsyncComponent } from 'vue'
const AsyncUserInfo = defineAsyncComponent(() => import('./AsyncUserInfo.vue'))

export default {
  components: { AsyncUserInfo },
  props: {
    userId: { type: Number, required: true }
  }
}
</script>
