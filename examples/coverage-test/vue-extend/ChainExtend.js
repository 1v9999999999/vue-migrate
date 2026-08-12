// iter-122a: Vue.extend 链式调用 (3 层继承) 覆盖率测试
// 覆盖 Base.extend().extend() 多层链式, 每层有 data/methods/computed/lifecycle

import Vue from 'vue'

// 第 1 层: Base
const Base = Vue.extend({
  data() {
    return { base: 1 }
  },
  computed: {
    baseComputed() {
      return this.base * 10
    }
  },
  methods: {
    baseFn() {
      return this.base
    }
  },
  created() {
    this.base = 1
  }
})

// 第 2 层: Mid 继承 Base
const Mid = Base.extend({
  data() {
    return { mid: 2 }
  },
  computed: {
    midComputed() {
      return this.mid + this.baseComputed
    }
  },
  methods: {
    midFn() {
      return this.mid
    }
  },
  mounted() {
    this.midFn()
  }
})

// 第 3 层: Final 继承 Mid
const Final = Mid.extend({
  data() {
    return { final: 3 }
  },
  computed: {
    finalComputed() {
      return this.final + this.midComputed
    }
  },
  methods: {
    finalFn() {
      return this.final
    }
  },
  beforeDestroy() {
    this.cleanup()
  }
})

export { Base, Mid }
export default Final
