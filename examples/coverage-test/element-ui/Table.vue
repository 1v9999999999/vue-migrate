<!--
  element-ui/Table.vue — Table + TableColumn 穷举
  iter-090 P3 验证: stripe / border / size / fixed / sortable / filter / selection / expand / index / tree / lazy
-->
<template>
  <div>
    <h2>Table 组件</h2>

    <!-- 1. 基础表格 -->
    <el-table :data="rows" stripe border height="400">
      <el-table-column type="selection" width="55" />
      <el-table-column type="index" label="#" width="60" />
      <el-table-column prop="id" label="ID" width="80" sortable />
      <el-table-column prop="name" label="姓名" sortable :sort-method="sortByName" />
      <el-table-column prop="age" label="年龄" sortable :filters="ageFilters" :filter-method="filterAge" />
      <el-table-column prop="status" label="状态" :filters="statusFilters" :filter-method="filterStatus">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="头像" width="80">
        <template #default="{ row }">
          <el-avatar :src="row.avatar" :alt="row.name" />
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="180" sortable />
      <el-table-column prop="tags" label="标签" filterable>
        <template #default="{ row }">
          <el-tag v-for="t in row.tags" :key="t" size="mini">{{ t }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row, $index }">
          <el-button type="text" @click="onView(row)">查看</el-button>
          <el-button type="text" @click="onEdit(row)">编辑</el-button>
          <el-button type="text" @click="onDelete(row, $index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 2. 多选 + 全选 (selection) -->
    <el-table
      :data="rows"
      ref="multiTable"
      @selection-change="onSelectionChange"
      @select-all="onSelectAll"
    >
      <el-table-column type="selection" />
      <el-table-column prop="name" label="姓名" />
    </el-table>
    <el-button @click="onToggleSelection">切换第二行选中</el-button>
    <el-button @click="onClearSelection">清空选择</el-button>

    <!-- 3. 固定列 -->
    <el-table :data="rows" border>
      <el-table-column prop="id" label="ID" fixed="left" width="80" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="desc" label="描述" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button>Edit</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 4. 展开行 (expand) -->
    <el-table :data="rows">
      <el-table-column type="expand">
        <template #default="{ row }">
          <p>姓名: {{ row.name }}</p>
          <p>详情: {{ row.desc }}</p>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="姓名" />
    </el-table>

    <!-- 5. 树形 (tree) -->
    <el-table :data="treeData" row-key="id" :tree-props="{ children: 'children' }">
      <el-table-column prop="name" label="名称" />
    </el-table>

    <!-- 6. 懒加载 (lazy) -->
    <el-table :data="lazyData" row-key="id" lazy :load="loadRow" :tree-props="{ children: 'children', hasChildren: 'hasChildren' }">
      <el-table-column prop="name" label="名称" />
    </el-table>

    <!-- 7. summary 合计行 -->
    <el-table :data="rows" show-summary :summary-method="getSummaries">
      <el-table-column prop="id" label="ID" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="score" label="分数" />
    </el-table>
  </div>
</template>

<script>
export default {
  data() {
    return {
      rows: [
        { id: 1, name: 'Alice', age: 25, status: 'active', avatar: 'a.png', createTime: '2024-01-01', tags: ['vip', 'new'], desc: '前端开发' },
        { id: 2, name: 'Bob', age: 30, status: 'inactive', avatar: 'b.png', createTime: '2024-01-02', tags: ['vip'], desc: '后端开发' }
      ],
      treeData: [{
        id: 1, name: 'Root',
        children: [
          { id: 2, name: 'Child 1' },
          { id: 3, name: 'Child 2' }
        ]
      }],
      lazyData: [],
      ageFilters: [
        { text: '< 30', value: 0 },
        { text: '>= 30', value: 1 }
      ],
      statusFilters: [
        { text: 'Active', value: 'active' },
        { text: 'Inactive', value: 'inactive' }
      ],
      multipleSelection: []
    }
  },
  methods: {
    onView(row) { console.log('view', row) },
    onEdit(row) { console.log('edit', row) },
    onDelete(row, idx) { this.rows.splice(idx, 1) },
    sortByName(a, b) { return a.name.localeCompare(b.name) },
    filterAge(value, row) { return value === 0 ? row.age < 30 : row.age >= 30 },
    filterStatus(value, row) { return row.status === value },
    onSelectionChange(rows) { this.multipleSelection = rows },
    onSelectAll(rows) { console.log('all', rows) },
    onToggleSelection() {
      this.$refs.multiTable.toggleRowSelection(this.rows[1])
    },
    onClearSelection() { this.$refs.multiTable.clearSelection() },
    loadRow(row, treeNode, resolve) {
      // 异步加载子节点
      setTimeout(() => resolve([{ id: row.id + 100, name: 'Lazy Child' }]), 500)
    },
    getSummaries({ columns, data }) {
      return ['合计', '', data.reduce((sum, r) => sum + r.score, 0)]
    }
  }
}
</script>
