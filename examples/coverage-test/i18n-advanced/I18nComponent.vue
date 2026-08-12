<template>
  <div>
    <!-- 基础 -->
    <i18n-t keypath="disclaimer" />

    <!-- 嵌入 HTML -->
    <i18n-t keypath="terms">
      <template #link>
        <a href="/terms">服务条款</a>
      </template>
    </i18n-t>

    <!-- 复数 -->
    <i18n-t keypath="items" :plural="count">
      <template #count>
        <strong>{{ count }}</strong>
      </template>
    </i18n-t>

    <!-- 多参数 -->
    <i18n-t keypath="welcome" tag="p" class="welcome">
      <template #user>
        <span class="username">{{ user }}</span>
      </template>
    </i18n-t>
  </div>
</template>

<script setup>
const count = ref(3)
const user = 'admin'
</script>
