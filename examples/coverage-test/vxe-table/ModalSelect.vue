<template>
  <div class="modal-select">
    <h3>vxe-modal (弹窗 + 嵌入表格 + 嵌套表单)</h3>
    <vxe-button @click="modalVisible = true">打开弹窗</vxe-button>
    <vxe-modal
      v-model="modalVisible"
      title="编辑用户"
      width="900"
      height="600"
      :loading="submitting"
      :show-zoom="true"
      :show-fullscreen="true"
      :show-close="true"
      :mask="true"
      :mask-closable="false"
      :lock-view="true"
      :esc-closable="true"
      :drag="true"
      :resize="true"
      :footer-position="'right'"
      @close="onClose"
      @zoom="onZoom"
      @fullscreen="onFullscreen"
    >
      <template #title>
        <a-icon type="user" /> 自定义标题
      </template>
      <template #default>
        <vxe-form :data="formData" :items="formItems" :rules="rules">
          <template #name_default="{ data }">
            <vxe-input v-model="data.name" />
          </template>
        </vxe-form>
      </template>
      <template #footer>
        <vxe-button @click="modalVisible = false">取消</vxe-button>
        <vxe-button status="primary" :loading="submitting" @click="onSave">保存</vxe-button>
      </template>
    </vxe-modal>

    <h3>vxe-modal 嵌入 vxe-grid (确认弹窗 + 数据预览)</h3>
    <vxe-button @click="gridModalVisible = true">打开 Grid 弹窗</vxe-button>
    <vxe-modal
      v-model="gridModalVisible"
      title="数据预览"
      width="80%"
      :show-footer="false"
    >
      <vxe-grid
        :columns="gridColumns"
        :data="tableData"
        :height="500"
        :toolbar-config="{ export: true, print: true }"
      />
    </vxe-modal>

    <h3>vxe-select (高级下拉) + 远程搜索</h3>
    <vxe-select
      v-model="selectedUser"
      :options="userOptions"
      :remote="true"
      :remote-method="onRemoteSearch"
      :loading="searching"
      :filterable="true"
      :clearable="true"
      :multiple="true"
      :max-tag-count="3"
      :show-status="true"
      :opt-id="'value'"
      :opt-label="'label'"
      :placeholder="'搜索用户'"
      style="width: 100%"
      @change="onUserChange"
    >
      <template #option="{ option, selected, hover }">
        <span v-if="option">{{ option.label }} ({{ option.email }})</span>
      </template>
    </vxe-select>

    <h3>vxe-pulldown (下拉面板) + 自定义内容</h3>
    <vxe-pulldown ref="pulldown" :visible="pulldownVisible" @click-outside="onPulldownOutside">
      <template #default="{ toggle }">
        <vxe-button @click="toggle">打开下拉</vxe-button>
      </template>
      <template #content>
        <div class="pulldown-content">
          <a-input v-model="searchText" placeholder="搜索" />
          <ul class="pulldown-list">
            <li v-for="item in filteredOptions" :key="item.value" @click="onSelectOption(item)">
              {{ item.label }}
            </li>
          </ul>
        </div>
      </template>
    </vxe-pulldown>

    <h3>vxe-list 列表 (替代 ul/li)</h3>
    <vxe-list
      :data="listData"
      :height="200"
      :scroll-y="{ gt: 50 }"
    >
      <template #default="{ items }">
        <ul class="vxe-list">
          <li v-for="item in items" :key="item.id" class="vxe-list-item">
            <a-avatar :src="item.avatar" />
            <div class="item-content">
              <h4>{{ item.name }}</h4>
              <p>{{ item.email }}</p>
            </div>
          </li>
        </ul>
      </template>
    </vxe-list>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxeModalSelect',
  data() {
    return {
      modalVisible: false,
      gridModalVisible: false,
      submitting: false,
      pulldownVisible: false,
      searchText: '',
      searching: false,
      selectedUser: [],
      formData: {
        name: '',
        age: 18,
        email: '',
        role: 'user'
      },
      formItems: [
        { field: 'name', title: '姓名', span: 12 },
        { field: 'age', title: '年龄', span: 12 },
        { field: 'email', title: '邮箱', span: 24 },
        { field: 'role', title: '角色', span: 24 }
      ],
      rules: {
        name: [{ required: true, message: '必填' }],
        email: [{ required: true, type: 'email', message: '邮箱格式错误' }]
      },
      tableData: [
        { id: 1, name: '张三', age: 25, role: 'admin', status: 'active' },
        { id: 2, name: '李四', age: 30, role: 'user', status: 'inactive' }
      ],
      gridColumns: [
        { type: 'seq', width: 50 },
        { field: 'name', title: 'Name' },
        { field: 'age', title: 'Age' },
        { field: 'role', title: 'Role' },
        { field: 'status', title: 'Status' }
      ],
      userOptions: [],
      allUsers: [
        { value: 1, label: 'Alice', email: 'alice@example.com' },
        { value: 2, label: 'Bob', email: 'bob@example.com' },
        { value: 3, label: 'Carol', email: 'carol@example.com' },
        { value: 4, label: 'Dave', email: 'dave@example.com' },
        { value: 5, label: 'Eve', email: 'eve@example.com' }
      ],
      listData: [
        { id: 1, name: 'Alice', email: 'alice@example.com', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=1' },
        { id: 2, name: 'Bob', email: 'bob@example.com', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=2' },
        { id: 3, name: 'Carol', email: 'carol@example.com', avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=3' }
      ],
      options: [
        { label: '选项 1', value: 1 },
        { label: '选项 2', value: 2 },
        { label: '选项 3', value: 3 }
      ]
    }
  },
  computed: {
    filteredOptions() {
      if (!this.searchText) return this.options
      return this.options.filter(o => o.label.includes(this.searchText))
    }
  },
  mounted() {
    this.userOptions = this.allUsers
  },
  beforeDestroy() {
    console.log('modal-select destroying')
  },
  methods: {
    onClose() {
      console.log('modal closed')
    },
    onZoom() {
      console.log('modal zoomed')
    },
    onFullscreen() {
      console.log('modal fullscreen')
    },
    onSave() {
      this.submitting = true
      setTimeout(() => {
        this.submitting = false
        this.modalVisible = false
        this.$message.success('已保存')
      }, 1000)
    },
    onUserChange(value) {
      console.log('user change', value)
    },
    onRemoteSearch(value) {
      this.searching = true
      setTimeout(() => {
        this.userOptions = this.allUsers.filter(u =>
          u.label.toLowerCase().includes((value || '').toLowerCase())
        )
        this.searching = false
      }, 300)
    },
    onPulldownOutside() {
      this.pulldownVisible = false
    },
    onSelectOption(item) {
      this.$message.info(`选中: ${item.label}`)
      this.pulldownVisible = false
    }
  }
}
</script>

<style lang="scss" scoped>
.modal-select { padding: 16px; }
.pulldown-content { padding: 8px; min-width: 200px; }
.pulldown-list { list-style: none; padding: 0; margin: 8px 0 0; }
.pulldown-list li { padding: 6px 8px; cursor: pointer; }
.pulldown-list li:hover { background: #f5f5f5; }
.vxe-list { list-style: none; padding: 0; }
.vxe-list-item { display: flex; align-items: center; padding: 8px; border-bottom: 1px solid #f0f0f0; }
.item-content { margin-left: 12px; }
.item-content h4 { margin: 0; font-size: 14px; }
.item-content p { margin: 4px 0 0; font-size: 12px; color: #999; }
</style>
