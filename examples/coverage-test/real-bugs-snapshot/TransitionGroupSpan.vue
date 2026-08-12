<template>
  <div class="transition-group-demo">
    <h2>&lt;transition-group&gt; 必须单根 + key</h2>

    <!--
      真实 bug 场景:
      Vue 2:
        - <transition-group> 默认渲染为 <span> 包裹
        - 子元素缺 :key 时动画失效
        - 多个根节点报错
      Vue 3:
        - 必须显式 tag="ul" / tag="div" (默认 span 容易踩坑)
        - 子元素必须 :key
        - 不再支持 transition-group 包裹多个根组件

      业务危害:
        - 列表动画失效
        - DOM 结构意外 (被 span 包裹)
        - 移动端样式错乱
    -->

    <h3>1. 错误: 没 tag, 默认 span 包裹</h3>
    <transition-group name="list-1" appear>
      <li v-for="item in items" :key="item.id">
        {{ item.name }}
      </li>
    </transition-group>
    <p class="warning">⚠️ 实际渲染为 &lt;span&gt; 包裹 li, 布局可能错乱</p>

    <hr />

    <h3>2. 正确: tag="ul" + 显式 key</h3>
    <transition-group name="list-2" tag="ul" appear>
      <li v-for="item in items" :key="item.id" class="list-item">
        <span>{{ item.name }}</span>
        <button @click="remove(item)">×</button>
      </li>
    </transition-group>

    <hr />

    <h3>3. 错误: 子元素缺 :key</h3>
    <transition-group name="list-3" tag="ul">
      <li v-for="item in items">
        {{ item.name }} (无 key, 动画失效)
      </li>
    </transition-group>
    <p class="warning">⚠️ 没 :key, transition 失效, Vue 警告</p>

    <hr />

    <h3>4. 正确: transition-group + 复杂子元素</h3>
    <transition-group name="list-4" tag="div" class="card-grid">
      <div v-for="item in items" :key="item.id" class="card">
        <h4>{{ item.title }}</h4>
        <p>{{ item.body }}</p>
      </div>
    </transition-group>

    <hr />

    <div class="actions">
      <button @click="add">add</button>
      <button @click="shuffle">shuffle</button>
      <button @click="reset">reset</button>
    </div>
  </div>
</template>

<script>
/**
 * transition-group 真实 bug 复现
 *
 * 关键规则:
 *   1. 必须 tag="..." 指定容器元素 (Vue 2 默认 span, Vue 3 行为类似)
 *   2. 子元素必须有 :key
 *   3. 子组件在 transition-group 内时, 组件根节点也要 :key
 *   4. appear 属性让初始渲染也走 transition
 *
 * 真实 bug 案例:
 *   1. <transition-group> 内放 v-for 元素没 :key → 不动画
 *   2. 容器是 div 但 CSS 写的是 .list li → 选不中
 *   3. .list-move 必须用 !important 或 transform 强制覆盖
 *   4. 子组件是 fragment (多根) → Vue 3 报错
 *
 * 动画 class 约定:
 *   .list-enter-from, .list-enter-active, .list-enter-to
 *   .list-leave-from, .list-leave-active, .list-leave-to
 *   .list-move (FLIP 动画)
 */

let _id = 100
const nextId = () => ++_id

const initial = () => [
  { id: 1, name: 'Item 1', title: '卡片 1', body: '内容 1' },
  { id: 2, name: 'Item 2', title: '卡片 2', body: '内容 2' },
  { id: 3, name: 'Item 3', title: '卡片 3', body: '内容 3' }
]

export default {
  name: 'TransitionGroupSpan',
  data() {
    return {
      items: initial()
    }
  },
  methods: {
    add() {
      this.items.push({
        id: nextId(),
        name: 'Item ' + this.items.length,
        title: '卡片 ' + this.items.length,
        body: '内容 ' + this.items.length
      })
    },
    remove(item) {
      const idx = this.items.findIndex(i => i.id === item.id)
      if (idx >= 0) this.items.splice(idx, 1)
    },
    shuffle() {
      // 触发 move 动画
      this.items = [...this.items].sort(() => Math.random() - 0.5)
    },
    reset() {
      this.items = initial()
    }
  }
}
</script>

<style scoped>
.transition-group-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.transition-group-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.transition-group-demo h3 {
  color: #409eff;
  margin-top: 16px;
}

/* ===== 1. 默认 span 容器 — 没 tag ===== */
.list-1-enter-active, .list-1-leave-active {
  transition: all 0.3s;
}
.list-1-enter, .list-1-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* ===== 2. 正确 ul 容器 ===== */
.list-2-enter-active, .list-2-leave-active {
  transition: all 0.3s;
}
.list-2-enter, .list-2-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
.list-2-move {
  transition: transform 0.3s;
}

ul {
  list-style: none;
  padding: 0;
}
.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
  background: #f0f9eb;
}
.list-item button {
  border: none;
  background: transparent;
  color: #f56c6c;
  font-size: 18px;
  cursor: pointer;
}

/* ===== 4. card 网格 ===== */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.card {
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  border-radius: 4px;
  padding: 12px;
}
.card h4 {
  margin: 0 0 8px;
  color: #409eff;
}
.card p {
  margin: 0;
  color: #606266;
  font-size: 13px;
}
.list-4-enter-active, .list-4-leave-active {
  transition: all 0.5s;
}
.list-4-enter, .list-4-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
.list-4-move {
  transition: transform 0.5s;
}

.actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
button {
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
