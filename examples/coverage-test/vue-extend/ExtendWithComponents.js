// iter-122a: Vue.extend 注册局部组件 覆盖率测试
// 覆盖 components + template + 父子组件关系

import Vue from 'vue'

const ChildComp = {
  template: '<span class="child">child</span>',
  data() {
    return { childMsg: 'child-data' }
  },
  methods: {
    childFn() {
      return this.childMsg
    }
  }
}

const SiblingComp = Vue.extend({
  template: '<p>{{ siblingText }}</p>',
  data() {
    return { siblingText: 'sibling' }
  }
})

const Parent = Vue.extend({
  components: { ChildComp, SiblingComp },
  template: '<div class="parent"><ChildComp/><SiblingComp/></div>',
  data() {
    return { parentData: 'parent' }
  },
  computed: {
    parentComputed() {
      return this.parentData.toUpperCase()
    }
  },
  methods: {
    parentFn() {
      return this.parentComputed
    }
  },
  mounted() {
    this.parentFn()
  }
})

export { ChildComp, SiblingComp }
export default Parent
