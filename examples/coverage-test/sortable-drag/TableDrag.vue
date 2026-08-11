<template>
  <div class="table-drag">
    <h3>表格行拖拽 (a-table + SortableJS 集成)</h3>
    <a-table
      :columns="columns"
      :data-source="tableData"
      :row-key="record => record.id"
      :pagination="false"
      :components="dragComponents"
    />

    <h3>列宽调整 (column-resize, 单独 sortable 实例)</h3>
    <a-table
      :columns="columns2"
      :data-source="tableData"
      :row-key="record => record.id"
      :pagination="false"
    />

    <h3>树形表格拖拽 (a-table 嵌套 + drag 节点)</h3>
    <a-table
      :columns="treeColumns"
      :data-source="treeData"
      :default-expand-all-rows="true"
      :pagination="false"
    />
  </div>
</template>

<script>
import Sortable from 'sortablejs'
import { VueDraggable } from 'vue-draggable-next' // 另一个库

export default {
  name: 'TableDragDemo',
  components: { VueDraggable },
  data() {
    return {
      tableData: [
        { id: 1, name: 'Row 1', age: 25, address: 'Beijing' },
        { id: 2, name: 'Row 2', age: 30, address: 'Shanghai' },
        { id: 3, name: 'Row 3', age: 28, address: 'Shenzhen' },
        { id: 4, name: 'Row 4', age: 35, address: 'Guangzhou' }
      ],
      treeData: [
        { id: 1, name: '目录 A', size: 100, children: [
          { id: 11, name: '文件 A1', size: 10 },
          { id: 12, name: '文件 A2', size: 20 }
        ]},
        { id: 2, name: '目录 B', size: 50, children: [
          { id: 21, name: '文件 B1', size: 5 }
        ]}
      ],
      dragComponents: {
        body: {
          wrapper: (props) => this.renderTbody(props)
        }
      },
      sortable: null
    }
  },
  computed: {
    columns() {
      return [
        {
          title: 'Drag',
          dataIndex: 'drag',
          width: 60,
          scopedSlots: { customRender: 'dragSlot' }
        },
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: 'Name', dataIndex: 'name' },
        { title: 'Age', dataIndex: 'age' },
        { title: 'Address', dataIndex: 'address' }
      ]
    },
    columns2() {
      return [
        { title: 'ID', dataIndex: 'id', width: 60 },
        { title: 'Name', dataIndex: 'name', resizable: true },
        { title: 'Age', dataIndex: 'age', resizable: true },
        { title: 'Address', dataIndex: 'address', resizable: true }
      ]
    },
    treeColumns() {
      return [
        { title: 'Name', dataIndex: 'name' },
        { title: 'Size', dataIndex: 'size' }
      ]
    }
  },
  mounted() {
    this.$nextTick(() => {
      const tbody = this.$el.querySelector('.ant-table-body table tbody')
      if (tbody) {
        this.sortable = Sortable.create(tbody, {
          animation: 150,
          handle: '.drag-handle',
          onEnd: (evt) => {
            const { oldIndex, newIndex } = evt
            if (oldIndex !== newIndex) {
              const movedItem = this.tableData.splice(oldIndex, 1)[0]
              this.tableData.splice(newIndex, 0, movedItem)
              this.$message.success(`Row ${oldIndex + 1} → ${newIndex + 1}`)
            }
          }
        })
      }
    })
  },
  beforeDestroy() {
    if (this.sortable) this.sortable.destroy()
  },
  methods: {
    renderTbody(props) {
      const h = this.$createElement
      const { children, ...restProps } = props
      return h('tbody', {
        ...restProps,
        on: {
          ...(restProps.on || {})
        }
      }, children)
    }
  }
}
</script>

<style scoped>
.drag-handle { cursor: move; color: #999; }
</style>
