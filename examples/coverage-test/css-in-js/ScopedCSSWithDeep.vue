<template>
  <div class="container">
    <h2>Vue scoped + :deep() / ::v-deep</h2>

    <!--
      真实集成场景:
      Vue scoped 默认给当前组件所有元素加 [data-v-xxx] 属性选择器,
      子组件根元素会被加上, 但子组件内部不会被加.
      穿透子组件样式需要:
        Vue 2: ::v-deep / /deep/ (旧)
        Vue 3: :deep() (推荐, 统一了写法)
        Vue 2.7+: :deep() 也 work (向后兼容)

      子组件 slot 内的元素:
        Vue 3: :slotted() (新增, 用于 scoped slot 内的子组件根)
        Vue 2: 不支持
    -->

    <h3>Element UI 表格深度样式穿透</h3>
    <el-table :data="tableData" border>
      <el-table-column prop="name" label="Name" width="180" />
      <el-table-column prop="status" label="Status" width="120" />
      <el-table-column prop="remark" label="Remark" />
    </el-table>

    <hr />

    <h3>通用子组件穿透</h3>
    <CustomButton type="primary">Primary</CustomButton>
    <CustomButton>Default</CustomButton>

    <hr />

    <h3>scoped slot 内的子组件根 (:slotted)</h3>
    <MyList :items="items">
      <template #default="{ item }">
        <div class="slot-item">{{ item.name }}</div>
      </template>
    </MyList>

    <hr />

    <p class="note">
      ✅ 完整 API:
      <br />1. &lt;style scoped&gt; → 组件作用域
      <br />2. ::v-deep / :deep() → 穿透子组件
      <br />3. :slotted(.x) → slot 内子组件根 (Vue 3)
      <br />4. :global(.x) → 全局 (Vue 3)
    </p>
  </div>
</template>

<script>
/**
 * Scoped CSS + :deep() / :slotted() 集成
 *
 * 关键点:
 *   - Vue 2: ::v-deep 与 :deep() 都支持, 但官方推荐 ::v-deep
 *   - Vue 3: 仅推荐 :deep(), 移除 ::v-deep
 *   - Vue 2.7+: 双语法兼容
 *
 * 选择器对比:
 *   .parent :deep(.child) { ... }        // Vue 3 推荐
 *   .parent ::v-deep .child { ... }      // Vue 2 旧
 *   .parent /deep/ .child { ... }        // 废弃
 *   :slotted(.child) { ... }             // Vue 3 slot 内
 *   :global(.x) { ... }                  // Vue 3 全局
 */

const CustomButton = {
  name: 'CustomButton',
  props: { type: { type: String, default: 'default' } },
  template: `
    <button class="custom-btn" :class="'btn-' + type">
      <slot />
    </button>
  `
}

const MyList = {
  name: 'MyList',
  props: { items: { type: Array, default: () => [] } },
  template: `
    <ul class="my-list-ul">
      <li v-for="item in items" :key="item.id">
        <slot :item="item">{{ item.name }}</slot>
      </li>
    </ul>
  `
}

export default {
  name: 'ScopedCSSWithDeep',
  components: { CustomButton, MyList },
  data() {
    return {
      tableData: [
        { name: 'Alice', status: 'active', remark: '管理员' },
        { name: 'Bob', status: 'inactive', remark: '普通用户' },
        { name: 'Carol', status: 'active', remark: '审核员' }
      ],
      items: [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]
    }
  }
}
</script>

<!--
  scoped 样式:
  - 自动给所有规则加 [data-v-xxx]
  - :deep() 让选择器穿透到子组件
  - :slotted() 应用于 slot 内容
-->
<style scoped>
.container {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.container h2 {
  color: #e6a23c;
  margin-top: 0;
}
.container h3 {
  color: #409eff;
  margin-top: 16px;
}

/* ===== Vue 2 旧 ::v-deep (Vue 3 仍兼容, 但推荐 :deep()) ===== */
.container ::v-deep .el-table__header {
  background: #f5f5f5;
  color: #303133;
}

.container ::v-deep .el-table .cell {
  padding: 0 10px;
}

/* ===== Vue 3 :deep() (推荐) ===== */
.container :deep(.el-table__row) {
  background: #fafafa;
}

.container :deep(.el-table__row:hover > td) {
  background: #ecf5ff !important;
}

/* 嵌套选择器 */
.container :deep(.el-table .cell) {
  padding: 0 10px;
  font-size: 13px;
}

/* :slotted (Vue 3 新增, scoped slot 子组件根) */
:slotted(.slot-item) {
  margin: 8px;
  padding: 8px 12px;
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
  color: #2c6e4f;
}

/* 自定义子组件穿透 */
:deep(.custom-btn) {
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 8px;
}
:deep(.btn-primary) {
  background: #409eff;
  color: white;
}
:deep(.btn-default) {
  background: white;
  color: #606266;
  border: 1px solid #dcdfe6;
}

.my-list-ul {
  list-style: none;
  padding: 0;
}
.my-list-ul li {
  padding: 4px 0;
}

.note {
  background: #fdf6ec;
  border: 1px solid #faecd8;
  color: #b88230;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  font-family: monospace;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
