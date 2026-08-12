// iter-122a: export default Vue.extend({}) 完整组件 覆盖率测试
// 覆盖完整组件配置: props/data/computed/methods/watch/lifecycle/components/directives/filters

import Vue from 'vue'

const ChildA = { template: '<i>A</i>' }
const ChildB = { template: '<i>B</i>' }

export default Vue.extend({
  name: 'ExtendExportObject',
  components: { ChildA, ChildB },
  directives: {
    focus: {
      inserted(el) {
        el.focus()
      }
    }
  },
  filters: {
    upper(val) {
      return String(val).toUpperCase()
    },
    currency(val) {
      return '¥' + Number(val).toFixed(2)
    }
  },
  props: {
    title: { type: String, default: 'title' },
    count: { type: Number, default: 0 },
    items: { type: Array, default: () => [] },
    visible: { type: Boolean, default: false }
  },
  data() {
    return {
      inputValue: '',
      list: [],
      loading: false
    }
  },
  computed: {
    doubledCount() {
      return this.count * 2
    },
    isEmpty() {
      return this.items.length === 0
    },
    summary() {
      return this.title + ' (' + this.items.length + ')'
    }
  },
  watch: {
    count(newVal, oldVal) {
      this.inputValue = String(newVal)
    },
    items: {
      handler(newVal) {
        this.list = newVal.slice()
      },
      deep: true,
      immediate: true
    },
    visible(val) {
      if (val) this.load()
    }
  },
  beforeCreate() {
    // noop
  },
  created() {
    this.list = this.items.slice()
  },
  beforeMount() {
    // noop
  },
  mounted() {
    this.init()
  },
  beforeUpdate() {
    // noop
  },
  updated() {
    // noop
  },
  beforeDestroy() {
    this.cleanup()
  },
  destroyed() {
    // noop
  },
  methods: {
    init() {
      this.loading = true
      this.loading = false
    },
    load() {
      this.loading = true
    },
    cleanup() {
      this.list = []
    },
    handleClick() {
      this.$emit('click', this.count)
    }
  },
  template: '<div class="ext-export"><h1>{{ summary | upper }}</h1><ChildA/><ChildB/><button v-focus @click="handleClick">{{ count }}</button></div>'
})
