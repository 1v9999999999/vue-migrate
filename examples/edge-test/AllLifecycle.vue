<template>
  <div>{{ msg }}</div>
</template>

<script>
export default {
  data() {
    return { msg: 'hello' }
  },
  beforeCreate() { console.log('beforeCreate') },
  created() { console.log('created') },
  beforeMount() { console.log('beforeMount') },
  mounted() { console.log('mounted') },
  beforeUpdate() { console.log('beforeUpdate') },
  updated() { console.log('updated') },
  activated() { console.log('activated') },
  deactivated() { console.log('deactivated') },
  beforeDestroy() { console.log('beforeDestroy') },
  destroyed() { console.log('destroyed') },
  errorCaptured(err) { console.error(err) }
}
</script>
