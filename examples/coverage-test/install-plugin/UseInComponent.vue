<template>
  <div class="comp">
    <p>组件名: {{ $options.name }}</p>
    <p>父组件名: {{ parentName }}</p>
    <p>子组件数: {{ childrenCount }}</p>
    <button @click="logInfo">打印信息</button>
    <Child ref="childRef" />
  </div>
</template>

<script>
import Vue from 'vue'

export default {
  name: 'MyComp',
  components: { Child: () => import('./Child.vue') },
  data() { return { childrenCount: 0 } },
  computed: {
    parentName() { return this.$parent?.$options.name || 'root' },
    rootName() { return this.$root.$options.name || 'App' }
  },
  methods: {
    logInfo() {
      console.log('name:', this.$options.name)
      console.log('propsData:', this.$options.propsData)
      console.log('parent:', this.$parent)
      console.log('root:', this.$root)
      console.log('children:', this.$children.length)
    },
    callChildMethod() {
      // 直接调用子组件方法 (Vue 3 推荐用 template ref)
      this.$children[0].someMethod()
    }
  },
  mounted() {
    this.childrenCount = this.$children.length
  }
}
</script>
