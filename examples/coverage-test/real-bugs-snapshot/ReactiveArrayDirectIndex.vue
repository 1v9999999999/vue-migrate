<template>
  <div class="direct-index-demo">
    <h2>直接下标赋值响应式失效</h2>

    <!--
      真实 bug 场景:
      Vue 2:
        - 重写 Array.prototype.push/pop/shift/unshift/splice/sort/reverse
        - 通过 Object.defineProperty(arr, '0', { ... }) hack 下标赋值
        - 数组下标赋值会触发响应式 (有性能损耗)
      Vue 3:
        - 用 Proxy 包装数组
        - 下标赋值 arr[i] = x 不会触发 length 变化
        - 不会自动响应, 必须 splice 或整体替换

      业务危害:
        - 列表项更新不渲染
        - 难调试 (有时灵有时不灵, 取决于之前是否触发过 push)
        - 性能测试结果不一致
    -->

    <h3>当前 list:</h3>
    <ul>
      <li v-for="(item, i) in list" :key="i">
        [{{ i }}]: {{ item }}
      </li>
    </ul>

    <div class="actions">
      <button @click="update(0)">update list[0] (direct)</button>
      <button @click="updateSplice(0)">update list[0] (splice)</button>
      <button @click="updateAll">整体替换</button>
      <button @click="pushItem">push</button>
      <button @click="reset">reset</button>
    </div>

    <hr />

    <h3>对象数组 (常见坑)</h3>
    <ul>
      <li v-for="user in users" :key="user.id">
        {{ user.name }} ({{ user.role }})
        <button @click="renameUser(user.id)">rename</button>
      </li>
    </ul>

    <hr />

    <p class="warning">
      ⚠️ Vue 2: this.list[0] = x 触发响应式
      Vue 3: 必须 splice 或 this.list = [...this.list]
    </p>
  </div>
</template>

<script>
/**
 * 数组下标赋值响应式失效 真实 bug 复现
 *
 * Vue 2 实现 (源码片段):
 *   function defineReactive(obj, key, val) {
 *     Object.defineProperty(obj, key, { ... })
 *   }
 *   // 监听数组每个下标
 *   if (Array.isArray(value)) {
 *     value.__proto__ = arrayMethods  // 重写原型方法
 *     for (let i = 0; i < value.length; i++) {
 *       defineReactive(value, i, value[i])
 *     }
 *   }
 *
 * Vue 3 实现:
 *   const observed = new Proxy(arr, {
 *     get(target, key) { ... track(...) },
 *     set(target, key, val) { ... trigger(...) }
 *   })
 *   // 但 arr[0] = x 的 set trap 不会触发 length 依赖
 *   // 因为依赖收集时只 track 了 length getter, set 不算变更
 *
 * 修复方案:
 *   - arr.splice(i, 1, x)         // 修改 length
 *   - arr[i] = x; arr.length = x  // 强制更新
 *   - this.arr = [...this.arr]    // 整体替换
 *   - this.$set(arr, i, x)        // Vue 2 兼容 (Vue 3 仍有但无副作用)
 */

let _id = 100
const nextId = () => ++_id

export default {
  name: 'ReactiveArrayDirectIndex',
  data() {
    return {
      list: [1, 2, 3, 4, 5],
      users: [
        { id: 1, name: 'alice', role: 'admin' },
        { id: 2, name: 'bob', role: 'user' },
        { id: 3, name: 'carol', role: 'guest' }
      ]
    }
  },
  methods: {
    /**
     * Vue 2: 触发响应式
     * Vue 3: 不触发 (Proxy 不监听下标赋值对 length 的影响)
     */
    update(index) {
      // ❌ Vue 3 不会更新 UI
      this.list[index] = 999
    },
    /**
     * 通用: splice 修改 length
     */
    updateSplice(index) {
      // ✅ 通用
      this.list.splice(index, 1, 999)
    },
    updateAll() {
      // ✅ 整体替换
      this.list = this.list.map(x => x * 10)
    },
    pushItem() {
      this.list.push(this.list.length + 1)
    },
    reset() {
      this.list = [1, 2, 3, 4, 5]
    },
    /**
     * 对象数组: rename
     */
    renameUser(id) {
      const idx = this.users.findIndex(u => u.id === id)
      if (idx >= 0) {
        // ❌ Vue 3: this.users[idx].name = 'x' 实际会触发 (对象属性, Proxy 监听)
        // ✅ 但 v-for 依赖了 users 数组本身, 所以需要 splice
        // this.users[idx].name = 'new-' + Date.now()
        // ✅ 推荐
        this.users.splice(idx, 1, { ...this.users[idx], name: 'new-' + Date.now() })
      }
    },
    addUser() {
      this.users.push({ id: nextId(), name: 'new', role: 'user' })
    }
  }
}
</script>

<style scoped>
.direct-index-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.direct-index-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.direct-index-demo h3 {
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
  display: flex;
  gap: 8px;
  align-items: center;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 8px 0;
}
button {
  padding: 4px 12px;
  cursor: pointer;
  font-size: 13px;
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
