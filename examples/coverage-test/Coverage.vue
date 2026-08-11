<!--
  Vue 2 → Vue 3 写法穷举测试 (Coverage.vue)
  iter-085: P3 验证 — 1 个 .vue 含所有 vue 2 写法(常见+生僻), 看 vue-migrate 转换覆盖率
-->
<template>
  <div class="root">
    <!-- 1. v-if / v-else-if / v-else 链 -->
    <p v-if="type === 'a'">A: {{ message }}</p>
    <p v-else-if="type === 'b'">B: {{ formattedMsg }}</p>
    <p v-else>C: {{ message | uppercase }}</p>

    <!-- 2. v-for 数组 -->
    <ul>
      <li v-for="(item, i) in items" :key="item.id">
        {{ i + 1 }}. {{ item.name }} - {{ item.value | currency }}
      </li>
    </ul>

    <!-- 3. v-for 对象 -->
    <dl>
      <template v-for="(value, key) in stats" :key="key">
        <dt>{{ key }}</dt>
        <dd>{{ value }}</dd>
      </template>
    </dl>

    <!-- 4. v-for 数字 -->
    <span v-for="n in 5" :key="n">*</span>

    <!-- 5. v-show + v-if 组合 -->
    <dialog v-show="dialogOpen" v-if="hasPermission">Modal</dialog>

    <!-- 6. v-bind 完整: 多个 prop, 动态 class, 内联 style -->
    <my-component
      ref="myComp"
      :prop-a="aValue"
      :prop-b.sync="bValue"
      :class="['static', { active: isActive }, dynamicClass]"
      :style="{ color: textColor, fontSize: size + 'px' }"
      v-on="listeners"
    />

    <!-- 7. v-on 修饰符: .prevent .stop .once .self .passive .capture .key.enter .key.esc .mouse.left .exact -->
    <form @submit.prevent="onSubmit" @keyup.enter="onEnter" @keyup.esc="onEsc">
      <button @click.stop="onClick" @click.once="onFirstClick">Save</button>
    </form>

    <!-- 8. v-model 修饰符 -->
    <input v-model.lazy="lazyValue" />
    <input v-model.number="numValue" />
    <input v-model.trim="trimValue" />
    <my-input v-model="modelValue" />
    <my-input :value="modelValue" @input="modelValue = $event" />

    <!-- 9. slot / slot-scope / v-slot -->
    <layout>
      <template slot="header">Header</template>
      <template slot-scope="props">{{ props.item }}</template>
      <template v-slot:footer="{ data }">{{ data }}</template>
      <template v-slot:default>Default</template>
    </layout>

    <!-- 10. scoped slots: v-for + slot-scope -->
    <my-list :items="items">
      <template slot-scope="row">
        <span>{{ row.name }} - {{ row.value | formatNumber }}</span>
      </template>
    </my-list>

    <!-- 11. keep-alive / transition / transition-group -->
    <keep-alive>
      <component :is="currentTab" />
    </keep-alive>

    <transition name="fade">
      <p v-if="visible">Animated</p>
    </transition>

    <transition-group name="flip">
      <span v-for="x in animatedItems" :key="x" class="item">{{ x }}</span>
    </transition-group>

    <!-- 12. v-html / v-text / v-once / v-pre / v-cloak -->
    <div v-html="rawHtml"></div>
    <div v-text="message"></div>
    <p v-once>{{ message }}</p>
    <pre v-pre>{{ message }}</pre>

    <!-- 13. 动态 component -->
    <component :is="currentView" v-bind="dynamicProps" />

    <!-- 14. 自定义指令 v-foo / v-bar:arg / .modifier -->
    <input v-foo="value" />
    <div v-bar:click="handler">Click</div>
    <div v-bar:click.stop="handler">Click with modifier</div>

    <!-- 15. 内置 v-show / filter pipe -->
    <span v-show="isVisible">{{ price | currency('USD') }}</span>

    <!-- 16. inline-template (生僻) -->
    <my-comp inline-template>
      <p>{{ message }}</p>
    </my-comp>

    <!-- 17. 异步组件: dynamic import (生僻, 在 template 里) -->
    <lazy-comp v-if="showLazy" />
  </div>
</template>

<script>
// Mixin 1
const mixinA = {
  data() {
    return { mixinAData: 'A' }
  },
  created() {
    console.log('mixinA created')
  }
}

// Mixin 2 (生僻: with globalProperties)
const mixinB = {
  data() {
    return { mixinBData: 'B' }
  },
  computed: {
    combined() {
      return this.mixinAData + this.mixinBData
    }
  }
}

// 自定义指令 (bind/inserted/update 钩子, Vue 3 改 beforeMount/mounted/beforeUpdate/updated)
const vFocus = {
  bind(el, binding) { el.style.color = binding.value },
  inserted(el) { el.focus() },
  update(el, binding) { el.style.color = binding.value }
}

// 全局 filter
const uppercase = v => v.toUpperCase()
const currency = (v, sym = '$') => `${sym}${v.toFixed(2)}`
const formatNumber = v => v.toLocaleString()

// 自定义 v-model 模型声明
export default {
  name: 'CoverageTest',

  // 2.1 mixins
  mixins: [mixinA, mixinB],

  // 2.2 filters (Vue 3 已移除 options.filters)
  filters: {
    uppercase,
    currency,
    formatNumber
  },

  // 2.3 model 选项 (Vue 3 默认 v-model 用 modelValue/update:modelValue)
  model: {
    prop: 'value',
    event: 'input'
  },

  // 2.4 inheritAttrs
  inheritAttrs: false,

  // 2.5 自定义指令 (局部)
  directives: {
    focus: vFocus,
    foo: { inserted: el => el.setAttribute('data-foo', '1') }
  },

  // 3. data (对象 + 工厂函数 两种形式)
  data() {
    return {
      type: 'a',
      message: 'hello',
      items: [{ id: 1, name: 'a', value: 1.5 }],
      stats: { count: 10, total: 100 },
      dialogOpen: false,
      hasPermission: true,
      aValue: 1,
      bValue: 2,
      isActive: true,
      dynamicClass: 'dyn',
      textColor: 'red',
      size: 14,
      lazyValue: '',
      numValue: 0,
      trimValue: '',
      modelValue: '',
      visible: true,
      isVisible: true,
      price: 9.99,
      currentTab: 'home',
      currentView: 'div',
      dynamicProps: { x: 1 },
      showLazy: true,
      value: 'foo',
      rawHtml: '<b>raw</b>'
    }
  },

  // 4. props (数组 + 对象两种形式)
  props: {
    'prop-a': Number,
    value: String,
    items: Array
  },

  // 5. computed (含 getter/setter)
  computed: {
    formattedMsg() {
      return this.message.toUpperCase()
    },
    fullName: {
      get() { return this.firstName + ' ' + this.lastName },
      set(v) { [this.firstName, this.lastName] = v.split(' ') }
    }
  },

  // 6. watch (含 deep/immediate/handler 字符串形式)
  watch: {
    message(newVal, oldVal) { console.log(newVal, oldVal) },
    items: {
      handler(v) { console.log(v) },
      deep: true,
      immediate: true
    },
    'stats.count': 'onCountChange'  // 字符串 handler (生僻)
  },

  // 7. methods
  methods: {
    onSubmit() { this.$emit('submit') },
    onEnter() {},
    onEsc() {},
    onClick() { this.$forceUpdate() },
    onFirstClick() {},
    onCountChange() {},
    handler() {},

    // 7.1 this.$refs / this.$children / this.$parent / this.$root
    refreshRef() {
      this.$refs.myComp?.focus()
      this.$children.forEach(c => c.update())
      this.$parent?.close()
      this.$root.$emit('app-event')
    },

    // 7.2 this.$set / this.$delete (Vue 3 已废弃)
    updateProp() {
      this.$set(this.items, 0, { id: 99 })
      this.$delete(this.stats, 'count')
    },

    // 7.3 this.$on / this.$off / this.$once (Vue 3 已移除)
    listen() {
      this.$on('custom-event', this.handler)
      this.$once('one-time', this.handler)
    },
    unlisten() {
      this.$off('custom-event', this.handler)
    },

    // 7.4 this.$nextTick
    afterUpdate() {
      this.$nextTick(() => console.log('updated'))
    },

    // 7.5 this.$emit (with various arg counts)
    emitEvents() {
      this.$emit('zero-arg')
      this.$emit('one-arg', 1)
      this.$emit('two-args', 1, 'two')
      this.$emit('three-args', 1, 2, 3)
    },

    // 7.6 this.$http / this.$axios / this.$api (this-replacer 目标)
    fetchData() {
      this.$http.get('/api')
      this.$axios.post('/api', { x: 1 })
      this.$api.delete('/api/1')
      this.$util.format('%s', 'x')
    },

    // 7.7 this.$route / this.$router / this.$store
    navigate() {
      this.$route.params.id
      this.$router.push('/home')
      this.$store.dispatch('user/login', { token: 'x' })
      this.$store.commit('SET_NAME', 'a')
      this.$store.getters.user
    },

    // 7.8 this.$options.componentName
    getName() { return this.$options.componentName },

    // 7.9 this.$vnode / this.$isServer / this.$isDestroyed
    debugSelf() {
      this.$vnode.tag
      this.$isServer
      this.$isDestroyed
    }
  },

  // 8. lifecycle hooks (含 Vue 3 移除的 beforeDestroy/destroyed)
  beforeCreate() { console.log('beforeCreate') },
  created() {
    // 8.1 Vue 2 静态 API
    Vue.set(this.items, 0, { x: 1 })
    Vue.delete(this.stats, 'count')
    Vue.observable({ reactive: 1 })
    // Vue.compile 移除
    // Vue.compile('<div>{{x}}</div>')
  },
  beforeMount() { console.log('beforeMount') },
  mounted() {
    // 8.2 事件总线 (Vue 3 移除)
    this.$on('app-event', () => {})
  },
  beforeUpdate() { console.log('beforeUpdate') },
  updated() { console.log('updated') },
  activated() { console.log('activated') },
  deactivated() { console.log('deactivated') },
  beforeDestroy() { console.log('beforeDestroy') },  // Vue 3 改名 beforeUnmount
  destroyed() { console.log('destroyed') },         // Vue 3 改名 unmounted
  errorCaptured() { console.log('errorCaptured') }
}

// Vue 2 全局 API (在 .vue 顶部 import Vue from 'vue' 后)
import Vue from 'vue'

// 全局 filter (Vue 3 已移除)
Vue.filter('global-uppercase', v => v.toUpperCase())

// 全局 directive (Vue 3 改用 app.directive)
Vue.directive('global-foo', { inserted: el => el.focus() })

// 全局 mixin (Vue 3 仍可用但不推荐)
Vue.mixin({ created() { console.log('global-mixin') } })

// 全局 component
Vue.component('GlobalComp', { template: '<div>global</div>' })

// Vue.use (plugin)
Vue.use({ install(Vue) { Vue.prototype.$myPlugin = 'x' } })

// Vue.prototype 全局属性 (this-replacer 目标)
Vue.prototype.$http = null
Vue.prototype.$axios = null
Vue.prototype.$api = null
Vue.prototype.$util = { format: () => '' }

// Vue.config (Vue 3 用 app.config)
Vue.config.productionTip = false
Vue.config.devtools = true
</script>

<style scoped>
.root { padding: 1rem; }
.active { font-weight: bold; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.flip-move { transition: transform 0.5s; }
</style>
