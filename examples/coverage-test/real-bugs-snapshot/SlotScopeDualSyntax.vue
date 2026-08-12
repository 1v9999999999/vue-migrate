<template>
  <div class="slot-dual-demo">
    <h2>slot-scope 旧语法 + v-slot 新语法混用</h2>

    <!--
      真实 bug 场景:
      Vue 2.6 之前: 用 slot="name" + slot-scope="props"
      Vue 2.6+ 引入: v-slot:name="props" 或 #name="props"
      Vue 3: 移除 slot / slot-scope 语法, 仅保留 v-slot

      混用危害:
        - 同一模板里两种语法, 渲染时只有一种生效
        - 旧代码 review 时容易误判作用域
        - Vue 3 升级后旧语法直接报错
    -->

    <h3>1. 旧语法: slot + slot-scope (Vue 2 / Vue 3 仍兼容)</h3>
    <MyList :items="items">
      <template slot="item" slot-scope="props">
        [旧] {{ props.item.name }} - {{ props.index }}
      </template>
    </MyList>

    <hr />

    <h3>2. 新语法: v-slot:#name (Vue 2.6+ / Vue 3 推荐)</h3>
    <MyList :items="items">
      <template #item="{ item, index }">
        [新] {{ item.name }} - {{ index }}
      </template>
    </MyList>

    <hr />

    <h3>3. 具名 slot + 缩写混用</h3>
    <MyLayout>
      <template #header>
        <h4>Header</h4>
      </template>
      <template #default>
        <p>Default content</p>
      </template>
      <template #footer="{ close }">
        <button @click="close">Close (scoped slot)</button>
      </template>
    </MyLayout>

    <hr />

    <h3>4. 旧 slot="default" 写法 (混用示例)</h3>
    <MyLayout>
      <p slot="header">Header (旧语法)</p>
      <p slot="footer">Footer (旧语法, 但无法拿到 close)</p>
    </MyLayout>

    <hr />

    <p class="warning">
      ⚠️ Vue 3 完全移除 slot="x" 和 slot-scope="props", 只能用 v-slot
      迁移: slot-scope="props" → v-slot:default="props" 或 #default="props"
    </p>
  </div>
</template>

<script>
/**
 * slot 语法双写法 真实 bug 复现
 *
 * Vue 2 slot 演进:
 *   - 2.5-:  <template slot="header"></template>
 *            <template slot-scope="props"></template>
 *   - 2.6+:  <template v-slot:header></template>
 *            <template v-slot:default="props"></template>
 *            <template #header></template>     // 缩写
 *            <template #default="props"></template>
 *   - 3.0:   仅 v-slot, 移除 slot="x" 和 slot-scope
 *
 * 真实 bug 案例:
 *   1. slot="default" 写错成 slot="Default" (大小写敏感)
 *   2. slot-scope="props" 中 props 与子组件提供的不一致
 *   3. 混用 # 缩写和 v-slot: 显式, ESLint 报错
 */

const MyList = {
  name: 'MyList',
  props: { items: { type: Array, default: () => [] } },
  template: `
    <ul class="my-list">
      <li v-for="(item, index) in items" :key="item.id">
        <slot name="item" :item="item" :index="index">
          [默认] {{ item.name }}
        </slot>
      </li>
    </ul>
  `
}

const MyLayout = {
  name: 'MyLayout',
  data() {
    return { open: true }
  },
  methods: {
    close() {
      this.open = false
      this.$emit('close')
    }
  },
  template: `
    <div class="my-layout" v-if="open">
      <header><slot name="header">默认 header</slot></header>
      <main><slot>默认内容</slot></main>
      <footer>
        <slot name="footer" :close="close">默认 footer</slot>
      </footer>
    </div>
  `
}

export default {
  name: 'SlotScopeDualSyntax',
  components: { MyList, MyLayout },
  data() {
    return {
      items: [
        { id: 1, name: 'Vue 2 迁移' },
        { id: 2, name: 'slot 语法' },
        { id: 3, name: 'v-slot 推荐' }
      ]
    }
  }
}
</script>

<style scoped>
.slot-dual-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.slot-dual-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.slot-dual-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
.my-list {
  list-style: none;
  padding: 0;
}
.my-list li {
  padding: 6px 8px;
  border-bottom: 1px solid #ebeef5;
}
.my-layout {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
  background: #f5f7fa;
}
.my-layout header {
  font-weight: bold;
  color: #409eff;
  margin-bottom: 8px;
}
.my-layout main {
  margin: 8px 0;
  color: #303133;
}
.my-layout footer {
  border-top: 1px solid #ebeef5;
  padding-top: 8px;
  margin-top: 8px;
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
