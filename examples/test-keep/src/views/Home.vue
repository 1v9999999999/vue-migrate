<template>
  <div>
    <h1>{{ title }}</h1>
    <p>Vue2 component</p>
  </div>
</template>

<script>
export default {
  data() {
    return { title: 'Home' }
  },
  beforeDestroy() {
    console.log('about to destroy')
  }
}
</script>
