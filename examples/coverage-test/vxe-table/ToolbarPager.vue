<template>
  <div class="toolbar-pager">
    <h3>vxe-toolbar (独立工具栏)</h3>
    <vxe-toolbar
      :buttons="toolbarButtons"
      :tools="toolbarTools"
      :refresh="{ query: fetchData }"
      :import="{ importMethod: onImportMethod }"
      :export="{ filename: '数据', type: 'csv' }"
      :print="{ columns: printColumns }"
      :custom="{ columns: customColumns }"
      :perfect="{ enabled: true }"
      custom-button-position="right"
      size="medium"
      @button-click="onButtonClick"
      @tool-click="onToolClick"
    >
      <template #buttons>
        <vxe-button icon="fa fa-plus" status="primary" @click="onAdd">新增</vxe-button>
        <vxe-button icon="fa fa-save" status="success" @click="onSave">保存</vxe-button>
        <vxe-button icon="fa fa-trash" status="danger" @click="onBatchDel">批量删除</vxe-button>
      </template>
      <template #tools>
        <vxe-input v-model="searchText" placeholder="搜索" clearable style="width: 200px" />
        <vxe-button @click="onSearch">搜索</vxe-button>
      </template>
    </vxe-toolbar>

    <vxe-table
      :data="filteredData"
      :loading="loading"
      :height="400"
      @cell-click="onCellClick"
    >
      <vxe-table-column type="seq" width="60" />
      <vxe-table-column type="checkbox" width="50" />
      <vxe-table-column field="name" title="姓名" sortable />
      <vxe-table-column field="age" title="年龄" sortable />
      <vxe-table-column field="role" title="角色" />
      <vxe-table-column field="status" title="状态" />
    </vxe-table>

    <h3>vxe-pager (独立分页)</h3>
    <vxe-pager
      :total="pagerConfig.total"
      :current-page="pagerConfig.currentPage"
      :page-size="pagerConfig.pageSize"
      :page-sizes="pagerConfig.pageSizes"
      :layout="pagerConfig.layout"
      :background="true"
      :auto-hidden="false"
      :perfect="true"
      :class-name="'custom-pager'"
      :size="'medium'"
      @page-change="onPageChange"
    >
      <template #left>
        <span class="pager-info">共 {{ pagerConfig.total }} 条, 选中 {{ selectedCount }} 条</span>
      </template>
      <template #right>
        <a-button size="small" @click="onExport">导出</a-button>
      </template>
    </vxe-pager>

    <h3>vxe-pager 简单模式</h3>
    <vxe-pager
      :total="100"
      :current-page="1"
      :page-size="10"
      :simple="true"
      @page-change="onPageChange"
    />

    <h3>vxe-pager 完整功能 (slot 注入)</h3>
    <vxe-pager
      :total="pagerConfig.total"
      :current-page="pagerConfig.currentPage"
      :page-size="pagerConfig.pageSize"
      :layouts="['PrevJump', 'PrevPage', 'Number', 'NextPage', 'NextJump', 'Sizes', 'FullJump', 'Total']"
      @page-change="onPageChange"
    />
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxeToolbarPager',
  data() {
    return {
      loading: false,
      searchText: '',
      selectedCount: 0,
      allData: [
        { id: 1, name: 'A1', age: 25, role: 'admin', status: 'active' },
        { id: 2, name: 'A2', age: 30, role: 'user', status: 'inactive' },
        { id: 3, name: 'B1', age: 35, role: 'editor', status: 'active' },
        { id: 4, name: 'B2', age: 40, role: 'user', status: 'active' },
        { id: 5, name: 'C1', age: 28, role: 'admin', status: 'pending' }
      ],
      pagerConfig: {
        total: 100,
        currentPage: 1,
        pageSize: 10,
        pageSizes: [5, 10, 20, 50],
        layout: 'total, sizes, prev, pager, next, jumper'
      },
      toolbarButtons: [
        { code: 'add', name: '新增', icon: 'fa fa-plus' },
        { code: 'edit', name: '编辑', icon: 'fa fa-edit' },
        { code: 'delete', name: '删除', icon: 'fa fa-trash' }
      ],
      toolbarTools: [
        { code: 'refresh', name: '刷新', icon: 'fa fa-refresh' },
        { code: 'export', name: '导出' },
        { code: 'print', name: '打印' },
        { code: 'custom', name: '列设置' }
      ],
      printColumns: [
        { field: 'name', title: 'Name' },
        { field: 'age', title: 'Age' }
      ],
      customColumns: [
        { field: 'name', title: 'Name' },
        { field: 'age', title: 'Age' },
        { field: 'role', title: 'Role' },
        { field: 'status', title: 'Status' }
      ]
    }
  },
  computed: {
    filteredData() {
      if (!this.searchText) return this.allData
      return this.allData.filter(r => r.name.includes(this.searchText))
    }
  },
  mounted() {
    this.fetchData()
  },
  methods: {
    fetchData() {
      this.loading = true
      setTimeout(() => {
        this.loading = false
      }, 500)
    },
    onButtonClick({ code, button, $event }) {
      this.$message.info(`button: ${code}`)
    },
    onToolClick({ code, tool }) {
      this.$message.info(`tool: ${code}`)
    },
    onAdd() {
      this.allData.unshift({ id: Date.now(), name: 'New', age: 25, role: 'user', status: 'active' })
    },
    onSave() {
      this.$message.success('已保存')
    },
    onBatchDel() {
      this.$message.warning('批量删除')
    },
    onSearch() {
      this.$message.info(`搜索: ${this.searchText}`)
    },
    onCellClick({ row, column }) {
      console.log('cell click', row[column.field])
    },
    onImportMethod({ file }) {
      this.$message.success(`导入 ${file.name}`)
      return Promise.resolve()
    },
    onPageChange({ currentPage, pageSize }) {
      this.pagerConfig.currentPage = currentPage
      this.pagerConfig.pageSize = pageSize
      this.fetchData()
    },
    onExport() {
      this.$message.success('导出')
    }
  },
  beforeDestroy() {
    console.log('toolbar-pager destroying')
  }
}
</script>

<style lang="scss" scoped>
.toolbar-pager { padding: 16px; }
.pager-info { margin-right: 12px; color: #666; }
.custom-pager { padding: 8px; background: #fafafa; }
</style>
