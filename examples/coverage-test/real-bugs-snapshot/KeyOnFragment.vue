<template>
  <div class="key-on-fragment-demo">
    <h2>v-for 缺 :key 警告 (Vue 2/3 一致, 但行为不同)</h2>

    <!--
      真实 bug 场景:
      Vue 2: v-for 没 :key 会 warn 但不阻断渲染
      Vue 3: v-for 没 :key 会 warn, 同时在 <transition-group> 中完全失效
              fragment 上没 :key 会导致 patch 错位

      业务危害:
      - 列表项有内部状态 (input/checkbox) 时, 删除/插入会导致状态错位
      - 性能下降 (无 diff 优化)
      - 动画失效
    -->

    <h3>1. 缺 :key 的 v-for (警告 + 错位风险)</h3>
    <ul>
      <li v-for="item in items">
        <input :value="item.name" @input="item.name = $event.target.value" />
        <span>{{ item.name }}</span>
        <button @click="removeItem(item)">remove</button>
      </li>
    </ul>
    <p class="warning">
      ⚠️ 没有 :key, Vue 只能按 index 复用 DOM — 状态会错位
    </p>

    <hr />

    <h3>2. 正确: 带 :key 的 v-for</h3>
    <ul>
      <li v-for="item in items" :key="item.id">
        <input :value="item.name" @input="item.name = $event.target.value" />
        <span>{{ item.name }}</span>
        <button @click="removeItem(item)">remove</button>
      </li>
    </ul>

    <hr />

    <h3>3. Vue 3 Fragment 上加 key (根节点多个元素时)</h3>
    <!--
      Vue 3 允许多根节点组件, 但 v-for 必须有 key, 否则:
      "Each child in a list of fragments should have a unique 'key' prop"
    -->
    <ul>
      <template v-for="item in items" :key="item.id">
        <li class="primary">{{ item.name }} (主)</li>
        <li class="secondary">{{ item.name }} (副)</li>
      </template>
    </ul>
    <p class="note">fragment 上 :key 是 Vue 3 强制的, 否则告警</p>

    <hr />

    <h3>4. 错误: 用 index 当 key (看起来 OK 但有 bug)</h3>
    <ul>
      <li v-for="(item, index) in items" :key="index">
        <input :value="item.name" @input="item.name = $event.target.value" />
        <span>{{ item.name }}</span>
      </li>
    </ul>
    <p class="warning">
      ⚠️ 用 index 当 key 在插入/删除时同样会错位, 应当用稳定的业务 id
    </p>

    <button @click="addItem">add</button>
  </div>
</template>

<script>
/**
 * v-for 缺 :key 真实 bug 复现
 *
 * 触发条件:
 * 1. v-for 没写 :key
 * 2. v-for 用了 index 当 key 但列表会增删
 * 3. Vue 3 fragment 上没 :key
 *
 * 表现:
 * - 控制台 [Vue warn] 警告
 * - DOM 复用错位: 删除第 2 项, 选中状态/输入框内容会跑到第 1 项
 * - transition-group 动画不触发
 */

let _id = 100
const nextId = () => ++_id

export default {
  name: 'KeyOnFragment',
  data() {
    return {
      items: [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 3, name: 'C' }
      ]
    }
  },
  methods: {
    addItem() {
      this.items.push({ id: nextId(), name: 'new-' + this.items.length })
    },
    removeItem(item) {
      const idx = this.items.findIndex(i => i.id === item.id)
      if (idx >= 0) this.items.splice(idx, 1)
    }
  }
}
</script>

<style scoped>
.key-on-fragment-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.key-on-fragment-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.key-on-fragment-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-bottom: 1px solid #ebeef5;
}
li.primary {
  background: #ecf5ff;
}
li.secondary {
  background: #f5f7fa;
  font-size: 12px;
  color: #909399;
}
.warning {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #c45656;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
.note {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  color: #67c23a;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
}
button {
  margin-top: 12px;
  padding: 6px 16px;
  cursor: pointer;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
