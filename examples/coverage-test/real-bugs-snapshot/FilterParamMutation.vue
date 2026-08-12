<template>
  <div class="filter-demo">
    <h2>v-for filter 参数 + mutation (Vue 3 删除 filter)</h2>

    <!--
      真实 bug 场景:
      Vue 2 在 v-for 中可以用 filter, filter 函数会接收到原数组,
      业务代码常常:
        1. 在 filter 内 mutation 数组 — 副作用
        2. 依赖 filter 缓存 (实际上没有, 每次都重算)
        3. filter 内引用 this 拿不到 data
      Vue 3:
        - 移除 filter, 改用 method 或 computed
        - computed 自带缓存, 推荐

      业务危害:
        - filter 内 mutation 原数组导致 v-for 状态错位
        - 性能差 (每次 render 都重算 filter)
        - 测试困难
    -->

    <h3>1. 错误写法: filter 内 mutation 数组</h3>
    <ul>
      <li v-for="item in filterItems(allItems, 'active')" :key="item.id">
        {{ item.name }} - {{ item.status }}
      </li>
    </ul>
    <p class="warning">
      ⚠️ Vue 2 filter 函数在每次 render 时执行, 内部 mutation 会污染原数组
    </p>

    <hr />

    <h3>2. Vue 3 迁移: 改用 method</h3>
    <ul>
      <li v-for="item in getActiveItems(allItems)" :key="item.id">
        {{ item.name }} - {{ item.status }}
      </li>
    </ul>

    <hr />

    <h3>3. Vue 3 迁移: 改用 computed (带缓存)</h3>
    <ul>
      <li v-for="item in activeItems" :key="item.id">
        {{ item.name }} - {{ item.status }}
      </li>
    </ul>

    <hr />

    <h3>4. 链式 filter 模拟 (filter 在管道中)</h3>
    <p>{{ formatName(user) }}</p>
  </div>
</template>

<script>
/**
 * filter mutation 真实 bug 复现
 *
 * Vue 2 filter 机制:
 *   - 局部: filters: { ... }
 *   - 全局: Vue.filter('name', fn)
 *   - 编译: {{ x | name | name2 }} → _s(_f("name2")(_f("name")(x)))
 *   - v-bind/v-for 中也支持: v-for="x in list | filter"
 *
 * Vue 3 改动:
 *   - 移除 filter 选项
 *   - 移除全局 Vue.filter
 *   - 迁移: method 或 computed
 *
 * 真实 bug 案例:
 *   filters: {
 *     active(items) {
 *       // ❌ mutation 原数组, 副作用
 *       return items.filter(i => i.status === 'active').splice(0, 1, {})
 *     }
 *   }
 */

export default {
  name: 'FilterParamMutation',
  data() {
    return {
      allItems: [
        { id: 1, name: '任务 1', status: 'active' },
        { id: 2, name: '任务 2', status: 'inactive' },
        { id: 3, name: '任务 3', status: 'active' },
        { id: 4, name: '任务 4', status: 'archived' }
      ],
      user: { firstName: '张', lastName: '三' }
    }
  },
  filters: {
    // ⚠️ Vue 2 filter, Vue 3 已删除
    // 此处故意写错模式: 拼接 splice 返回 mutation 结果
    filterItems(items, status) {
      if (!Array.isArray(items)) return []
      // ❌ 错误: 直接 mutation, 副作用
      const filtered = items.filter(i => i.status === status)
      // 模拟业务错误: 在 filter 内 splice
      // filtered.splice(0, 1, {})  // 不写出来, 仅说明
      return filtered
    },
    formatName(user) {
      if (!user) return ''
      return `${user.lastName}${user.firstName}`
    }
  },
  computed: {
    /**
     * Vue 3 推荐: computed 带缓存
     */
    activeItems() {
      return this.allItems.filter(i => i.status === 'active')
    }
  },
  methods: {
    /**
     * Vue 3 推荐: method 替代 filter
     */
    getActiveItems(items) {
      return items.filter(i => i.status === 'active')
    }
  }
}
</script>

<style scoped>
.filter-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.filter-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.filter-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
ul {
  list-style: none;
  padding: 0;
}
li {
  padding: 6px 8px;
  border-bottom: 1px solid #ebeef5;
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
