<template>
  <div class="tree-table">
    <h3>树形表格 (tree-config + children 递归)</h3>
    <vxe-table
      :data="treeData"
      :tree-config="{ children: 'children', indent: 20, accordion: false, expandAll: true, expandRowKeys: ['100', '101'] }"
      :checkbox-config="{ checkField: 'checked', halfField: 'indeterminate' }"
      :row-config="{ keyField: 'id', isHover: true }"
      :height="500"
      @toggle-tree-expand="onToggleExpand"
      @checkbox-change="onCheck"
      @checkbox-all="onCheckAll"
    >
      <vxe-table-column type="seq" width="60" tree-node />
      <vxe-table-column type="checkbox" width="50" tree-node />
      <vxe-table-column field="name" title="名称" min-width="240" tree-node
        :cell-render="{ name: 'Lang' }">
        <template #default="{ row }">
          <a-icon v-if="row.children" :type="row.expanded ? 'folder-open' : 'folder'" />
          <a-icon v-else type="file" />
          <span style="margin-left: 4px">{{ row.name }}</span>
        </template>
      </vxe-table-column>
      <vxe-table-column field="type" title="类型" width="100" :formatter="formatType" />
      <vxe-table-column field="size" title="大小" width="100" :formatter="formatSize" />
      <vxe-table-column field="createTime" title="创建时间" width="160" />
      <vxe-table-column field="owner" title="所有者" width="120" />
      <vxe-table-column title="操作" width="200" fixed="right">
        <template #default="{ row }">
          <vxe-button mode="text" type="text" @click="onAddChild(row)">添加子项</vxe-button>
          <vxe-button mode="text" type="text" @click="onRename(row)">重命名</vxe-button>
          <vxe-button mode="text" type="text" status="danger" @click="onDelete(row)">删除</vxe-button>
        </template>
      </vxe-table-column>
    </vxe-table>

    <h3>树 + 懒加载 (loadMethod 动态加载)</h3>
    <vxe-table
      :data="lazyTreeData"
      :tree-config="{
        children: 'children',
        lazy: true,
        loadMethod: loadChildren,
        hasChildField: 'hasChild'
      }"
      :height="400"
    >
      <vxe-table-column field="name" title="名称" tree-node />
      <vxe-table-column field="type" title="类型" />
      <vxe-table-column field="size" title="大小" />
    </vxe-table>

    <h3>树 + 过滤 (filterMethod 过滤子树)</h3>
    <vxe-input v-model="searchText" placeholder="搜索文件" style="width: 200px; margin-bottom: 8px" />
    <vxe-table
      :data="filteredTree"
      :tree-config="{
        children: 'children',
        accordion: true,
        expandAll: false,
        trigger: 'row'
      }"
    >
      <vxe-table-column field="name" title="名称" tree-node />
      <vxe-table-column field="type" title="类型" />
    </vxe-table>
  </div>
</template>

<script>
import VXETable from 'vxe-table'
import 'vxe-table/lib/index.css'

export default {
  name: 'VxeTreeTable',
  data() {
    return {
      searchText: '',
      treeData: [
        {
          id: '100',
          name: '项目根目录',
          type: 'folder',
          size: '-',
          createTime: '2024-01-01',
          owner: 'admin',
          children: [
            { id: '101', name: 'src', type: 'folder', size: '-', createTime: '2024-01-02', owner: 'admin', children: [
              { id: '102', name: 'main.js', type: 'file', size: '2.3KB', createTime: '2024-01-02', owner: 'admin' },
              { id: '103', name: 'App.vue', type: 'file', size: '5.1KB', createTime: '2024-01-02', owner: 'admin' },
              { id: '104', name: 'router', type: 'folder', size: '-', createTime: '2024-01-03', owner: 'admin', children: [
                { id: '105', name: 'index.js', type: 'file', size: '1.2KB', createTime: '2024-01-03', owner: 'admin' }
              ]}
            ]},
            { id: '106', name: 'package.json', type: 'file', size: '0.8KB', createTime: '2024-01-01', owner: 'admin' },
            { id: '107', name: 'README.md', type: 'file', size: '3.2KB', createTime: '2024-01-01', owner: 'admin' }
          ]
        },
        {
          id: '200',
          name: '文档',
          type: 'folder',
          size: '-',
          createTime: '2024-01-05',
          owner: 'zhangsan',
          children: [
            { id: '201', name: '需求.md', type: 'file', size: '5.2KB', createTime: '2024-01-05', owner: 'zhangsan' },
            { id: '202', name: '设计.md', type: 'file', size: '8.7KB', createTime: '2024-01-06', owner: 'zhangsan' }
          ]
        }
      ],
      lazyTreeData: [
        { id: 'L1', name: '北京', type: 'province', size: '-', hasChild: true },
        { id: 'L2', name: '上海', type: 'province', size: '-', hasChild: true }
      ]
    }
  },
  computed: {
    filteredTree() {
      if (!this.searchText) return this.treeData
      return this.filterTreeNodes(this.treeData, this.searchText)
    }
  },
  methods: {
    onToggleExpand({ row, expanded, rowIndex }) {
      console.log('toggle', row.name, expanded)
    },
    onCheck({ checked, row, rowIndex, $rowIndex }) {
      console.log('check', row.name, checked)
    },
    onCheckAll({ checked, selection }) {
      console.log('all checked', checked, selection.length)
    },
    onAddChild(parent) {
      this.$prompt({
        title: '添加子项',
        label: '名称',
        onOk: ({ value }) => {
          if (!parent.children) parent.children = []
          parent.children.push({
            id: `${parent.id}-${parent.children.length + 1}`,
            name: value || '新节点',
            type: 'file',
            size: '0KB',
            createTime: new Date().toISOString().slice(0, 10),
            owner: 'admin'
          })
          this.$message.success('已添加')
        }
      })
    },
    onRename(row) {
      this.$prompt({
        title: '重命名',
        label: '新名称',
        value: row.name,
        onOk: ({ value }) => {
          row.name = value
          this.$message.success('已重命名')
        }
      })
    },
    onDelete(row) {
      this.$confirm({
        title: '确认删除',
        content: `删除 ${row.name}?`,
        onOk: () => {
          this.removeFromTree(this.treeData, row.id)
          this.$message.success('已删除')
        }
      })
    },
    removeFromTree(list, id) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          list.splice(i, 1)
          return true
        }
        if (list[i].children && this.removeFromTree(list[i].children, id)) {
          return true
        }
      }
      return false
    },
    loadChildren({ row }) {
      // 模拟远程加载
      return new Promise(resolve => {
        setTimeout(() => {
          if (row.id === 'L1') {
            resolve([
              { id: 'L1-1', name: '北京-朝阳区', type: 'district', size: '-' },
              { id: 'L1-2', name: '北京-海淀区', type: 'district', size: '-' }
            ])
          } else {
            resolve([
              { id: 'L2-1', name: '上海-浦东新区', type: 'district', size: '-' }
            ])
          }
        }, 500)
      })
    },
    filterTreeNodes(nodes, text) {
      const result = []
      for (const node of nodes) {
        if (node.name.includes(text)) {
          result.push({ ...node, expanded: true })
        } else if (node.children) {
          const filteredChildren = this.filterTreeNodes(node.children, text)
          if (filteredChildren.length) {
            result.push({ ...node, children: filteredChildren, expanded: true })
          }
        }
      }
      return result
    },
    formatType({ cellValue }) {
      return { folder: '文件夹', file: '文件', province: '省', district: '区' }[cellValue] || cellValue
    },
    formatSize({ cellValue }) {
      if (cellValue === '-' || !cellValue) return '-'
      return cellValue
    }
  },
  beforeDestroy() {
    console.log('tree-table destroying')
  }
}
</script>

<style lang="scss" scoped>
.tree-table { padding: 16px; }
</style>
