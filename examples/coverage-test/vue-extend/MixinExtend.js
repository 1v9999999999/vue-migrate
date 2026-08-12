// iter-122a: Vue.extend + mixins 混合 覆盖率测试
// 覆盖 mixins 数组 + data/methods/computed 合并场景

import Vue from 'vue'

const myMixin = {
  data() {
    return { mixinData: 'x' }
  },
  computed: {
    mixinComputed() {
      return this.mixinData + '-computed'
    }
  },
  methods: {
    mixinMethod() {
      return this.mixinData
    }
  }
}

const anotherMixin = {
  data() {
    return { anotherData: 'y' }
  },
  methods: {
    anotherMethod() {
      return this.anotherData
    }
  },
  mounted() {
    this.anotherMethod()
  }
}

const Comp = Vue.extend({
  mixins: [myMixin, anotherMixin],
  data() {
    return { own: 1 }
  },
  computed: {
    ownComputed() {
      return this.own + this.mixinData.length
    }
  },
  methods: {
    ownMethod() {
      this.mixinMethod()
      this.anotherMethod()
      return this.own
    }
  },
  created() {
    this.ownMethod()
  }
})

export { myMixin, anotherMixin }
export default Comp
