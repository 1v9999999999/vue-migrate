<template>
  <div class="filters-demo">
    <h2>Filters 过滤器示例（Vue 3 已移除，需改为方法或计算属性）</h2>

    <!-- 基本 filter 用法 -->
    <p>原始消息：{{ msg }}</p>
    <p>大写：{{ msg | upper }}</p>

    <!-- 带参数的 filter -->
    <p>日期：{{ date }}</p>
    <p>格式化年份：{{ date | format('YYYY') }}</p>
    <p>格式化完整：{{ date | format('YYYY-MM-DD') }}</p>

    <!-- money filter -->
    <p>价格：{{ price | money('$') }}</p>
    <p>价格（人民币）：{{ price | money('¥') }}</p>

    <!-- 链式 filter：先 upper 再 truncate -->
    <p>链式过滤：{{ msg | upper | truncate(10) }}</p>
    <p>长文本链式：{{ longText | upper | truncate(20) }}</p>

    <!-- 在 v-bind 中使用 filter -->
    <input :placeholder="msg | upper" :class="'input-' + (status | upper)" />

    <!-- filter 在 v-for 中 -->
    <ul>
      <li v-for="item in items" :key="item.id">
        {{ item.name | upper }} — {{ item.price | money('€') }}
      </li>
    </ul>

    <button @click="changeData">更换数据</button>
  </div>
</template>

<script>
/**
 * Vue 2 filters 语法：
 * - 在 template 中用管道符 | 调用
 * - filters 选项中定义局部 filter
 * - Vue.filter() 注册全局 filter（见 main.js）
 *
 * Vue 3 迁移注意：
 * - filters 被完全移除
 * - 需改为 methods、computed 或普通函数调用
 * - {{ msg | upper }} → {{ upper(msg) }}
 * - 链式 {{ msg | upper | truncate(10) }} → {{ truncate(upper(msg), 10) }}
 */

// 全局 filter 的定义（通常在 main.js 中）
// Vue.filter('truncate', function (value, length) {
//   if (!value) return ''
//   const str = String(value)
//   return str.length > length ? str.slice(0, length) + '...' : str
// })
// 本文件中用局部 filter 模拟全局 filter 的行为，确保单文件可运行

export default {
  name: 'Filters',
  data() {
    return {
      msg: 'hello vue filters',
      longText: 'this is a very long text for testing chained filters',
      date: '2024-03-15T10:30:00',
      price: 99.5,
      status: 'active',
      items: [
        { id: 1, name: 'apple', price: 5.5 },
        { id: 2, name: 'banana', price: 3.2 },
        { id: 3, name: 'orange', price: 7.8 }
      ]
    }
  },
  filters: {
    // 无参数 filter
    upper(value) {
      if (!value) return ''
      return String(value).toUpperCase()
    },
    // 带一个参数的 filter
    format(value, fmt) {
      if (!value) return ''
      const d = new Date(value)
      if (isNaN(d.getTime())) return value
      const map = {
        YYYY: d.getFullYear(),
        MM: String(d.getMonth() + 1).padStart(2, '0'),
        DD: String(d.getDate()).padStart(2, '0')
      }
      return fmt.replace(/YYYY|MM|DD/g, (m) => map[m])
    },
    // 带参数的 filter（货币格式化）
    money(value, symbol) {
      if (value === null || value === undefined) return ''
      const num = Number(value)
      if (isNaN(num)) return ''
      return symbol + num.toFixed(2)
    },
    // 模拟全局 truncate filter（实际应通过 Vue.filter 注册）
    truncate(value, length) {
      if (!value) return ''
      const str = String(value)
      return str.length > length ? str.slice(0, length) + '...' : str
    }
  },
  methods: {
    changeData() {
      this.msg = 'updated message ' + Date.now()
      this.longText = 'changed long text at ' + new Date().toISOString()
      this.price = Math.random() * 100
      this.items.push({
        id: this.items.length + 1,
        name: 'grape',
        price: Math.random() * 10
      })
    }
  }
}
</script>

<style scoped>
.filters-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.filters-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.filters-demo p {
  margin: 8px 0;
  padding: 4px 8px;
  background: #f5f7fa;
  border-radius: 4px;
}
.filters-demo input {
  padding: 6px 10px;
  margin: 8px 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.filters-demo button {
  margin-top: 12px;
  padding: 8px 20px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
