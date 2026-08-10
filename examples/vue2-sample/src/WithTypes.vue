<template>
  <div>
    <h1>{{ title }}</h1>
    <p>Count: {{ count }}</p>
    <p>Items: {{ list.length }}</p>
    <button @click="inc">+1</button>
    <button @click="refreshList">reload</button>
  </div>
</template>

<script lang="ts">
export default {
  name: 'WithTypes',
  data() {
    return {
      count: 0,
      title: 'hello',
      active: true,
      maybe: null as number | null,
      // inline object
      profile: { name: 'guest', age: 18 } as { name: string; age: number },
      // typed array via `as`
      list: [] as number[],
    }
  },
  props: {
    // form A: bare type identifier
    name: String,
    // form B: [String, Number]
    value: [String, Number],
    // form C: full object with default
    age: { type: Number, default: 0 },
    // form C: with required
    userId: { type: String, required: true },
    // form C: with object default
    options: { type: Object, default: () => ({ debug: false }) },
  },
  methods: {
    inc() {
      this.count++
    },
    refreshList() {
      this.list = [1, 2, 3]
    },
  },
  mounted() {
    // ↓ this.$refs / $store / $route — should be marked TODO
    const _r = this.$refs.foo
    const _s = this.$store.state.user.name
    const _route = this.$route.params.id
  },
}
</script>
