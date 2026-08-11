<!--
  element-ui/Tree.vue — Tree / TreeSelect 穷举
  iter-090 P3 验证: lazy / accordion / show-checkbox / draggable / node-click / custom node
-->
<template>
  <div>
    <h2>Tree 树形控件</h2>

    <!-- 1. 基础树 -->
    <el-tree :data="treeData" :props="defaultProps" @node-click="onNodeClick" />

    <!-- 2. accordion (手风琴) -->
    <el-tree :data="treeData" :props="defaultProps" accordion />

    <!-- 3. show-checkbox (复选框) -->
    <el-tree
      :data="treeData"
      :props="defaultProps"
      show-checkbox
      node-key="id"
      :default-checked-keys="[1, 2]"
      @check-change="onCheckChange"
    />

    <!-- 4. 懒加载 (lazy) -->
    <el-tree
      :props="lazyProps"
      :load="loadNode"
      lazy
      @node-click="onNodeClick"
    />

    <!-- 5. 可拖拽 (draggable) -->
    <el-tree
      :data="treeData"
      :props="defaultProps"
      draggable
      :allow-drop="allowDrop"
      :allow-drag="allowDrag"
      @node-drag-start="onDragStart"
      @node-drag-end="onDragEnd"
    />

    <!-- 6. 自定义节点内容 slot -->
    <el-tree :data="treeData" :props="defaultProps">
      <template #default="{ node, data }">
        <span class="custom-tree-node">
          <span>{{ node.label }}</span>
          <span>
            <el-button size="mini" @click="onAppend(data)">Append</el-button>
            <el-button size="mini" type="danger" @click="onRemove(node, data)">Delete</el-button>
          </span>
        </span>
      </template>
    </el-tree>

    <!-- 7. 高亮 / 展开 / 过滤 -->
    <el-input v-model="filterText" placeholder="输入关键字搜索" />
    <el-tree
      :data="treeData"
      :props="defaultProps"
      :filter-node-method="filterNode"
      :default-expand-all="false"
      ref="filterTree"
    />

    <!-- 8. TreeSelect (生僻) -->
    <el-tree-select v-model="selectedDept" :data="treeData" :props="defaultProps" check-strictly />
  </div>
</template>

<script>
export default {
  data() {
    return {
      filterText: '',
      selectedDept: null,
      treeData: [{
        id: 1, label: '总部', children: [
          { id: 2, label: '研发部' },
          { id: 3, label: '产品部' }
        ]
      }],
      defaultProps: { children: 'children', label: 'label' },
      lazyProps: { children: 'children', label: 'label', isLeaf: 'leaf' }
    }
  },
  watch: {
    filterText(val) { this.$refs.filterTree?.filter(val) }
  },
  methods: {
    onNodeClick(data) { console.log('click', data) },
    onCheckChange(data, checked, indeterminate) { console.log('check', data, checked) },
    loadNode(node, resolve) {
      // 异步加载
      setTimeout(() => resolve([{ id: node.level + 100, label: 'Lazy ' + node.level }]), 500)
    },
    allowDrop(draggingNode, dropNode, type) { return type !== 'inner' || dropNode.data.label !== '总部' },
    allowDrag(draggingNode) { return draggingNode.data.label.indexOf('不允许') === -1 },
    onDragStart(node, event) { console.log('dragStart', node) },
    onDragEnd(node, event) { console.log('dragEnd', node) },
    onAppend(data) { console.log('append', data) },
    onRemove(node, data) { console.log('remove', data) },
    filterNode(value, data) {
      if (!value) return true
      return data.label.indexOf(value) !== -1
    }
  }
}
</script>
