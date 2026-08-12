<script>
import { Vue, Component, Prop, Emit, Watch, Ref } from 'vue-property-decorator'
import { Mixins } from 'vue-property-decorator'
import moment from 'moment'

// === Mixin (Options API 风格) ===
const TimestampMixin = Vue.extend({
  data() { return { createdAt: moment() } },
  methods: {
    formatDate(format = 'YYYY-MM-DD') {
      return this.createdAt.format(format)
    },
    daysAgo() {
      return moment().diff(this.createdAt, 'days')
    }
  }
})

@Component({
  components: { ChildComp: () => import('./ChildComp.vue') }
})
export default class WithJSDoc extends Mixins(TimestampMixin) {
  // === JSDoc 类型注解 (iter-126 vue3-types plugin 自动补) ===
  /**
   * @type {string}
   */
  title = ''

  /**
   * 用户列表
   * @type {Array<{id: number, name: string}>}
   */
  users = []

  /**
   * 加载状态
   * @type {boolean}
   */
  loading = false

  /**
   * 配置
   * @type {{apiBase: string, timeout: number}}
   */
  config = { apiBase: '/api', timeout: 5000 }

  // === vue-class-component 风格 ===
  @Prop({ type: String, required: true })
  readonly msg

  @Prop({ type: Number, default: 0 })
  readonly initialCount

  @Ref()
  readonly inputRef

  // === computed 显式 getter ===
  get doubledCount() {
    return this.initialCount * 2
  }

  get userCount() {
    return this.users.length
  }

  get hasUsers() {
    return this.users.length > 0
  }

  // === method (JSDoc 类型提示) ===
  /**
   * 加载用户列表
   * @param {string} url
   * @returns {Promise<void>}
   */
  async loadUsers(url = '/api/users') {
    this.loading = true
    try {
      const res = await fetch(url)
      this.users = await res.json()
    } finally {
      this.loading = false
    }
  }

  /**
   * 添加用户
   * @param {{id: number, name: string}} user
   */
  addUser(user) {
    this.users.push(user)
  }

  /**
   * 重置
   */
  reset() {
    this.users = []
  }

  @Emit('submit')
  handleSubmit() {
    return { title: this.title, users: this.users }
  }

  @Watch('initialCount')
  onInitialCountChange(newVal, oldVal) {
    console.log('initialCount changed:', newVal, oldVal)
  }

  mounted() {
    console.log('created at:', this.formatDate())
    console.log('days ago:', this.daysAgo())
    this.inputRef?.focus()
  }
}
</script>

<template>
  <div class="jsdoc-component">
    <h2>{{ title }} ({{ doubledCount }})</h2>
    <p>共 {{ userCount }} 个用户</p>
    <input ref="inputRef" v-model="title" />
    <button @click="loadUsers" :disabled="loading">
      {{ loading ? 'loading...' : 'load users' }}
    </button>
    <ul v-if="hasUsers">
      <li v-for="u in users" :key="u.id">{{ u.name }}</li>
    </ul>
    <button @click="handleSubmit">submit</button>
  </div>
</template>
