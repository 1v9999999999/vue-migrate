<template>
  <div class="vfor-vif-demo">
    <h2>v-for + v-if 优先级示例（Vue 2 → Vue 3 重大变化）</h2>

    <p class="warning">
      ⚠️ Vue 2: v-for 优先于 v-if（同一元素上先遍历再判断）<br />
      ⚠️ Vue 3: v-if 优先于 v-for（同一元素上 v-if 无法访问 v-for 变量，会报错）
    </p>

    <!-- ====== 1. Vue 2 写法：v-for + v-if 同一元素 ====== -->
    <!-- Vue 2: 先遍历 items，每次迭代判断 item.active -->
    <!-- Vue 3: 不推荐，v-if 无法访问 item，应该拆分 -->
    <div class="section">
      <h3>1. v-for + v-if 同元素（Vue 2 写法）</h3>
      <ul>
        <li v-for="item in items" v-if="item.active" :key="item.id">
          {{ item.name }} — active
        </li>
      </ul>
    </div>

    <!-- ====== 2. 用计算属性替代（推荐，Vue 2 & 3 都适用）====== -->
    <div class="section">
      <h3>2. 计算属性过滤（兼容方案）</h3>
      <ul>
        <li v-for="item in activeItems" :key="item.id">
          {{ item.name }} — {{ item.status }}
        </li>
      </ul>
    </div>

    <!-- ====== 3. Vue 3 正确写法：template v-for + 内部 v-if ====== -->
    <div class="section">
      <h3>3. template v-for + 内部 v-if（Vue 3 正确写法）</h3>
      <ul>
        <template v-for="item in items" :key="item.id">
          <li v-if="item.active">
            {{ item.name }} — active (template 包裹)
          </li>
        </template>
      </ul>
    </div>

    <!-- ====== 4. template v-for + 多个子元素 + v-if ====== -->
    <div class="section">
      <h3>4. template v-for 多子元素 + v-if</h3>
      <div class="card-list">
        <template v-for="item in list" :key="item.id">
          <div v-if="item.show" class="card">
            <h4>{{ item.text }}</h4>
            <p>类型：{{ item.type }}</p>
            <button @click="toggleItem(item)">隐藏</button>
          </div>
        </template>
      </div>
    </div>

    <!-- ====== 5. v-for + v-if 不同优先级导致的问题演示 ====== -->
    <div class="section">
      <h3>5. 嵌套 v-for + v-if（安全写法）</h3>
      <div v-for="group in groups" :key="group.id" class="group">
        <h4>{{ group.title }}</h4>
        <ul>
          <template v-for="child in group.children" :key="child.id">
            <li v-if="child.visible">
              <span>{{ child.label }}</span>
              <small v-if="child.tag">[{{ child.tag }}]</small>
            </li>
          </template>
        </ul>
      </div>
    </div>

    <div class="actions">
      <button @click="addItem">添加项目</button>
      <button @click="toggleAll">全部切换 active</button>
      <button @click="shuffleList">打乱列表</button>
    </div>
  </div>
</template>

<script>
/**
 * v-for + v-if 优先级变化（Vue 2 → Vue 3）：
 *
 * Vue 2: v-for > v-if（先遍历再过滤，效率低但不报错）
 *   <li v-for="item in items" v-if="item.active"> ✓ 可运行
 *
 * Vue 3: v-if > v-for（v-if 先执行，无法访问 v-for 的 item 变量）
 *   <li v-for="item in items" v-if="item.active"> ✗ 报错/行为异常
 *
 * 迁移方案：
 *   1. 用计算属性预先过滤（最优）
 *   2. 用 <template v-for> 包裹，内部元素加 v-if
 */

export default {
  name: 'VForVIfPriority',
  data() {
    return {
      items: [
        { id: 1, name: '项目一', active: true, status: 'running' },
        { id: 2, name: '项目二', active: false, status: 'stopped' },
        { id: 3, name: '项目三', active: true, status: 'running' },
        { id: 4, name: '项目四', active: false, status: 'error' },
        { id: 5, name: '项目五', active: true, status: 'running' }
      ],
      list: [
        { id: 'a', text: '卡片A', type: 'info', show: true },
        { id: 'b', text: '卡片B', type: 'warning', show: false },
        { id: 'c', text: '卡片C', type: 'success', show: true },
        { id: 'd', text: '卡片D', type: 'danger', show: true }
      ],
      groups: [
        {
          id: 1,
          title: '第一组',
          children: [
            { id: 11, label: '子项 1-1', visible: true, tag: 'new' },
            { id: 12, label: '子项 1-2', visible: false, tag: '' },
            { id: 13, label: '子项 1-3', visible: true, tag: 'hot' }
          ]
        },
        {
          id: 2,
          title: '第二组',
          children: [
            { id: 21, label: '子项 2-1', visible: true, tag: '' },
            { id: 22, label: '子项 2-2', visible: true, tag: 'featured' }
          ]
        }
      ],
      nextId: 100
    }
  },
  computed: {
    // 推荐方案：计算属性替代 v-for + v-if
    activeItems() {
      return this.items.filter((item) => item.active)
    }
  },
  methods: {
    addItem() {
      this.nextId++
      this.items.push({
        id: this.nextId,
        name: '新项目' + this.nextId,
        active: true,
        status: 'running'
      })
    },
    toggleAll() {
      this.items.forEach((item) => {
        item.active = !item.active
      })
    },
    toggleItem(item) {
      item.show = !item.show
    },
    shuffleList() {
      this.list = this.list
        .map((v) => ({ v, r: Math.random() }))
        .sort((a, b) => a.r - b.r)
        .map((o) => o.v)
    }
  }
}
</script>

<style scoped>
.vfor-vif-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.vfor-vif-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.warning {
  padding: 12px;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  border-radius: 4px;
  color: #e6a23c;
  line-height: 1.8;
}
.section {
  margin: 20px 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}
.section h3 {
  margin-top: 0;
  color: #303133;
}
.card-list {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.card {
  padding: 12px;
  background: #fff;
  border: 1px solid #409eff;
  border-radius: 6px;
  min-width: 120px;
}
.card h4 {
  margin: 0 0 8px;
}
.group {
  margin-bottom: 16px;
}
.group h4 {
  color: #409eff;
}
.actions {
  margin-top: 16px;
}
.actions button {
  margin-right: 8px;
  padding: 6px 16px;
  cursor: pointer;
}
</style>
