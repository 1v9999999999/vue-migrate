<script setup>
import { useI18n } from 'vue-i18n'
// scope 限定到 user.* 命名空间
const { t } = useI18n({ useScope: 'local', messages: { hi: '你好' } })
</script>

<template>
  <p>{{ t('hi') }}</p>
  <p>{{ $t('global.message') }}</p>
  <!-- t 局部 + $t 全局 -->
</template>
