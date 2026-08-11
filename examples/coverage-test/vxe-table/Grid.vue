<template>
  <div class="grid-demo">
    <h3>vxe-grid (高级表格 + 内置工具栏 + 分页)</h3>
    <vxe-grid
      ref="xGrid"
      :loading="loading"
      :columns="columns"
      :data="data"
      :height="600"
      :loading-config="loadingConfig"
      :toolbar-config="toolbarConfig"
      :pager-config="pagerConfig"
      :proxy-config="proxyConfig"
      :edit-rules="editRules"
      :checkbox-config="{ range: true }"
      :valid-config="{ message: 'tooltip' }"
      :row-config="{ keyField: 'id', isHover: true }"
      :sort-config="{ remote: true, trigger: 'cell' }"
      :filter-config="{ remote: true }"
      :column-config="{ resizable: true, drag: true }"
      :export-config="exportConfig"
      :print-config="printConfig"
      :import-config="importConfig"
      @toolbar-button-click="onToolbarClick"
      @toolbar-tool-click="onToolClick"
      @page-change="onPageChange"
      @sort-change="onSortChange"
      @filter-change="onFilterChange"
      @form-submit="onFormSubmit"
      @form-reset="onFormReset"
    >
      <!-- 自定义 toolbar 左侧按钮 -->
      <template #toolbar-tools>
        <vxe-button icon="fa fa-plus" @click="onAdd">新增</vxe-button>
        <vxe-button icon="fa fa-trash" status="danger" @click="onBatchDelete">批量删除</vxe-button>
        <vxe-button icon="fa fa-download" @click="onCustomExport">自定义导出</vxe-button>
      </template>

      <!-- 自定义 toolbar 右上角导入 -->
      <template #toolbar-import>
        <vxe-upload
          :multiple="false"
          :show-file-list="false"
          :auto-upload="false"
          @change="onImportFile"
        >
          <vxe-button>导入 CSV</vxe-button>
        </vxe-upload>
      </template>

      <!-- 自定义列渲染 (slot 形式) -->
      <template #name_default="{ row, rowIndex }">
        <a @click="onView(row)">{{ row.name }}</a>
      </template>

      <template #status_default="{ row }">
        <vxe-tag :status="row.status === 'active' ? 'success' : 'danger'">
          {{ row.status }}
        </vxe-tag>
      </template>

      <template #action_default="{ row, rowIndex }">
        <vxe-button mode="text" type="text" @click="onEdit(row)">编辑</vxe-button>
        <vxe-button mode="text" type="text" status="danger" @click="onDelete(row, rowIndex)">删除</vxe-button>
        <vxe-dropdown-menu>
          <vxe-dropdown-item @click="onCopy(row)">复制</vxe-dropdown-item>
          <vxe-dropdown-item @click="onArchive(row)">归档</vxe-dropdown-item>
          <vxe-dropdown-item divided @click="onDetail(row)">详情</vxe-dropdown-item>
        </vxe-dropdown-menu>
      </template>
    </vxe-grid>

    <h3>vxe-grid 完整功能: 表单 + 按钮 + 自定义操作</h3>
    <vxe-grid
      v-bind="fullGridOptions"
      @toolbar-button-click="onFullToolbarClick"
    >
      <template #toolbar-actions>
        <a-button @click="onCustom">自定义按钮</a-button>
      </template>
    </vxe-grid>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'  // v3 旧 CSS 路径

export default {
  name: 'VxeGrid',
  data() {
    return {
      loading: false,
      data: [],
      columns: [
        { type: 'seq', width: 60, fixed: 'left' },
        { type: 'checkbox', width: 50, fixed: 'left' },
        { type: 'expand', width: 50, fixed: 'left',
          slots: { content: 'expand_content' }
        },
        {
          field: 'name',
          title: '姓名',
          minWidth: 120,
          sortable: true,
          filters: [{ value: '张' }, { value: '李' }],
          editRender: { name: 'input', attrs: { placeholder: '请输入姓名' } },
          slots: { default: 'name_default' }
        },
        { field: 'age', title: '年龄', width: 100, sortable: true,
          editRender: { name: 'input', attrs: { type: 'number' } }
        },
        { field: 'email', title: '邮箱', minWidth: 180, editRender: { name: 'input' } },
        { field: 'role', title: '角色', width: 120,
          editRender: { name: 'select', options: [] },
          slots: { default: 'role_default', edit: 'role_edit' }
        },
        { field: 'status', title: '状态', width: 100,
          slots: { default: 'status_default' }
        },
        { field: 'createTime', title: '创建时间', width: 160, sortable: true,
          formatter: ({ cellValue }) => cellValue?.slice(0, 10) || ''
        },
        { title: '操作', width: 200, fixed: 'right',
          slots: { default: 'action_default' }
        }
      ],
      // 工具栏配置
      toolbarConfig: {
        buttons: [
          { code: 'insert', name: '新增', icon: 'fa fa-plus', status: 'primary' },
          { code: 'save', name: '保存', icon: 'fa fa-save', status: 'success' },
          { code: 'delete', name: '删除', icon: 'fa fa-trash', status: 'danger' }
        ],
        tools: [
          { code: 'export', name: '导出 CSV' },
          { code: 'print', name: '打印' },
          { code: 'refresh', name: '刷新' },
          { code: 'zoomIn', name: '全屏' }
        ],
        import: true,
        export: true,
        print: true,
        refresh: true,
        zoom: true,
        custom: true
      },
      // 分页配置
      pagerConfig: {
        total: 0,
        currentPage: 1,
        pageSize: 10,
        pageSizes: [5, 10, 20, 50, 100, 200],
        layout: 'total, sizes, prev, pager, next, jumper',
        background: true,
        autoHidden: false
      },
      // 代理配置 (远程数据)
      proxyConfig: {
        seq: true,
        sort: true,
        filter: true,
        form: true,
        props: {
          result: 'result',
          total: 'page.total'
        },
        ajax: {
          query: ({ page, sorts, filters, form }) => this.fetchData({ page, sorts, filters, form }),
          save: ({ body }) => this.saveRow(body),
          update: ({ body }) => this.updateRow(body),
          delete: ({ body }) => this.deleteRow(body)
        }
      },
      // 加载配置
      loadingConfig: {
        text: '加载中...',
        background: 'rgba(255,255,255,0.6)'
      },
      // 校验规则
      editRules: {
        name: [
          { required: true, message: '姓名必填' },
          { min: 2, max: 20, message: '长度 2-20' }
        ],
        age: [
          { required: true, message: '年龄必填' },
          { type: 'number', min: 0, max: 150, message: '年龄 0-150' }
        ],
        email: [
          { required: true, message: '邮箱必填' },
          { type: 'email', message: '邮箱格式错误' }
        ]
      },
      // 导出配置
      exportConfig: {
        filename: '用户列表',
        sheetName: 'Sheet1',
        type: 'csv',
        types: ['csv', 'html', 'xml', 'xlsx'],
        modes: ['current', 'selected', 'all'],
        columns: [
          { field: 'id', title: 'ID' },
          { field: 'name', title: '姓名' },
          { field: 'age', title: '年龄' }
        ]
      },
      // 打印配置
      printConfig: {
        columns: [
          { field: 'name', title: '姓名' },
          { field: 'age', title: '年龄' }
        ]
      },
      // 导入配置
      importConfig: {
        remote: false,
        types: ['csv', 'xlsx'],
        modes: ['insert', 'replace', 'overlay'],
        msgMode: 'modal',
        importMethod: ({ file }) => this.importMethod(file)
      },
      // 完整配置 (第二个 grid 用)
      fullGridOptions: {
        border: true,
        stripe: true,
        height: 500,
        columns: [
          { type: 'seq', width: 50 },
          { field: 'title', title: '标题', editRender: { name: 'input' } },
          { field: 'author', title: '作者' },
          { field: 'date', title: '日期', formatter: ({ cellValue }) => cellValue }
        ],
        data: [
          { id: 1, title: '文章 1', author: '张三', date: '2024-01-15' },
          { id: 2, title: '文章 2', author: '李四', date: '2024-02-20' }
        ],
        toolbarConfig: {
          buttons: [{ code: 'new', name: '新建' }],
          tools: [{ code: 'export', name: '导出' }]
        },
        pagerConfig: { total: 100, currentPage: 1, pageSize: 10 }
      }
    }
  },
  mounted() {
    this.fetchData({ page: { currentPage: 1, pageSize: 10 } })
  },
  beforeDestroy() {
    console.log('grid destroying')
  },
  methods: {
    async fetchData({ page, sorts, filters, form }) {
      this.loading = true
      try {
        // 模拟远程接口
        const res = await this.mockApi.list({ page, sorts, filters, form })
        this.data = res.list
        this.pagerConfig.total = res.total
      } finally {
        this.loading = false
      }
    },
    async saveRow(body) {
      return await this.mockApi.save(body)
    },
    async updateRow(body) {
      return await this.mockApi.update(body)
    },
    async deleteRow(body) {
      return await this.mockApi.delete(body)
    },
    onPageChange({ currentPage, pageSize }) {
      this.pagerConfig.currentPage = currentPage
      this.pagerConfig.pageSize = pageSize
      this.fetchData({ page: { currentPage, pageSize } })
    },
    onSortChange({ field, order }) {
      this.fetchData({ page: this.pagerConfig, sorts: [{ field, order }] })
    },
    onFilterChange(filters) {
      this.fetchData({ page: this.pagerConfig, filters })
    },
    onFormSubmit(form) {
      this.fetchData({ page: this.pagerConfig, form })
    },
    onFormReset() {
      this.fetchData({ page: { currentPage: 1, pageSize: 10 } })
    },
    onToolbarClick({ code, button }) {
      this.$message.info(`toolbar: ${code}`)
      if (code === 'insert') this.onAdd()
      if (code === 'delete') this.onBatchDelete()
    },
    onToolClick({ code, tool }) {
      if (code === 'refresh') this.fetchData({ page: this.pagerConfig })
    },
    onAdd() {
      this.data.unshift({
        id: Date.now(),
        name: '新员工',
        age: 25,
        email: 'new@example.com',
        role: 'user',
        status: 'active',
        createTime: new Date().toISOString()
      })
    },
    onBatchDelete() {
      const $grid = this.$refs.xGrid
      const records = $grid.getCheckboxRecords()
      if (!records.length) {
        this.$message.warning('请勾选数据')
        return
      }
      this.$confirm({
        title: '确认删除',
        content: `删除 ${records.length} 条?`,
        onOk: () => {
          this.data = this.data.filter(r => !records.find(rr => rr.id === r.id))
          this.$message.success('已删除')
        }
      })
    },
    onCustomExport() {
      const $grid = this.$refs.xGrid
      $grid.exportData({
        filename: '用户列表',
        type: 'xlsx',
        columns: this.columns.filter(c => c.field)
      })
    },
    onImportFile({ file }) {
      const $grid = this.$refs.xGrid
      $grid.importData({
        file,
        types: ['xlsx', 'csv'],
        modes: 'insert'
      })
    },
    onFullToolbarClick({ code }) {
      this.$message.info(`full toolbar: ${code}`)
    },
    onView(row) { this.$message.info(`查看 ${row.name}`) },
    onEdit(row) { this.$message.info(`编辑 ${row.name}`) },
    onDelete(row, idx) {
      this.$confirm({
        title: '确认',
        content: `删除 ${row.name}?`,
        onOk: () => {
          this.data.splice(idx, 1)
          this.$message.success('已删除')
        }
      })
    },
    onCopy(row) { this.$message.success(`复制 ${row.name}`) },
    onArchive(row) { this.$message.warning(`归档 ${row.name}`) },
    onDetail(row) { this.$message.info(`详情 ${row.name}`) },
    onCustom() { this.$message.info('自定义按钮') },
    importMethod(file) {
      // 解析 CSV / XLSX
      console.log('import', file.name)
      return new Promise(resolve => {
        setTimeout(() => {
          this.data.push({ id: Date.now(), name: '导入用户', age: 30, status: 'active' })
          resolve()
        }, 500)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.grid-demo { padding: 16px; }
</style>
