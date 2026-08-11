<template>
  <div class="tree-demo">
    <h3>基础树 (treeData + 3 事件)</h3>
    <a-tree
      :tree-data="basicData"
      :default-expanded-keys="['0-0']"
      :default-selected-keys="['0-0-0']"
      :show-line="true"
      :show-icon="true"
      @select="onSelect"
      @expand="onExpand"
      @check="onCheck"
    >
      <a-icon slot="switcherIcon" type="down" />
      <template slot="title" slot-scope="{ title }">
        <span style="color: #1890ff">{{ title }}</span>
      </template>
    </a-tree>

    <h3>可勾选 (checkable + checkStrictly)</h3>
    <a-tree
      v-model="checkedKeys"
      :tree-data="basicData"
      checkable
      :check-strictly="false"
      :default-checked-keys="['0-0-0']"
      @check="onCheckStrict"
    >
      <template slot="title" slot-scope="{ title, key }">
        <span v-if="key === '0-0-0'" style="color: #f50">特殊节点</span>
        <span v-else>{{ title }}</span>
      </template>
    </a-tree>

    <h3>可拖拽 (draggable + 4 事件)</h3>
    <a-tree
      :tree-data="draggableData"
      :default-expanded-keys="['0-0']"
      draggable
      block-node
      @dragstart="onDragStart"
      @dragend="onDragEnd"
      @drop="onDrop"
      @dragenter="onDragEnter"
    />

    <h3>树 + 自定义搜索过滤</h3>
    <a-input v-model="searchText" placeholder="搜索" style="margin-bottom: 8px" />
    <a-tree
      :tree-data="filteredData"
      :expanded-keys="expandedKeys"
      :auto-expand-parent="true"
      @expand="onSearchExpand"
    />

    <h3>树选择 (a-tree-select)</h3>
    <a-tree-select
      v-model="treeSelectValue"
      :tree-data="basicData"
      :replace-fields="{ title: 'title', key: 'key', value: 'value' }"
      tree-default-expand-all
      style="width: 100%"
      allow-clear
      multiple
      tree-checkable
      :show-checked-strategy="SHOW_PARENT"
      :max-tag-count="3"
      search-placeholder="请选择"
      @change="onTreeSelectChange"
    />

    <h3>右键菜单 (rightMenuSlot)</h3>
    <a-tree :tree-data="basicData" :default-expanded-keys="['0-0']">
      <a-dropdown slot="contextMenu" slot-scope="node">
        <a-menu @click="({ key }) => onContextMenu(key, node)">
          <a-menu-item key="add">新增</a-menu-item>
          <a-menu-item key="edit">编辑</a-menu-item>
          <a-menu-item key="del">删除</a-menu-item>
        </a-menu>
        <span>右键菜单</span>
      </a-dropdown>
    </a-tree>
  </div>
</template>

<script>
import { TreeSelect } from 'ant-design-vue'

export default {
  name: 'AntTreeDemo',
  components: { ATreeSelect: TreeSelect },
  data() {
    return {
      SHOW_PARENT: 'SHOW_PARENT',
      checkedKeys: [],
      searchText: '',
      expandedKeys: [],
      treeSelectValue: [],
      basicData: [
        {
          title: '父节点 1', key: '0-0', value: 'parent1',
          scopedSlots: { title: 'title' },
          children: [
            { title: '子 1-1', key: '0-0-0', value: 'c11', scopedSlots: { title: 'title' } },
            { title: '子 1-2', key: '0-0-1', value: 'c12' }
          ]
        },
        {
          title: '父节点 2', key: '0-1', value: 'parent2',
          children: [
            { title: '子 2-1', key: '0-1-0', value: 'c21' },
            { title: '子 2-2', key: '0-1-1', value: 'c22' }
          ]
        }
      ],
      draggableData: [
        {
          title: '可拖拽 1', key: '0-0',
          children: [
            { title: '子 1-1', key: '0-0-0' },
            { title: '子 1-2', key: '0-0-1' }
          ]
        },
        {
          title: '可拖拽 2', key: '0-1',
          children: [
            { title: '子 2-1', key: '0-1-0' }
          ]
        }
      ]
    }
  },
  computed: {
    filteredData() {
      if (!this.searchText) return this.basicData
      return this.filterTree(this.basicData, this.searchText)
    }
  },
  methods: {
    onSelect(keys, info) {
      console.log('select', keys, info)
      this.$message.info(`selected: ${keys.join(',')}`)
    },
    onExpand(keys, info) {
      console.log('expand', keys)
    },
    onCheck(checkedKeys, info) {
      console.log('check', checkedKeys, info)
    },
    onCheckStrict(checkedKeys, info) {
      this.$message.info(`checked ${checkedKeys.checked.length} nodes`)
    },
    onDragStart(info) {
      console.log('drag start', info)
    },
    onDragEnd(info) {
      console.log('drag end', info)
    },
    onDrop(info) {
      console.log('drop', info)
      this.$message.success('dropped')
    },
    onDragEnter(info) {
      console.log('drag enter', info.expandedKeys)
    },
    onSearchExpand(keys) {
      this.expandedKeys = keys
      this.autoExpandParent = false
    },
    onTreeSelectChange(value) {
      this.treeSelectValue = value
      this.$message.info(`tree-select: ${value.join(',')}`)
    },
    onContextMenu(key, node) {
      this.$message.info(`右键 ${key} on ${node.title}`)
    },
    filterTree(data, text) {
      return data.reduce((acc, node) => {
        if (node.title.includes(text)) {
          acc.push(node)
        } else if (node.children) {
          const filteredChildren = this.filterTree(node.children, text)
          if (filteredChildren.length) {
            acc.push({ ...node, children: filteredChildren })
          }
        }
        return acc
      }, [])
    }
  }
}
</script>
