<template>
  <div>
    <button @click="goBasic">基础</button>
    <button @click="goWithQuery">带 query</button>
    <button @click="goWithHash">带 hash</button>
    <button @click="goReplace">replace</button>
    <button @click="goBack">back</button>
    <button @click="goForward">forward</button>
    <button @click="goWithPromise">promise</button>
  </div>
</template>

<script>
export default {
  methods: {
    goBasic() { this.$router.push('/user/123') },
    goWithQuery() { this.$router.push({ path: '/search', query: { q: 'vue3', page: 1 } }) },
    goWithHash() { this.$router.push({ path: '/docs', hash: '#installation' }) },
    goReplace() { this.$router.replace('/login') },
    goBack() { this.$router.back() },
    goForward() { this.$router.forward() },
    goWithPromise() {
      this.$router.push('/user/123').then(() => {
        console.log('navigated')
      }).catch(err => {
        // Vue 2: 重复 push 也 resolve
        // Vue 3: 重复 push 抛 NavigationFailure
        if (err.name !== 'NavigationDuplicated') throw err
      })
    }
  }
}
</script>
