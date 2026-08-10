<template>
  <div>
    <p>Price: {{ price | formatPrice | addDollar }}</p>
    <p>Truncated: {{ message | truncate(20) | uppercase }}</p>
    <p>Date: {{ now | formatDate('YYYY-MM-DD') }}</p>
    <p>No filter: {{ plain }}</p>
  </div>
</template>

<script>
export default {
  name: 'WithFilters',
  data() {
    return {
      price: 99.5,
      message: 'Hello world, this is a long text',
      now: new Date(),
      plain: 'no pipe here'
    }
  },
  filters: {
    formatPrice(v) {
      return v.toFixed(2)
    },
    addDollar(v) {
      return '$' + v
    },
    truncate(v, n) {
      return v.length > n ? v.slice(0, n) + '...' : v
    },
    uppercase(v) {
      return v.toUpperCase()
    },
    formatDate(v, fmt) {
      return v.toISOString().slice(0, 10)
    }
  }
}
</script>
