<template>
  <div class="basic-table">
    <h3>基础 vxe-table + vxe-table-column (Vue 2 旧 API)</h3>
    <vxe-table
      :data="tableData"
      :loading="loading"
      :height="500"
      :max-height="600"
      :stripe="true"
      :border="true"
      :round="true"
      :size="size"
      :align="align"
      :header-align="headerAlign"
      :show-header="true"
      :show-overflow="true"
      :show-footer="true"
      :footer-method="footerMethod"
      :merge-cells="mergeCells"
      :row-class-name="rowClassName"
      :cell-class-name="cellClassName"
      :seq-config="{ startIndex: 1 }"
      :sort-config="{ trigger: 'cell', defaultSort: { field: 'age', order: 'desc' } }"
      :filter-config="{ remote: false }"
      :radio-config="{ highlight: true }"
      :checkbox-config="{ range: true, highlight: true }"
      :tooltip-config="{ theme: 'dark', enterable: true }"
      :mouse-config="{ selected: true, area: true }"
      :keyboard-config="{ isArrow: true, isDel: true, isTab: true, isEdit: true }"
      :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true }"
      :valid-config="{ message: 'inline' }"
      :menu-config="{ visibleMethod: onMenuVisible }"
      :column-config="{ resizable: true, drag: true, useKey: true }"
      :row-config="{ keyField: 'id', isHover: true, isCurrent: true, useKey: true }"
      :scroll-x="{ gt: 20 }"
      :scroll-y="{ gt: 30 }"
      @cell-click="onCellClick"
      @cell-dblclick="onCellDblClick"
      @row-click="onRowClick"
      @row-dblclick="onRowDblClick"
      @header-cell-click="onHeaderClick"
      @sort-change="onSortChange"
      @filter-change="onFilterChange"
      @current-change="onCurrentChange"
      @selection-change="onSelectionChange"
      @radio-change="onRadioChange"
      @checkbox-change="onCheckboxChange"
      @checkbox-all="onCheckboxAll"
      @edit-closed="onEditClosed"
      @edit-actived="onEditActived"
      @menu-click="onMenuClick"
      @scroll="onScroll"
      @resizable-change="onResizableChange"
    >
      <!-- type=seq 序号列 -->
      <vxe-table-column type="seq" width="60" fixed="left" />

      <!-- type=checkbox 复选列 -->
      <vxe-table-column type="checkbox" width="50" fixed="left" />

      <!-- type=radio 单选列 -->
      <vxe-table-column type="radio" width="50" fixed="left" />

      <!-- type=expand 展开行 -->
      <vxe-table-column type="expand" width="50" fixed="left">
        <template #content="{ row, rowIndex }">
          <div class="expand-content">
            <h4>{{ row.name }} 详细</h4>
            <p>ID: {{ row.id }}</p>
            <p>年龄: {{ row.age }}</p>
            <p>邮箱: {{ row.email }}</p>
            <p>rowIndex: {{ rowIndex }}</p>
          </div>
        </template>
      </vxe-table-column>

      <!-- 普通列 + filter + sort -->
      <vxe-table-column field="name" title="姓名" min-width="120" sortable :filters="nameFilters" :filter-multiple="true">
        <template #header>
          <span style="color: #1890ff">姓名 (自定义)</span>
        </template>
        <template #default="{ row, rowIndex }">
          <a-tag color="blue">{{ row.name }}</a-tag>
          <a-icon type="user" />
        </template>
        <template #filter="{ column, checked }">
          <input type="text" v-model="filterName" @input="onFilterNameChange(column, $event.target.value)" />
        </template>
      </vxe-table-column>

      <vxe-table-column field="age" title="年龄" width="100" sortable :sort-by="['age', 'name']">
        <template #default="{ row }">
          <span :class="{ 'age-senior': row.age > 50 }">{{ row.age }}</span>
        </template>
      </vxe-table-column>

      <vxe-table-column field="email" title="邮箱" min-width="180" show-overflow="title" />

      <vxe-table-column field="address" title="地址" min-width="200" show-overflow="ellipsis">
        <template #default="{ row }">
          <a-tooltip :title="row.address">
            <span>{{ row.address }}</span>
          </a-tooltip>
        </template>
      </vxe-table-column>

      <!-- 可编辑列 (edit-render) -->
      <vxe-table-column field="status" title="状态" width="120" :edit-render="{ name: 'input', options: { placeholder: '请输入' } }">
        <template #default="{ row }">
          <a-tag :color="statusColor(row.status)">{{ row.status }}</a-tag>
        </template>
        <template #edit="{ row }">
          <vxe-input v-model="row.status" />
        </template>
      </vxe-table-column>

      <!-- 自定义筛选 dropdown -->
      <vxe-table-column field="role" title="角色" width="120" :filters="roleFilters" :filter-render="{ name: 'select', options: roleOptions }" />

      <!-- 日期列 (格式化 + sortable) -->
      <vxe-table-column field="createTime" title="创建时间" width="160" sortable :formatter="formatDate" />

      <!-- 操作列 (fixed right) -->
      <vxe-table-column title="操作" width="200" fixed="right">
        <template #default="{ row, rowIndex }">
          <a-button size="small" @click="onEdit(row)">编辑</a-button>
          <a-divider type="vertical" />
          <a-button size="small" type="danger" @click="onDelete(row, rowIndex)">删除</a-button>
          <a-divider type="vertical" />
          <a-dropdown>
            <a class="ant-dropdown-link" @click="e => e.preventDefault()">
              更多 <a-icon type="down" />
            </a>
            <a-menu slot="overlay">
              <a-menu-item @click="onView(row)">查看</a-menu-item>
              <a-menu-item @click="onCopy(row)">复制</a-menu-item>
              <a-menu-divider />
              <a-menu-item @click="onArchive(row)">归档</a-menu-item>
            </a-menu>
          </a-dropdown>
        </template>
      </vxe-table-column>

      <!-- 合计行 footer (跟 footer-method 配合) -->
      <template #footer>
        <div style="padding: 8px; text-align: right; background: #fafafa">
          共 {{ tableData.length }} 条数据
        </div>
      </template>
    </vxe-table>

    <h3>分组表头 (group-config)</h3>
    <vxe-table :data="tableData" :height="300" :group-config="{ mergeMethod }">
      <vxe-table-column title="基本信息">
        <vxe-table-column field="name" title="姓名" width="120" />
        <vxe-table-column field="age" title="年龄" width="100" />
      </vxe-table-column>
      <vxe-table-column title="联系方式">
        <vxe-table-column field="email" title="邮箱" min-width="180" />
        <vxe-table-column field="phone" title="电话" width="140" />
      </vxe-table-column>
      <vxe-table-column field="status" title="状态" width="120" />
    </vxe-table>

    <h3>loading + 错误 + 空数据</h3>
    <vxe-table :loading="loading" :data="emptyData" :empty-text="'暂无数据'">
      <vxe-table-column field="id" title="ID" />
      <vxe-table-column field="name" title="Name" />
    </vxe-table>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'  // v3 旧 CSS 路径, vue-migrate plugin 会改
import XEUtils from 'xe-utils'

export default {
  name: 'VxeBasicTable',
  data() {
    return {
      loading: false,
      size: 'medium',
      align: 'left',
      headerAlign: 'center',
      filterName: '',
      tableData: [
        { id: 1, name: '张三', age: 28, email: 'zhang@example.com', phone: '13800000001', address: '北京朝阳区', status: 'active', role: 'admin', createTime: '2024-01-15 10:30:00' },
        { id: 2, name: '李四', age: 35, email: 'li@example.com', phone: '13800000002', address: '上海浦东新区', status: 'inactive', role: 'user', createTime: '2024-02-20 14:00:00' },
        { id: 3, name: '王五', age: 42, email: 'wang@example.com', phone: '13800000003', address: '深圳南山区', status: 'active', role: 'editor', createTime: '2024-03-10 09:15:00' },
        { id: 4, name: '赵六', age: 56, email: 'zhao@example.com', phone: '13800000004', address: '广州天河区', status: 'pending', role: 'user', createTime: '2024-04-05 16:45:00' },
        { id: 5, name: '钱七', age: 19, email: 'qian@example.com', phone: '13800000005', address: '杭州西湖区', status: 'active', role: 'guest', createTime: '2024-05-12 11:20:00' }
      ],
      emptyData: [],
      nameFilters: [
        { label: '包含 张', value: '张' },
        { label: '包含 李', value: '李' }
      ],
      roleFilters: [
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
        { label: '编辑', value: 'editor' }
      ],
      roleOptions: [
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
        { label: '编辑', value: 'editor' },
        { label: '访客', value: 'guest' }
      ],
      mergeCells: [
        { row: 0, col: 1, rowspan: 1, colspan: 2 }
      ]
    }
  },
  computed: {
    // 完整数据
    summaryData() {
      const total = this.tableData.length
      const avgAge = XEUtils.mean(this.tableData, 'age')
      return [
        { name: '合计', age: avgAge, count: total }
      ]
    }
  },
  created() {
    // 故意做引用,确保 VXETable 不被 import-cleaner 干掉
    this.$nextTick(() => {
      const col = VXETable.types
      console.log('vxe-table version:', col)
    })
  },
  methods: {
    onCellClick({ row, column, rowIndex, columnIndex, $event }) {
      this.$message.info(`cell ${rowIndex},${columnIndex}: ${row[column.field]}`)
    },
    onCellDblClick({ row, column, rowIndex }) {
      this.$message.info(`dblclick row ${rowIndex}`)
    },
    onRowClick({ row, rowIndex }) {
      console.log('row click', rowIndex, row)
    },
    onRowDblClick({ row, rowIndex }) {
      console.log('row dblclick', rowIndex, row)
    },
    onHeaderClick({ column, columnIndex }) {
      this.$message.info(`header ${columnIndex}: ${column.title}`)
    },
    onSortChange({ field, order, property, sortList, column }) {
      console.log('sort', field, order)
    },
    onFilterChange({ filters, filterList }) {
      console.log('filter', filters)
    },
    onCurrentChange({ currentRow, currentRowIndex, oldRow, oldRowIndex }) {
      console.log('current changed', currentRow)
    },
    onSelectionChange({ selection, checked, row }) {
      console.log('selection', selection.length)
    },
    onRadioChange({ newValue, oldValue, row, rowIndex }) {
      console.log('radio', newValue)
    },
    onCheckboxChange({ checked, row, rowIndex, $rowIndex }) {
      console.log('checkbox', checked, row)
    },
    onCheckboxAll({ checked, selection }) {
      console.log('all', checked, selection.length)
    },
    onEditClosed({ row, column }) {
      this.$message.success(`保存 ${row.name} 的 ${column.title}`)
    },
    onEditActived({ row, column }) {
      console.log('edit actived', column.field)
    },
    onMenuClick({ menu, row, rowIndex, column }) {
      this.$message.info(`menu: ${menu.code} on row ${rowIndex}`)
    },
    onScroll({ scrollTop, scrollLeft, isX, isY }) {
      // 滚动埋点
    },
    onResizableChange({ column, columnIndex, resizeWidth, columnWidth }) {
      console.log('resize', column.field, resizeWidth)
    },
    onMenuVisible({ menu, row, rowIndex, column }) {
      if (menu.code === 'copy' && row.status === 'inactive') return false
      return true
    },
    onEdit(row) {
      this.$message.info(`编辑 ${row.name}`)
    },
    onDelete(row, idx) {
      this.$confirm({
        title: '确认删除',
        content: `${row.name}?`,
        onOk: () => {
          this.tableData.splice(idx, 1)
          this.$message.success('已删除')
        }
      })
    },
    onView(row) { this.$message.info(`查看 ${row.name}`) },
    onCopy(row) {
      this.$message.success(`复制 ${row.name}`)
    },
    onArchive(row) {
      row.status = 'archived'
      this.$forceUpdate()  // Vue 2 旧, Vue 3 用 ref/reactive
    },
    onFilterNameChange(column, val) {
      const checked = val ? [val] : []
      column.filters.forEach(f => f.checked = false)
      this.$message.info(`filter: ${val}`)
    },
    statusColor(status) {
      return {
        active: 'green', inactive: 'red', pending: 'orange', archived: 'gray'
      }[status] || 'blue'
    },
    formatDate({ cellValue, row, column }) {
      return XEUtils.toDateString(cellValue, 'yyyy-MM-dd')
    },
    footerMethod({ columns, data }) {
      return [
        columns.map((column, columnIndex) => {
          if (columnIndex === 0) {
            return '合计'
          }
          if (column.field === 'age') {
            return XEUtils.mean(data, 'age').toFixed(1)
          }
          if (column.field === 'name') {
            return `共 ${data.length} 条`
          }
          return ''
        })
      ]
    },
    rowClassName({ row, rowIndex }) {
      return row.age > 50 ? 'row-senior' : ''
    },
    cellClassName({ row, column }) {
      if (column.field === 'status' && row.status === 'inactive') {
        return 'cell-inactive'
      }
      return ''
    },
    mergeMethod({ columns, data }) {
      return { rowspan: 1, colspan: 1 }
    }
  },
  beforeDestroy() {
    // Vue 2.x 旧 lifecycle, vue-migrate plugin 会改 beforeUnmount
    console.log('basic-table destroying')
  }
}
</script>

<style lang="scss" scoped>
.basic-table { padding: 16px; }
.age-senior { color: #f50; font-weight: bold; }
.row-senior { background: #fffbe6 !important; }
.cell-inactive { color: #999; text-decoration: line-through; }
.expand-content { padding: 12px; background: #fafafa; }
</style>
