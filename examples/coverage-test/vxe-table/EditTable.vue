<template>
  <div class="edit-table">
    <h3>可编辑表格 (edit-render + 7 控件类型)</h3>
    <vxe-table
      ref="xTable"
      :data="tableData"
      :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true, autoClear: false }"
      :valid-config="{ message: 'tooltip' }"
      :edit-rules="validRules"
      :mouse-config="{ area: true }"
      :keyboard-config="{ isArrow: true, isDel: true, isTab: true, isEdit: true }"
      :clip-config="{ isCopy: true, isCut: true, isPaste: true }"
      :area-config="{ multiple: true, areaLimit: 4 }"
      :copy-config="{ delimiter: '\t' }"
      @edit-closed="onEditClosed"
      @edit-actived="onEditActived"
      @edit-disabled="onEditDisabled"
    >
      <vxe-table-column type="seq" width="60" fixed="left" />
      <vxe-table-column field="checkbox" type="checkbox" width="50" fixed="left" />

      <!-- vxe-input -->
      <vxe-table-column field="name" title="姓名" min-width="120"
        :edit-render="{ name: 'input', attrs: { placeholder: '请输入' }, events: { input: onNameInput } }">
        <template #edit="{ row, rowIndex }">
          <vxe-input v-model="row.name" />
        </template>
        <template #default="{ row }">
          <span>{{ row.name }}</span>
        </template>
      </vxe-table-column>

      <!-- vxe-input-number -->
      <vxe-table-column field="age" title="年龄" width="100"
        :edit-render="{ name: 'inputNumber', props: { min: 0, max: 150 } }" />

      <!-- vxe-select -->
      <vxe-table-column field="role" title="角色" width="120"
        :edit-render="{ name: 'select', options: roleOptions }">
        <template #default="{ row }">
          <vxe-tag :status="roleStatus(row.role)">{{ row.role }}</vxe-tag>
        </template>
      </vxe-table-column>

      <!-- vxe-date-picker -->
      <vxe-table-column field="birthday" title="生日" width="160"
        :edit-render="{ name: 'datePicker', props: { type: 'date', format: 'yyyy-MM-dd' } }" />

      <!-- vxe-checkbox -->
      <vxe-table-column field="isActive" title="激活" width="80"
        :edit-render="{ name: 'checkbox' }">
        <template #default="{ row }">
          <vxe-checkbox v-model="row.isActive"></vxe-checkbox>
        </template>
      </vxe-table-column>

      <!-- vxe-switch -->
      <vxe-table-column field="enable" title="开关" width="80"
        :edit-render="{ name: 'switch' }">
        <template #default="{ row }">
          <vxe-switch v-model="row.enable" open-label="ON" close-label="OFF"></vxe-switch>
        </template>
      </vxe-table-column>

      <!-- vxe-radio-group -->
      <vxe-table-column field="gender" title="性别" width="100"
        :edit-render="{ name: 'radioGroup', options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] }" />

      <!-- vxe-textarea (大段文字) -->
      <vxe-table-column field="remark" title="备注" min-width="200"
        :edit-render="{ name: 'textarea', attrs: { autosize: { minRows: 2, maxRows: 4 } } }" />

      <!-- 操作列 (手动触编辑) -->
      <vxe-table-column title="操作" width="200" fixed="right">
        <template #default="{ row, rowIndex }">
          <vxe-button mode="text" type="text" @click="onEditRow(row, rowIndex)">编辑</vxe-button>
          <vxe-button mode="text" type="text" status="danger" @click="onDeleteRow(rowIndex)">删除</vxe-button>
          <vxe-button mode="text" type="text" @click="onValidateRow(row)">校验</vxe-button>
        </template>
      </vxe-table-column>
    </vxe-table>

    <h3>编辑操作按钮 (新增 / 批量保存 / 批量删除 / 校验全部)</h3>
    <vxe-button status="primary" @click="onAddRow">新增</vxe-button>
    <vxe-button status="success" @click="onSave">保存所有</vxe-button>
    <vxe-button status="danger" @click="onBatchDelete">批量删除</vxe-button>
    <vxe-button @click="onValidateAll">校验全部</vxe-button>
    <vxe-button @click="onRevert">撤销修改</vxe-button>
    <vxe-button @click="onClearAll">清空表格</vxe-button>

    <h3>可编辑 (row 模式 + insert) + 自定义 toolbar</h3>
    <vxe-grid
      :columns="insertColumns"
      :data="[]"
      :edit-config="{ trigger: 'manual', mode: 'row', showStatus: true }"
      :toolbar-config="{ buttons: [{ code: 'insert', name: '新增行', icon: 'fa fa-plus' }] }"
      @toolbar-button-click="onInsert"
    >
    </vxe-grid>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxeEditTable',
  data() {
    return {
      tableData: [
        { id: 1, name: '张三', age: 25, role: 'admin', birthday: '1999-01-15', isActive: true, enable: true, gender: 'male', remark: '第一行备注' },
        { id: 2, name: '李四', age: 30, role: 'user', birthday: '1994-05-20', isActive: true, enable: false, gender: 'female', remark: '第二行' },
        { id: 3, name: '王五', age: 35, role: 'editor', birthday: '1989-08-10', isActive: false, enable: true, gender: 'male', remark: '第三行' },
        { id: 4, name: '赵六', age: 28, role: 'user', birthday: '1996-12-25', isActive: true, enable: true, gender: 'female', remark: '第四行' }
      ],
      validRules: {
        name: [{ required: true, message: '姓名必填' }],
        age: [
          { required: true, message: '年龄必填' },
          { type: 'number', min: 0, max: 150, message: '年龄 0-150' }
        ]
      },
      roleOptions: [
        { label: '管理员', value: 'admin' },
        { label: '用户', value: 'user' },
        { label: '编辑', value: 'editor' },
        { label: '访客', value: 'guest' }
      ],
      insertColumns: [
        { type: 'seq', width: 50 },
        { field: 'name', title: '姓名', editRender: { name: 'input' } },
        { field: 'age', title: '年龄', editRender: { name: 'inputNumber' } },
        { field: 'action', title: '操作', width: 200, slots: { default: 'insertAction' } }
      ]
    }
  },
  methods: {
    onEditRow(row, rowIndex) {
      this.$refs.xTable.setActiveRow(row)
    },
    onDeleteRow(rowIndex) {
      this.$confirm({
        title: '确认删除',
        onOk: () => {
          this.tableData.splice(rowIndex, 1)
          this.$message.success('已删除')
        }
      })
    },
    onValidateRow(row) {
      this.$refs.xTable.validate(row).then(() => {
        this.$message.success(`${row.name} 校验通过`)
      }).catch(errMap => {
        this.$message.error('校验失败')
      })
    },
    onAddRow() {
      const newRow = {
        id: Date.now(),
        name: '',
        age: 18,
        role: 'user',
        birthday: '',
        isActive: false,
        enable: false,
        gender: 'male',
        remark: ''
      }
      this.tableData.unshift(newRow)
      this.$nextTick(() => this.$refs.xTable.setActiveRow(newRow))
    },
    onSave() {
      this.$refs.xTable.validate().then(() => {
        this.$message.success('全部校验通过, 保存中...')
      }).catch(errMap => {
        this.$message.warning('请修正错误')
      })
    },
    onBatchDelete() {
      const records = this.$refs.xTable.getCheckboxRecords()
      if (!records.length) {
        this.$message.warning('请勾选')
        return
      }
      this.$confirm({
        title: `删除 ${records.length} 条?`,
        onOk: () => {
          this.tableData = this.tableData.filter(r => !records.find(rr => rr.id === r.id))
          this.$message.success('已删除')
        }
      })
    },
    onValidateAll() {
      this.$refs.xTable.fullValidate().then(() => {
        this.$message.success('全部校验通过')
      }).catch(errMap => {
        this.$message.error('校验失败')
      })
    },
    onRevert() {
      this.$refs.xTable.revertData()
      this.$message.info('已撤销')
    },
    onClearAll() {
      this.tableData = []
    },
    onInsert({ code }) {
      if (code === 'insert') this.onAddRow()
    },
    onEditClosed({ row, column }) {
      this.$message.info(`保存: ${row.name} 的 ${column.title}`)
    },
    onEditActived({ row, column }) {
      console.log('edit actived', column.field)
    },
    onEditDisabled({ row, column }) {
      console.log('edit disabled', column.field)
    },
    onNameInput({ row, column }) {
      console.log('name input', row.name)
    },
    roleStatus(role) {
      return { admin: 'primary', user: 'info', editor: 'success', guest: 'warning' }[role] || 'info'
    }
  },
  beforeDestroy() {
    console.log('edit-table destroying')
  }
}
</script>

<style lang="scss" scoped>
.edit-table { padding: 16px; }
</style>
