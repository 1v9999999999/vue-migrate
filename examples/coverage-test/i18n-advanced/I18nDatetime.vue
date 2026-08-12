<script setup>
import { useI18n } from 'vue-i18n'
const { d, t } = useI18n()

const now = new Date()
const birthday = new Date(1990, 5, 15)
const future = new Date(Date.now() + 86400000 * 7)  // 7 天后
</script>

<template>
  <div>
    <p>短: {{ d(now, 'short') }}</p>
    <p>长: {{ d(now, 'long') }}</p>
    <p>完整: {{ d(now, 'full') }}</p>
    <p>日期: {{ d(birthday, 'short') }}</p>
    <p>时间: {{ d(now, 'time') }}</p>
    <p>自定义: {{ d(now, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</p>
    <p>相对 (7d 后): {{ d(future, 'long') }}</p>
  </div>
</template>
