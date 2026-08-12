<script setup>
import { useI18n } from 'vue-i18n'
const { n, d, t } = useI18n()

const price = 1234.56
const ratio = 0.123
const bigNumber = 1234567
const date = new Date()
</script>

<template>
  <div>
    <p>价格: {{ n(price, 'currency', { currency: 'CNY' }) }}</p>
    <p>价格 USD: {{ n(price, 'currency', { currency: 'USD' }) }}</p>
    <p>百分比: {{ n(ratio, 'percent') }}</p>
    <p>大数字: {{ n(bigNumber, 'decimal', { useGrouping: true }) }}</p>
    <p>日期: {{ d(date, 'short') }}</p>
    <p>长日期: {{ d(date, 'long') }}</p>
    <p>日期时间: {{ d(date, 'datetime', { hour12: false }) }}</p>
  </div>
</template>
