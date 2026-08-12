// iter-122a: Vue.extend + .mixin + .component 链式组合 覆盖率测试
// 覆盖 Vue 2 老项目过渡期常见模式: Vue.extend({}).mixin({}).component({})
// 注意: .mixin() / .component() 是全局 API, 老项目常这样组合扩展

import Vue from 'vue'

// 基础组件类
const BaseComp = Vue.extend({
  template: '<div>{{ baseMsg }}</div>',
  data() {
    return { baseMsg: 'base' }
  },
  methods: {
    baseMethod() {
      return this.baseMsg
    }
  }
})

// 用全局 .mixin 注入共享逻辑 (Vue 2 风格, 迁移到 Vue3 需改 app.mixin 或 composition)
const ExtendedWithMixin = BaseComp.mixin({
  data() {
    return { sharedData: 'shared' }
  },
  computed: {
    sharedComputed() {
      return this.sharedData + '-ext'
    }
  },
  methods: {
    sharedMethod() {
      return this.sharedData
    }
  },
  created() {
    this.sharedData = 'init'
  }
})

// 链式再 .component 注册全局组件 (Vue.component 返回 Vue 构造器, 可继续链)
const FinalComp = ExtendedWithMixin.component('GlobalWidget', {
  template: '<b>{{ widgetText }}</b>',
  data() {
    return { widgetText: 'widget' }
  }
})

export { BaseComp, ExtendedWithMixin }
export default FinalComp
