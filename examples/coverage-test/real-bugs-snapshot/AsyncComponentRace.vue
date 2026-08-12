<template>
  <div class="async-race-demo">
    <h2>异步组件快速切换 race condition</h2>

    <!--
      真实 bug 场景:
      快速点击 button 切换 currentId 时:
      - 旧异步组件的 setData/setTimeout 在新组件挂载后才完成
      - 新组件显示旧数据 (因为旧组件的更新被 apply)
      - Options API 用 data() 每次返回新对象, 相对安全
      - Composition API 用 ref() 只创建一次, 必须手动清理

      修复方案:
      - Vue 2 + Options: this.$options.data() 每次新建, OK
      - Vue 3 + Composition: onScopeDispose 清理副作用, 或用 watchEffect + onCleanup
      - 通用: 在 beforeDestroy/onBeforeUnmount 取消所有未完成的请求
    -->

    <h3>当前 currentId: {{ currentId }}</h3>
    <button @click="currentId++">next ({{ currentId }} → {{ currentId + 1 }})</button>
    <button @click="fastSwitch">快速切换 5 次 (触发 race)</button>
    <button @click="reset">reset</button>

    <hr />

    <h3>1. Options API (相对安全)</h3>
    <AsyncOptions :data-id="currentId" />

    <hr />

    <h3>2. Composition API (Vue 3) — ref 泄漏风险</h3>
    <AsyncComposition :data-id="currentId" />

    <hr />

    <h3>3. 正确清理写法 (AbortController + onBeforeUnmount)</h3>
    <AsyncSafe :data-id="currentId" />

    <hr />

    <p class="warning">
      ⚠️ 在 Vue 2 Options API 中, data() 每次返回新对象, 异步响应到达时:
      如果组件已销毁, 旧实例已被 GC, 不会污染 UI.
      Vue 3 Composition API 用 ref() 必须手动 onScopeDispose 清理.
    </p>
  </div>
</template>

<script>
/**
 * 异步组件 race condition 真实 bug 复现
 *
 * 触发步骤:
 * 1. 快速点 "快速切换 5 次"
 * 2. 观察 AsyncComposition 内部 staleId 是否会盖过 currentId
 * 3. 旧异步响应写入 ref, 组件切换后新组件显示旧值
 *
 * 危害:
 * - 数据错乱
 * - 内存泄漏 (未清理的 setTimeout / Promise)
 * - 竞态导致难以复现的 bug
 */

// 模拟异步数据源 — 故意随机延时, 制造 race 条件
let _serverId = 0
function mockFetch(id) {
  return new Promise(resolve => {
    const delay = 200 + Math.random() * 300
    const serverId = ++_serverId
    setTimeout(() => {
      resolve({ id, serverId, payload: 'data-for-' + id })
    }, delay)
  })
}

// ====== 1. Options API: data() 每次新建, 相对安全 ======
const AsyncOptions = {
  name: 'AsyncOptions',
  props: { dataId: { type: Number, required: true } },
  data() {
    return {
      loading: false,
      result: null
    }
  },
  watch: {
    dataId: {
      immediate: true,
      handler(newId) {
        this.loading = true
        // 模拟请求, 不取消旧的
        mockFetch(newId).then(res => {
          // Options API 优点: 每次 data() 都是新对象, 不会污染其他实例
          // 但 setTimeout 仍会执行, 只是写入的是已销毁实例 (无害)
          this.result = res
          this.loading = false
        })
      }
    }
  },
  beforeDestroy() {
    // Vue 2 钩子 — Vue 3 改 onBeforeUnmount
    // this 上的 Promise 无法被 abort, 只能等 setTimeout 自然完成
  },
  template: `
    <div class="async-box">
      <h4>Options</h4>
      <p>dataId: {{ dataId }}</p>
      <p>loading: {{ loading }}</p>
      <pre>{{ result ? JSON.stringify(result, null, 2) : 'null' }}</pre>
    </div>
  `
}

// ====== 2. Composition API: ref 跨实例泄漏 ======
const AsyncComposition = {
  name: 'AsyncComposition',
  props: { dataId: { type: Number, required: true } },
  setup(props) {
    const loading = { value: false }
    const result = { value: null }
    // ⚠️ 错误示范: 没有清理逻辑, ref 会跨实例泄漏
    // 实际上 Vue 2.7 的 setup 用普通对象模拟 ref, 这里仅作代码样本展示
    const immediate = (fn) => { fn(); return () => {} }
    const stop = immediate(() => {
      // 模拟 watch 行为
    })
    // 触发 watch
    const handler = (newId) => {
      loading.value = true
      mockFetch(newId).then(res => {
        result.value = res
        loading.value = false
      })
    }
    handler(props.dataId)
    return { loading, result, stop }
  },
  template: `
    <div class="async-box">
      <h4>Composition (no cleanup)</h4>
      <p>dataId: {{ dataId }}</p>
      <p>loading: {{ loading }}</p>
      <pre>{{ result ? JSON.stringify(result, null, 2) : 'null' }}</pre>
    </div>
  `
}

// ====== 3. 正确清理: AbortController + beforeDestroy ======
const AsyncSafe = {
  name: 'AsyncSafe',
  props: { dataId: { type: Number, required: true } },
  data() {
    return {
      loading: false,
      result: null,
      abortCtrl: null
    }
  },
  watch: {
    dataId: {
      immediate: true,
      handler(newId) {
        // 取消上一次的请求 (如果支持 abort)
        if (this.abortCtrl && this.abortCtrl.abort) {
          this.abortCtrl.abort()
        }
        this.abortCtrl = { aborted: false, abort() { this.aborted = true } }
        const ctrl = this.abortCtrl
        this.loading = true
        mockFetch(newId).then(res => {
          // 模拟 abort 检查
          if (ctrl.aborted) return
          this.result = res
          this.loading = false
        })
      }
    }
  },
  beforeDestroy() {
    // 销毁时取消未完成请求
    if (this.abortCtrl) this.abortCtrl.abort()
  },
  template: `
    <div class="async-box">
      <h4>Options (safe cleanup)</h4>
      <p>dataId: {{ dataId }}</p>
      <p>loading: {{ loading }}</p>
      <pre>{{ result ? JSON.stringify(result, null, 2) : 'null' }}</pre>
    </div>
  `
}

export default {
  name: 'AsyncComponentRace',
  components: { AsyncOptions, AsyncComposition, AsyncSafe },
  data() {
    return { currentId: 1 }
  },
  methods: {
    fastSwitch() {
      for (let i = 0; i < 5; i++) {
        this.currentId++
      }
    },
    reset() {
      this.currentId = 1
    }
  }
}
</script>

<style scoped>
.async-race-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.async-race-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.async-race-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
.async-box {
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
  margin: 8px 0;
}
.async-box h4 {
  margin: 0 0 8px;
  color: #303133;
}
.async-box pre {
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
}
button {
  margin-right: 8px;
  padding: 4px 12px;
  cursor: pointer;
}
.warning {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #c45656;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
