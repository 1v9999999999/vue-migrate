<template>
  <div class="table-demo">
    <h3>基础表格 (columns + dataSource + 3 种 key)</h3>
    <a-table
      :columns="columns"
      :data-source="data"
      :row-key="record => record.id"
      :pagination="false"
      :loading="loading"
      size="middle"
    />

    <h3>选择 + 排序 + 过滤 + 分页</h3>
    <a-table
      :columns="columns2"
      :data-source="data"
      :row-selection="rowSelection"
      :pagination="pagination"
      :scroll="{ x: 1300 }"
      @change="handleTableChange"
    >
      <span slot="nameSlot" slot-scope="text, record">
        <a-icon type="user" /> {{ text }} ({{ record.age }})
      </span>
      <span slot="actionSlot" slot-scope="text, record">
        <a @click="onEdit(record)">编辑</a>
        <a-divider type="vertical" />
        <a @click="onDelete(record)">删除</a>
      </span>
      <template slot="filterDropdown" slot-scope="{ setSelectedKeys, selectedKeys, confirm, clearFilters, column }">
        <div style="padding: 8px">
          <a-input
            :placeholder="`Search ${column.dataIndex}`"
            :value="selectedKeys[0]"
            @change="e => setSelectedKeys(e.target.value ? [e.target.value] : [])"
            @press.enter="confirm()"
            style="width: 188px; margin-bottom: 8px; display: block"
          />
          <a-button type="primary" icon="search" size="small" style="width: 90px; margin-right: 8px" @click="confirm()">
            Search
          </a-button>
          <a-button size="small" style="width: 90px" @click="clearFilters()">Reset</a-button>
        </div>
      </template>
    </a-table>

    <h3>可展开 (expandable)</h3>
    <a-table
      :columns="columns3"
      :data-source="data"
      :expanded-row-keys="expandedKeys"
      :expand-row-by-click="true"
      @expand="onExpand"
    >
      <p slot="expandedRowRender" slot-scope="record" style="margin: 0">
        {{ record.name }} 的额外信息: {{ record.bio }}
      </p>
    </a-table>

    <h3>树形 (defaultExpandAllRows + children 递归)</h3>
    <a-table
      :columns="treeColumns"
      :data-source="treeData"
      :default-expand-all-rows="true"
      :pagination="false"
      :indent-size="20"
    >
      <span slot="nameSlotTree" slot-scope="text, record">
        <a-icon :type="record.icon || 'file-text'" /> {{ text }}
      </span>
    </a-table>

    <h3>summary 汇总行</h3>
    <a-table
      :columns="summaryColumns"
      :data-source="data"
      :summary-rows="() => summaryRows"
      :pagination="false"
    />

    <h3>自定义 cell 渲染 (render 函数 + scopedSlots 双写法)</h3>
    <a-table
      :columns="renderColumns"
      :data-source="data"
      :components="components"
      :pagination="false"
    >
      <a-button slot="operate" slot-scope="text, record" size="small" @click="onOp(record)">
        操作
      </a-button>
    </a-table>
  </div>
</template>

<script>
import moment from 'moment'

export default {
  name: 'AntTableDemo',
  data() {
    return {
      loading: false,
      data: [],
      treeData: [],
      expandedKeys: [],
      pagination: {
        current: 1,
        pageSize: 5,
        total: 50,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: ['5', '10', '20'],
        showTotal: total => `共 ${total} 条`
      },
      rowSelection: {
        selectedRowKeys: [],
        onChange: this.onSelectChange,
        onSelect: this.onSelect,
        onSelectAll: this.onSelectAll,
        getCheckboxProps: record => ({
          props: { disabled: record.name === 'Disabled User' }
        })
      },
      columns: [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: 'Name', dataIndex: 'name' },
        { title: 'Age', dataIndex: 'age', sorter: (a, b) => a.age - b.age },
        { title: 'Address', dataIndex: 'address' }
      ],
      columns2: [
        { title: 'Name', dataIndex: 'name', key: 'name',
          sorter: (a, b) => a.name.length - b.name.length,
          scopedSlots: { customRender: 'nameSlot' },
          onFilter: (value, record) => record.name.includes(value),
          filterDropdown: true,
          filterIcon: filtered => (
            <a-icon type="search" style={{ color: filtered ? '#108ee9' : undefined }} />
          ),
          slots: { filterDropdown: 'filterDropdown' }
        },
        { title: 'Age', dataIndex: 'age', sorter: (a, b) => a.age - b.age },
        { title: 'Address', dataIndex: 'address' },
        { title: 'Tags', dataIndex: 'tags',
          filters: [
            { text: 'Engineer', value: 'engineer' },
            { text: 'Designer', value: 'designer' }
          ],
          onFilter: (value, record) => record.tags.includes(value)
        },
        { title: 'Action', key: 'action', scopedSlots: { customRender: 'actionSlot' } }
      ],
      columns3: [
        { title: 'Name', dataIndex: 'name' },
        { title: 'Age', dataIndex: 'age' }
      ],
      treeColumns: [
        { title: 'Name', dataIndex: 'name', key: 'name', scopedSlots: { customRender: 'nameSlotTree' } },
        { title: 'Size', dataIndex: 'size' }
      ],
      summaryColumns: [
        { title: 'Name', dataIndex: 'name' },
        { title: 'Age', dataIndex: 'age' }
      ],
      renderColumns: [
        { title: 'Name', dataIndex: 'name',
          customRender: (text, record, index) => (
            <a href="javascript:;" onClick={() => this.onRowClick(record)}>{text}</a>
          )
        },
        { title: 'Action', key: 'op', scopedSlots: { customRender: 'operate' } }
      ],
      components: {}
    }
  },
  computed: {
    summaryRows() {
      const totalAge = this.data.reduce((s, r) => s + r.age, 0)
      return [
        { name: 'Total', age: totalAge }
      ]
    }
  },
  created() {
    this.fetchData()
  },
  methods: {
    fetchData() {
      this.loading = true
      setTimeout(() => {
        this.data = [
          { id: 1, name: 'John Brown', age: 32, address: 'New York', tags: ['engineer'], bio: 'Senior FE' },
          { id: 2, name: 'Jim Green', age: 42, address: 'London', tags: ['designer'], bio: 'Designer' },
          { id: 3, name: 'Joe Black', age: 32, address: 'Sidney', tags: ['engineer', 'designer'], bio: 'PM' },
          { id: 4, name: 'Disabled User', age: 99, address: 'N/A', tags: [], bio: 'Disabled' },
          { id: 5, name: 'Last One', age: 28, address: 'Beijing', tags: ['engineer'], bio: 'Intern' }
        ]
        this.treeData = [
          {
            name: 'root', size: 100, icon: 'folder',
            children: [
              { name: 'sub-1', size: 30, icon: 'file' },
              { name: 'sub-2', size: 70, icon: 'folder',
                children: [
                  { name: 'sub-2-1', size: 50, icon: 'file' }
                ]
              }
            ]
          }
        ]
        this.loading = false
      }, 1000)
    },
    handleTableChange(pagination, filters, sorter) {
      console.log('pagination', pagination, 'filters', filters, 'sorter', sorter)
      this.$message.info(`排序字段: ${sorter.field}`)
    },
    onSelectChange(selectedRowKeys) {
      this.rowSelection.selectedRowKeys = selectedRowKeys
    },
    onSelect(record, selected, selectedRows) {
      console.log('onSelect', record, selected, selectedRows)
    },
    onSelectAll(selected, selectedRows, changeRows) {
      console.log('onSelectAll', selected, selectedRows, changeRows)
    },
    onEdit(record) {
      this.$message.info(`编辑: ${record.name}`)
    },
    onDelete(record) {
      this.$confirm({
        title: '确认删除?',
        content: `删除 ${record.name}?`,
        onOk: () => this.$message.success('已删除')
      })
    },
    onExpand(expanded, record) {
      this.expandedKeys = expanded ? [...this.expandedKeys, record.id] : this.expandedKeys.filter(k => k !== record.id)
    },
    onRowClick(record) {
      this.$message.info(`点击: ${record.name}`)
    },
    onOp(record) {
      this.$message.info(`操作: ${record.id}`)
    }
  },
  filters: {
    moment: moment
  }
}
</script>
