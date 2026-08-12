<template>
  <div class="ref-deep">
    <!-- 1. 字符串 ref (Vue 2 风格, Vue 3 仍支持但推荐 useTemplateRef) -->
    <input ref="oldInputRef" />

    <!-- 2. Vue 3.5+ useTemplateRef -->
    <input ref="newInputRef" />

    <!-- 3. 函数 ref (复杂场景) -->
    <div :ref="(el) => onDivMount(el)" class="func-ref">函数 ref</div>

    <!-- 4. 动态 ref 数组 -->
    <ul class="dynamic-refs">
      <li v-for="(item, i) in list" :key="item.id" :ref="(el) => setItemRef(el, i)">
        {{ item.text }}
      </li>
    </ul>

    <!-- 5. v-for + ref 收集 (Vue 2 用 this.$refs.list, Vue 3 改 ref 数组) -->
    <div v-for="tab in tabs" :key="tab.id" :ref="(el) => setTabRef(el, tab.id)" class="tab">
      {{ tab.title }}
    </div>

    <!-- 6. 组件 ref + 显式 expose -->
    <ChildComp ref="childRef" />
    <button @click="callChildMethod">调用子组件方法</button>
  </div>
</template>

<script>
import { ref, useTemplateRef } from 'vue'

export default {
  name: 'RefDeep',

  components: {
    ChildComp: {
      template: '<div>child</div>',
      data() { return { count: 0 } },
      methods: { reset() { this.count = 0 } }
    }
  },

  data() {
    return {
      list: [
        { id: 1, text: 'item 1' },
        { id: 2, text: 'item 2' },
        { id: 3, text: 'item 3' }
      ],
      tabs: [
        { id: 'a', title: 'Tab A' },
        { id: 'b', title: 'Tab B' }
      ],
      itemRefs: [],
      tabRefs: []
    }
  },

  setup() {
    // Vue 3.5+ 推荐
    const newInputRef = useTemplateRef('newInputRef')
    return { newInputRef }
  },

  methods: {
    onDivMount(el) {
      if (el) el.style.background = 'yellow'
    },
    setItemRef(el, index) {
      if (el) this.itemRefs[index] = el
    },
    setTabRef(el, id) {
      if (el) this.tabRefs[id] = el
    },
    callChildMethod() {
      this.$refs.childRef.reset()
    }
  },

  mounted() {
    // 1. 字符串 ref
    this.$refs.oldInputRef?.focus()
    // 2. useTemplateRef
    this.newInputRef.value?.focus()
    // 3. 数组 ref
    console.log('item refs:', this.itemRefs.length)
    console.log('tab refs:', Object.keys(this.tabRefs))
  }
}
</script>
