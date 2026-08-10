// 一个用 Vue.extend 写的组件
import Vue from 'vue'

const Counter = Vue.extend({
  name: 'Counter',
  data() {
    return { count: 0 }
  },
  methods: {
    inc() {
      this.count++
    }
  },
  destroyed() {
    console.log('counter destroyed')
  }
})

export default Counter
