// iter-122a: Vue.extend basic + chain 覆盖率测试

import Vue from 'vue'

// Vue.extend basic
const MyComponent = Vue.extend({
  template: '<div>{{ msg }}</div>',
  data() {
    return { msg: 'hi' }
  },
  methods: {
    greet() {
      return 'Hello, ' + this.msg
    }
  }
})

// 链式 extend (Vue 2 子类继承)
const SubComponent = MyComponent.extend({
  data() {
    return { msg: 'sub' }
  }
})

export { MyComponent, SubComponent }
export default MyComponent
