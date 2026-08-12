// locales/en.json
{
  "cart": "Cart",
  "items": "no items | one item | {count} items",
  "apples": "{count} apple | {count} apples"
}

// locales/zh.json
{
  "cart": "购物车",
  "items": "购物车为空 | {count} 件商品"
}

<script setup>
import { useI18n } from 'vue-i18n'
const { t, tc } = useI18n()
const count = ref(5)
</script>

<template>
  <div>
    <p>{{ t('cart') }}</p>
    <p>{{ t('items', count) }}</p>
    <p>{{ t('apples', count, { count }) }}</p>
    <!-- tc 复数化 (legacy API) -->
    <p>{{ tc('items', 0) }}</p>
    <p>{{ tc('items', 1) }}</p>
    <p>{{ tc('items', 10) }}</p>
  </div>
</template>
