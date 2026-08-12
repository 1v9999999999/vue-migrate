<template>
  <div class="child-a">
    <h3>ChildA</h3>
    <p>parent name: {{ parentName }}</p>
    <p>root data: {{ rootData }}</p>
    <button @click="callParent">调用父组件方法</button>
  </div>
</template>

<script>
export default {
  name: 'ChildA',
  data() { return { count: 0 } },
  computed: {
    parentName() {
      return this.$parent?.$options?.name || 'no parent'
    },
    rootData() {
      return this.$root?.$rootData || 'no root data'
    }
  },
  mounted() {
    this.$on('parent-broadcast', this.onParentBroadcast)
  },
  beforeUnmount() {
    this.$off('parent-broadcast', this.onParentBroadcast)
  },
  methods: {
    someMethod() {
      console.log('ChildA.someMethod called')
      this.count++
    },
    onParentBroadcast(payload) {
      console.log('ChildA received:', payload)
    },
    callParent() {
      // 调用父组件方法
      this.$parent.someMethod?.()
      this.$parent.$emit('child-call', { from: 'ChildA' })
    }
  }
}
</script>
