<template>
  <div class="slot-scope-demo">
    <h2>旧 Slot 语法示例（Vue 2 → Vue 3 迁移）</h2>

    <!-- ====== 1. 旧具名 slot：slot="name" ====== -->
    <!-- Vue 3: 改为 v-slot:name 或 #name，且必须在 <template> 上 -->
    <Card>
      <template slot="header">
        <h3>这是通过 slot="header" 传入的标题</h3>
      </template>
      <template slot="footer">
        <span>这是通过 slot="footer" 传入的页脚</span>
      </template>
      <p>默认 slot 内容</p>
    </Card>

    <!-- ====== 2. slot-scope 旧语法（scoped slot）====== -->
    <!-- Vue 3: 改为 v-slot:default="props" 或 #default="props" -->
    <DataList :items="items">
      <template slot-scope="props">
        <div class="item-row">
          <span>#{{ props.index }}</span>
          <span>{{ props.item.name }}</span>
          <span>{{ props.item.price }}</span>
        </div>
      </template>
    </DataList>

    <!-- ====== 3. 解构 slot-scope ====== -->
    <DataList :items="items">
      <template slot-scope="{ item, index }">
        <div class="item-row destructure">
          <strong>{{ index }}: {{ item.name }}</strong>
          <em>{{ item.price }}</em>
        </div>
      </template>
    </DataList>

    <!-- ====== 4. 非 template 元素上的 slot 属性 ====== -->
    <!-- Vue 3: 不再支持在普通元素上使用 slot 属性，必须用 <template> -->
    <Card>
      <div slot="header">
        <span>直接在 div 上用 slot="header"（Vue 3 不支持）</span>
      </div>
      <p slot="content">在 p 标签上用 slot="content"</p>
      <span>默认内容</span>
    </Card>

    <!-- ====== 5. 新语法 v-slot（Vue 2.6+ 也支持，Vue 3 唯一合法）====== -->
    <DataList :items="items">
      <template v-slot:default="props">
        <div class="item-row new-syntax">
          <span>[新语法] {{ props.item.name }} - {{ props.item.price }}</span>
        </div>
      </template>
    </DataList>

    <!-- ====== 6. 具名 + scoped slot 混合 ====== -->
    <Layout>
      <template v-slot:sidebar="slotProps">
        <nav class="sidebar-nav">
          <a v-for="link in slotProps.links" :key="link.id" :href="link.url">
            {{ link.text }}
          </a>
        </nav>
      </template>
      <template #main="{ title, content }">
        <article>
          <h4>{{ title }}</h4>
          <p>{{ content }}</p>
        </article>
      </template>
    </Layout>
  </div>
</template>

<script>
/* eslint-disable vue/no-deprecated-slot-attribute, vue/no-deprecated-slot-scope-attribute */

/**
 * Vue 2 旧 slot 语法覆盖：
 * 1. slot="name" — 旧具名 slot，Vue 3 改为 v-slot:name / #name
 * 2. slot-scope="props" — 旧 scoped slot，Vue 3 改为 v-slot:default="props"
 * 3. 解构 slot-scope="{ id, name }" — Vue 3 解构 v-slot
 * 4. 非 template 元素上的 slot 属性 — Vue 3 完全移除
 * 5. v-slot 新语法 — Vue 2.6+ 和 Vue 3 都支持
 */

const Card = {
  name: 'Card',
  template: [
    '<div class="card-comp">',
    '  <div class="card-header"><slot name="header"></slot></div>',
    '  <div class="card-content"><slot name="content"></slot><slot></slot></div>',
    '  <div class="card-footer"><slot name="footer"></slot></div>',
    '</div>'
  ].join('\n')
}

const DataList = {
  name: 'DataList',
  props: {
    items: { type: Array, default: () => [] }
  },
  template: [
    '<div class="data-list-comp">',
    '  <div v-for="(item, index) in items" :key="item.id">',
    '    <slot :item="item" :index="index"></slot>',
    '  </div>',
    '</div>'
  ].join('\n')
}

const Layout = {
  name: 'Layout',
  data() {
    return {
      sidebarLinks: [
        { id: 1, text: '首页', url: '/' },
        { id: 2, text: '关于', url: '/about' },
        { id: 3, text: '联系', url: '/contact' }
      ]
    }
  },
  template: [
    '<div class="layout-comp">',
    '  <aside><slot name="sidebar" :links="sidebarLinks"></slot></aside>',
    '  <main><slot name="main" :title="pageTitle" :content="pageContent"></slot></main>',
    '</div>'
  ].join('\n'),
  data2() {
    return {}
  },
  computed: {
    pageTitle() {
      return '页面标题'
    },
    pageContent() {
      return '页面内容文本'
    }
  }
}

export default {
  name: 'SlotScope',
  components: { Card, DataList, Layout },
  data() {
    return {
      items: [
        { id: 1, name: '商品A', price: 100 },
        { id: 2, name: '商品B', price: 200 },
        { id: 3, name: '商品C', price: 300 }
      ]
    }
  }
}
</script>

<style scoped>
.slot-scope-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.slot-scope-demo h2 {
  color: #67c23a;
  margin-top: 0;
}
.item-row {
  display: flex;
  gap: 16px;
  padding: 8px;
  border-bottom: 1px solid #eee;
}
.item-row.destructure {
  background: #f0f9eb;
}
.item-row.new-syntax {
  background: #ecf5ff;
}
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sidebar-nav a {
  color: #409eff;
  text-decoration: none;
}
</style>
