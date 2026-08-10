<template>
  <div id="app">
    <h1>{{ title }}</h1>
    <p>计数: {{ count }}</p>
    <button @click="increment">+1</button>
    <hello-world :name="title" />
  </div>
</template>

<script>
import HelloWorld from './components/HelloWorld.vue'

export default {
  name: 'App',
  components: { HelloWorld },
  data() {
    return {
      title: 'Vue2 App',
      count: 0
    }
  },
  methods: {
    increment() {
      this.count++
    }
  },
  mounted() {
    console.log('mounted')
  },
  beforeDestroy() {
    console.log('about to destroy')
  }
}
</script>
