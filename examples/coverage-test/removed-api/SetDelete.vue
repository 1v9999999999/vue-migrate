<template>
  <div class="set-delete">
    <h3>Set / Delete Demo</h3>
    <p>对象属性: {{ JSON.stringify(obj) }}</p>
    <p>嵌套属性: {{ JSON.stringify(obj.nested) }}</p>
    <p>数组: {{ JSON.stringify(list) }}</p>

    <button @click="addProp">this.$set 添加对象属性</button>
    <button @click="addNested">this.$set 添加嵌套属性</button>
    <button @click="updateArrayIndex">this.$set 数组索引赋值</button>
    <button @click="removeProp">this.$delete 删除属性</button>
    <button @click="vueSetStatic">Vue.set 静态方法</button>
  </div>
</template>

<script>
import Vue from 'vue'

export default {
  name: 'SetDelete',
  data() {
    return {
      obj: {
        existing: 'initial',
        nested: {
          inner: 1
        }
      },
      list: ['a', 'b', 'c'],
      staticTarget: {}
    }
  },
  methods: {
    // this.$set(this.obj, 'key', value) 添加响应式属性
    addProp() {
      this.$set(this.obj, 'newKey', Date.now())
    },
    // 嵌套 this.$set(this.obj.nested, 'key', val)
    addNested() {
      this.$set(this.obj.nested, 'nestedKey', 'nested-value')
    },
    // this.$set(this.list, index, value) 数组索引赋值
    updateArrayIndex() {
      this.$set(this.list, 1, 'updated-' + Date.now())
    },
    // this.$delete(this.obj, 'key') 删除属性
    removeProp() {
      if ('existing' in this.obj) {
        this.$delete(this.obj, 'existing')
      }
    },
    // Vue.set(obj, key, val) 静态方法
    vueSetStatic() {
      Vue.set(this.staticTarget, 'staticKey', 'static-val')
      // Vue.delete(obj, key) 静态方法
      Vue.delete(this.staticTarget, 'staticKey')
    }
  }
}
</script>

<style scoped>
.set-delete {
  padding: 16px;
  border: 1px solid #eee;
}
.set-delete button {
  margin-right: 8px;
  margin-bottom: 4px;
}
</style>
