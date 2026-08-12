<template>
  <div class="watch-demo">
    <h2>watch 监听 ref vs reactive 行为差异</h2>

    <!--
      真实 bug 场景:
      Vue 2:
        - watch 默认 deep: true (对 Object)
        - 监听 'a.b.c' 字符串路径 OK
        - 监听嵌套对象属性自动 deep
      Vue 3:
        - watch 默认 deep: false (性能优先)
        - 字符串路径仍然支持
        - 监听 reactive 需要显式 deep
        - 监听 ref 必须 .value, 但 setup return 后自动 unwrap

      业务危害:
      - 嵌套对象属性修改不触发回调
      - Vue 2 → 3 升级后表单联动失效
    -->

    <h3>1. 字符串路径 watch (Vue 2/3 都 OK)</h3>
    <input v-model="state.name" placeholder="改 name" />
    <p>state.name: {{ state.name }}</p>
    <p>watch hit (string path): {{ hitStringPath }}</p>

    <hr />

    <h3>2. 监听 ref (Vue 3 需要 .value / 显式 deep)</h3>
    <input v-model="refInner.name" placeholder="改 ref inner" />
    <p>refInner.name: {{ refInner.name }}</p>
    <p>watch hit (ref, no deep): {{ hitRef }}</p>

    <hr />

    <h3>3. 监听 reactive 嵌套属性 (需要 deep: true)</h3>
    <input v-model="nested.user.profile.email" placeholder="改 email" />
    <p>nested.user.profile.email: {{ nested.user.profile.email }}</p>
    <p>watch hit (reactive, deep): {{ hitReactiveDeep }}</p>

    <hr />

    <h3>4. 监听 ref({...}) 嵌套属性 — 必须 deep</h3>
    <input v-model="refNested.x.y" placeholder="改 x.y" />
    <p>refNested.x.y: {{ refNested.x.y }}</p>
    <p>watch hit (ref obj, deep): {{ hitRefObjDeep }}</p>

    <hr />

    <p class="warning">
      ⚠️ Vue 3 中, watch 一个 ref 包装的 Object 不会因为 inner.xxx 变化触发
      必须显式 { deep: true } 或 watch(() => ref.value.xxx)
    </p>
  </div>
</template>

<script>
/**
 * watch 响应式追踪差异 真实 bug 复现
 *
 * 关键差异表:
 * ┌────────────────────────┬─────────────────────┬─────────────────────┐
 * │ 场景                    │ Vue 2               │ Vue 3               │
 * ├────────────────────────┼─────────────────────┼─────────────────────┤
 * │ 'a.b.c' 字符串路径       │ ✅ 默认 deep         │ ✅ 仍 work           │
 * │ watch: { obj: fn }      │ ✅ 自动 deep         │ ❌ shallow           │
 * │ watch(ref, fn)          │ n/a                 │ ❌ ref 本身不触发    │
 * │ watch(ref.value.x, fn)  │ n/a                 │ ✅ 精确追踪          │
 * │ watch(ref, fn, deep)    │ n/a                 │ ✅ 监听 inner        │
 * └────────────────────────┴─────────────────────┴─────────────────────┘
 *
 * 实际 Vue 2.7.16 项目里 watch 走 Options API, 默认 deep: false 但
 * Vue 2.7 + ref/reactive 时, watch(ref, ...) 行为已与 Vue 3 一致
 */

import { ref, reactive, watch } from 'vue'

export default {
  name: 'ReactiveUnwrapWatch',
  data() {
    return {
      state: { name: 'init' },
      hitStringPath: 0,
      hitRef: 0,
      hitReactiveDeep: 0,
      hitRefObjDeep: 0
    }
  },
  computed: {
    // 模拟 setup 中的 ref/reactive
    refInner: {
      get() { return this._refInner },
      set(v) { this._refInner = v }
    },
    refNested: {
      get() { return this._refNested },
      set(v) { this._refNested = v }
    },
    nested() { return this._nested }
  },
  created() {
    // 模拟 setup 中的 ref/reactive
    this._refInner = ref({ name: 'ref-init' })
    this._refNested = ref({ x: { y: 0 } })
    this._nested = reactive({ user: { profile: { email: 'init@x.com' } } })

    // ====== 字符串路径 watch — Vue 2/3 都 work ======
    this.$watch('state.name', () => {
      this.hitStringPath++
    })

    // ====== watch(ref) — Vue 3 不会触发 ======
    watch(this._refInner, () => {
      // 触发条件: this._refInner.value = 新对象 (整体替换)
      // 不会因为 this._refInner.value.name 变化触发
      this.hitRef++
    })

    // ====== watch(reactive, deep: true) — Vue 3 推荐写法 ======
    watch(this._nested, () => {
      this.hitReactiveDeep++
    }, { deep: true })

    // ====== watch(ref, deep: true) — 监听 ref 内对象 ======
    watch(this._refNested, () => {
      this.hitRefObjDeep++
    }, { deep: true })
  },
  methods: {
    // 测试用: 模拟整体替换 ref.value
    replaceRefInner() {
      this._refInner.value = { name: 'replaced-' + Date.now() }
    }
  }
}
</script>

<style scoped>
.watch-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.watch-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.watch-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
input {
  padding: 4px 8px;
  margin: 4px 0;
  width: 100%;
  box-sizing: border-box;
}
p {
  margin: 4px 0;
  font-size: 14px;
}
.warning {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #c45656;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: monospace;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
