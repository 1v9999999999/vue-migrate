<template>
  <div class="children-listeners">
    <h3>$children / $listeners / $scopedSlots Demo</h3>

    <!-- this.$listeners 透传所有事件 -->
    <child-wrapper v-on="$listeners">
      <!-- scoped slot: 通过 this.$scopedSlots.default({ item }) 手动调用 -->
      <template #default="{ item }">
        <span>item: {{ item }}</span>
      </template>

      <!-- 具名 scoped slot: this.$scopedSlots.header() -->
      <template #header>
        <span>header content</span>
      </template>
    </child-wrapper>

    <button @click="resetChildren">遍历 $children 重置</button>
    <button @click="callFirstChild">调用 $children[0] 方法</button>
  </div>
</template>

<script>
const ChildWrapper = {
  name: 'ChildWrapper',
  render(h) {
    // this.$scopedSlots.default({ item }) scoped slot 手动调用
    const defaultSlot = this.$scopedSlots.default
      ? this.$scopedSlots.default({ item: 'demo-item' })
      : null

    // this.$scopedSlots.header() 具名 scoped slot
    const headerSlot = this.$scopedSlots.header
      ? this.$scopedSlots.header()
      : null

    return h('div', { class: 'child-wrapper' }, [
      h('div', { class: 'header' }, headerSlot),
      h('div', { class: 'body' }, defaultSlot)
    ])
  },
  methods: {
    // 供父组件通过 $children 直接调用
    someMethod() {
      return 'called from parent via $children'
    },
    resetSelf() {
      // 供父组件遍历 $children 调用
      this.$emit('reset')
    }
  }
}

export default {
  name: 'ChildrenAndListeners',
  components: {
    ChildWrapper
  },
  methods: {
    // this.$children.forEach(c => c.$emit('reset')) 遍历子组件
    resetChildren() {
      this.$children.forEach((child) => {
        child.$emit('reset')
        child.resetSelf && child.resetSelf()
      })
    },
    // this.$children[0].someMethod() 直接调用子组件方法
    callFirstChild() {
      if (this.$children[0] && this.$children[0].someMethod) {
        const result = this.$children[0].someMethod()
        console.log('first child method result:', result)
      }
    }
  }
}
</script>

<style scoped>
.children-listeners {
  padding: 16px;
  border: 1px solid #eee;
}
.children-listeners button {
  margin-right: 8px;
}
.child-wrapper {
  margin: 8px 0;
  padding: 8px;
  border: 1px dashed #ccc;
}
</style>
