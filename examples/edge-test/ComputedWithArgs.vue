<template>
  <div>{{ fullName }}</div>
</template>

<script>
export default {
  data() {
    return { firstName: 'foo', lastName: 'bar' }
  },
  computed: {
    fullName: {
      get() { return this.firstName + ' ' + this.lastName },
      set(value) { const parts = value.split(' '); this.firstName = parts[0]; this.lastName = parts[1] }
    }
  }
}
</script>
