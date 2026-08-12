<template>
  <div class="parent-child">
    <h1>{{ $options.name }}</h1>
    <p>父组件: {{ parentName }}</p>
    <p>根组件: {{ rootName }}</p>
    <p>子组件数: {{ childrenCount }}</p>

    <button @click="logAll">打印所有</button>
    <button @click="callChildDirectly">直接调用第一个子组件方法</button>
    <button @click="broadcastToChildren">广播事件到所有子组件</button>

    <ChildA ref="childA" />
    <ChildB ref="childB" />
    <ChildC />
  </div>
</template>

<script>
import ChildA from './ChildA.vue'
import ChildB from './ChildB.vue'
import ChildC from './ChildC.vue'

export default {
  name: 'ParentChild',
  components: { ChildA, ChildB, ChildC },

  data() {
    return {
      childrenCount: 0
    }
  },

  computed: {
    // 1. 访问父组件名
    parentName() {
      return this.$parent?.$options?.name || '(no parent / root)'
    },
    // 2. 访问根组件
    rootName() {
      return this.$root?.$options?.name || 'unknown'
    },
    // 3. 兄弟组件 (从父级 $children 找)
    siblings() {
      return this.$parent?.$children?.filter(c => c !== this) || []
    }
  },

  mounted() {
    this.childrenCount = this.$children.length
  },

  methods: {
    logAll() {
      console.log('--- Parent Debug ---')
      console.log('name:', this.$options.name)
      console.log('parent:', this.$parent)
      console.log('root:', this.$root)
      console.log('children:', this.$children)
      console.log('refs:', Object.keys(this.$refs))
      console.log('listeners:', Object.keys(this.$listeners))
      console.log('attrs:', this.$attrs)
      console.log('scopedSlots:', Object.keys(this.$scopedSlots))
    },
    // 4. 直接调用子组件方法 (Vue 2 风格, Vue 3 推荐 template ref)
    callChildDirectly() {
      this.$children[0].someMethod?.()
      // 推荐写法
      this.$refs.childA.someMethod?.()
    },
    // 5. 给所有子组件广播事件
    broadcastToChildren() {
      this.$children.forEach((child, i) => {
        child.$emit('parent-broadcast', { from: 'Parent', index: i })
      })
    },
    // 6. 跨级访问 (通过 $parent 链)
    findGrandParent() {
      return this.$parent?.$parent?.$options.name
    }
  }
}
</script>

<style scoped>
.parent-child {
  border: 2px solid #1890ff;
  padding: 20px;
  margin: 10px;
}
button {
  margin: 4px;
  padding: 6px 12px;
  cursor: pointer;
}
</style>
