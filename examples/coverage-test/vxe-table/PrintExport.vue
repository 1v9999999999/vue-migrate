<template>
  <div class="print-export">
    <h3>打印 / 导出 / 自定义列控制</h3>
    <vxe-toolbar
      :refresh="{ query: fetchData }"
      :export="{ filename: '用户数据', type: 'xlsx', sheetName: 'Sheet1', types: ['xlsx', 'csv', 'html', 'xml'] }"
      :print="{ columns: printColumns, beforePrintMethod: beforePrint }"
      :import="{ importMethod: onImport }"
      :custom="{ columns: customColumns, restoreMethod: restoreMethod }"
      :perfect="{ enabled: true }"
    />

    <vxe-table
      ref="xTable"
      :data="tableData"
      :height="500"
      :print-config="printConfig"
      :export-config="exportConfig"
      :import-config="importConfig"
      :custom-config="{ storage: true }"
    >
      <vxe-table-column type="seq" width="60" />
      <vxe-table-column field="id" title="ID" width="80" />
      <vxe-table-column field="name" title="姓名" min-width="120" />
      <vxe-table-column field="age" title="年龄" width="100" />
      <vxe-table-column field="email" title="邮箱" min-width="180" />
      <vxe-table-column field="role" title="角色" width="120" />
      <vxe-table-column field="department" title="部门" width="120" />
      <vxe-table-column field="salary" title="薪资" width="100" :formatter="formatSalary" />
      <vxe-table-column field="joinDate" title="入职日期" width="120" :formatter="formatDate" />
      <vxe-table-column field="status" title="状态" width="100" :formatter="formatStatus" />
    </vxe-table>

    <h3>自定义操作 (列控制 / 打印 / 导出 CSV)</h3>
    <vxe-button @click="onPrint">打印</vxe-button>
    <vxe-button @click="onExportCsv">导出 CSV</vxe-button>
    <vxe-button @click="onExportXlsx">导出 XLSX</vxe-button>
    <vxe-button @click="onExportSelected">导出选中</vxe-button>
    <vxe-button @click="onCustomColumns">自定义列</vxe-button>
    <vxe-button @click="onClearCustom">清空自定义</vxe-button>
    <vxe-button @click="onResetCustom">重置自定义</vxe-button>
    <vxe-button @click="onGetColumns">获取列</vxe-button>

    <h3>vxe-upload (上传 + 文件列表)</h3>
    <vxe-upload
      :multiple="true"
      :max-count="5"
      :show-file-list="true"
      :auto-upload="false"
      :accept="'image/*,.pdf,.docx'"
      :list-type="'text'"
      :name="'file'"
      :headers="uploadHeaders"
      :drop-config="dropConfig"
      @before-upload="onBeforeUpload"
      @upload-progress="onUploadProgress"
      @upload-success="onUploadSuccess"
      @upload-error="onUploadError"
      @file-change="onFileChange"
      @file-remove="onFileRemove"
    >
      <vxe-button>选择文件</vxe-button>
    </vxe-upload>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxePrintExport',
  data() {
    return {
      tableData: [],
      printColumns: [
        { field: 'name', title: '姓名' },
        { field: 'age', title: '年龄' },
        { field: 'email', title: '邮箱' }
      ],
      customColumns: [
        { field: 'id', title: 'ID' },
        { field: 'name', title: '姓名' },
        { field: 'age', title: '年龄' },
        { field: 'email', title: '邮箱' },
        { field: 'role', title: '角色' },
        { field: 'department', title: '部门' },
        { field: 'salary', title: '薪资' },
        { field: 'joinDate', title: '入职日期' },
        { field: 'status', title: '状态' }
      ],
      printConfig: {
        beforePrintMethod: this.beforePrint,
        afterPrintMethod: this.afterPrint
      },
      exportConfig: {
        filename: '用户数据',
        sheetName: 'Sheet1',
        type: 'xlsx',
        types: ['xlsx', 'csv', 'html'],
        modes: ['current', 'selected', 'all'],
        beforeExportMethod: this.beforeExport,
        columnFilterMethod: this.columnFilterMethod
      },
      importConfig: {
        remote: false,
        types: ['xlsx', 'csv'],
        modes: 'insert',
        msgMode: 'modal',
        importMethod: this.importMethod
      },
      uploadHeaders: {
        Authorization: 'Bearer xxx'
      },
      dropConfig: {
        dnd: true,
        dndEl: 'body'
      }
    }
  },
  mounted() {
    this.fetchData()
  },
  beforeDestroy() {
    console.log('print-export destroying')
  },
  methods: {
    fetchData() {
      this.tableData = [
        { id: 1, name: '张三', age: 28, email: 'zhang@example.com', role: 'admin', department: '技术部', salary: 25000, joinDate: '2020-01-15', status: 'active' },
        { id: 2, name: '李四', age: 35, email: 'li@example.com', role: 'user', department: '产品部', salary: 22000, joinDate: '2019-05-20', status: 'inactive' },
        { id: 3, name: '王五', age: 42, email: 'wang@example.com', role: 'editor', department: '运营部', salary: 30000, joinDate: '2018-08-10', status: 'active' },
        { id: 4, name: '赵六', age: 26, email: 'zhao@example.com', role: 'user', department: '市场部', salary: 18000, joinDate: '2021-03-25', status: 'pending' },
        { id: 5, name: '钱七', age: 31, email: 'qian@example.com', role: 'admin', department: '技术部', salary: 28000, joinDate: '2019-11-12', status: 'active' }
      ]
    },
    onPrint() {
      this.$refs.xTable.print()
    },
    onExportCsv() {
      this.$refs.xTable.exportData({ filename: 'data', type: 'csv' })
    },
    onExportXlsx() {
      this.$refs.xTable.exportData({ filename: 'data', type: 'xlsx' })
    },
    onExportSelected() {
      const records = this.$refs.xTable.getCheckboxRecords()
      if (!records.length) {
        this.$message.warning('请勾选')
        return
      }
      this.$refs.xTable.exportData({
        filename: 'selected',
        type: 'xlsx',
        data: records
      })
    },
    onCustomColumns() {
      // 触发自定义列弹窗
      this.$message.info('打开列设置')
    },
    onClearCustom() {
      this.$refs.xTable.clearCustomStore()
    },
    onResetCustom() {
      this.$refs.xTable.resetCustomStore()
    },
    onGetColumns() {
      const cols = this.$refs.xTable.getColumns()
      console.log('columns:', cols)
    },
    onBeforeUpload({ file, option }) {
      console.log('before upload', file.name)
    },
    onUploadProgress({ file, progress }) {
      console.log('progress', file.name, progress)
    },
    onUploadSuccess({ file, response }) {
      console.log('success', file.name)
    },
    onUploadError({ file, error }) {
      console.log('error', file.name)
    },
    onFileChange({ file, fileList }) {
      console.log('file change', fileList.length)
    },
    onFileRemove({ file, fileList }) {
      console.log('file remove', file.name)
    },
    beforePrint({ options }) {
      return new Promise(resolve => {
        setTimeout(() => {
          options.columns.push({ field: 'salary', title: '薪资' })
          resolve(options)
        }, 200)
      })
    },
    afterPrint() {
      this.$message.success('打印完成')
    },
    beforeExport({ options }) {
      return options
    },
    columnFilterMethod({ column }) {
      return column.field !== 'id'
    },
    restoreMethod({ storeData, customColumns }) {
      return customColumns
    },
    onImport({ file }) {
      return new Promise(resolve => {
        setTimeout(() => {
          this.tableData.push({ id: Date.now(), name: '导入', age: 25, status: 'active' })
          resolve()
        }, 500)
      })
    },
    importMethod({ file, options }) {
      return new Promise(resolve => {
        setTimeout(() => {
          this.$message.success(`导入 ${file.name}`)
          resolve()
        }, 500)
      })
    },
    formatSalary({ cellValue }) {
      return `¥${cellValue?.toLocaleString() || 0}`
    },
    formatDate({ cellValue }) {
      return cellValue || '-'
    },
    formatStatus({ cellValue }) {
      return { active: '在职', inactive: '离职', pending: '试用期' }[cellValue] || cellValue
    }
  }
}
</script>

<style lang="scss" scoped>
.print-export { padding: 16px; }
</style>
