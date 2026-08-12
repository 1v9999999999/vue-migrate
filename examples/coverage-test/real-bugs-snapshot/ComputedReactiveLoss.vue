<template>
  <div class="computed-loss-demo">
    <h2>v-for 子组件 v-model 数组 mutation 失效</h2>

    <!--
      真实 bug 场景:
      Vue 2 通过 defineProperty hack 让数组下标赋值也触发响应式:
        Object.defineProperty(arr, '0', { get, set })
        数组 push/splice/index=xxx 都会触发
      Vue 3 用 Proxy, 数组下标赋值不会触发依赖收集,
      必须用 splice / $patch 才会触发

      业务危害:
      - 列表项编辑不生效
      - v-model 双向绑定断开
      - 难复现 (有时机问题)
    -->

    <h3>当前 items:</h3>
    <ul>
      <li v-for="(item, idx) in items" :key="item.id">
        <!--
          v-model 编译产物:
            :value + @input  (Vue 2)
            :modelValue + @update:modelValue  (Vue 3)
          内部修改 item.value 必须触发响应式
        -->
        <ListItem v-model="item.value" />
        <span>[{{ idx }}] id={{ item.id }} value={{ item.value }}</span>
        <button @click="updateDirect(item)">direct assign (Vue 3 失效)</button>
        <button @click="updateSplice(item)">splice (通用)</button>
      </li>
    </ul>

    <button @click="addItem">add</button>
    <button @click="batchUpdate">batch update (Vue.set 风格)</button>

    <hr />

    <p class="warning">
      ⚠️ Vue 2: this.items[0].value = 'x' 会触发响应式 (defineProperty hack)
      Vue 3: 必须用 splice 或重新赋值整个数组
    </p>
  </div>
</template>

<script>
/**
 * 数组元素 mutation 响应式失效 真实 bug 复现
 *
 * 触发条件:
 * 1. 数组项是对象, 修改对象属性
 * 2. v-for 子组件 v-model 直接绑定到 item.xxx
 * 3. Vue 3 + Composition API
 *
 * Vue 2 行为 (响应式有效, 但实现有 hack):
 *   - Object.defineProperty(arr, index, ...) 监听下标
 *   - 数组方法 (push/splice/pop) 被重写
 *   - this.$set(arr, i, val) 显式触发
 *
 * Vue 3 行为 (Proxy 原生支持, 但下标赋值需手动):
 *   - 数组整体 push/splice 触发 length 变化 → 触发响应式
 *   - arr[0] = x 不会触发 length 变化 → 不触发
 *   - 必须 splice / 解构替换
 */

const ListItem = {
  name: 'ListItem',
  props: {
    // 兼容 Vue 2 (value) + Vue 3 (modelValue)
    value: { type: String, default: '' },
    modelValue: { type: String, default: '' }
  },
  computed: {
    internalVal() {
      return this.modelValue || this.value
    }
  },
  methods: {
    onInput(e) {
      this.$emit('input', e.target.value)
      this.$emit('update:modelValue', e.target.value)
    }
  },
  template: `
    <input :value="internalVal" @input="onInput" />
  `
}

let _id = 100
const nextId = () => ++_id

export default {
  name: 'ComputedReactiveLoss',
  components: { ListItem },
  data() {
    return {
      items: [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
        { id: 3, value: 'c' }
      ]
    }
  },
  methods: {
    addItem() {
      this.items.push({ id: nextId(), value: 'new' })
    },
    /**
     * Vue 2: 直接修改下标会触发响应式
     * Vue 3: 不会触发, UI 不更新
     */
    updateDirect(item) {
      const idx = this.items.findIndex(i => i.id === item.id)
      if (idx >= 0) {
        // ❌ Vue 3 不响应
        this.items[idx].value = 'direct-' + Date.now()
        // ✅ Vue 2 兼容 (Vue.set / this.$set)
        // this.$set(this.items, idx, { ...this.items[idx], value: 'direct-' + Date.now() })
      }
    },
    /**
     * 通用写法: splice 触发 length 变化
     */
    updateSplice(item) {
      const idx = this.items.findIndex(i => i.id === item.id)
      if (idx >= 0) {
        const next = { ...this.items[idx], value: 'splice-' + Date.now() }
        this.items.splice(idx, 1, next)
      }
    },
    /**
     * 批量更新: 重新赋值整个数组
     */
    batchUpdate() {
      this.items = this.items.map((it, i) => ({
        ...it,
        value: 'batch-' + i
      }))
    }
  }
}
</script>

<style scoped>
.computed-loss-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.computed-loss-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #ebeef5;
}
button {
  padding: 4px 8px;
  cursor: pointer;
  font-size: 12px;
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
