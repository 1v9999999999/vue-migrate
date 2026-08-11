<!--
  element-ui/Cascader.vue — Cascader / Select 穷举
  iter-090 P3 验证: lazy / searchable / multiple / filterable / props / emit events
-->
<template>
  <div>
    <h2>Cascader / Select 级联与选择</h2>

    <!-- 1. 基础 cascader -->
    <el-cascader
      v-model="cascaderValue"
      :options="cascaderOptions"
      :props="cascaderProps"
      @change="onCascaderChange"
    />

    <!-- 2. 懒加载 cascader -->
    <el-cascader
      v-model="lazyCascader"
      :props="lazyProps"
    />

    <!-- 3. 多选 cascader -->
    <el-cascader
      v-model="multiCascader"
      :options="cascaderOptions"
      :props="{ multiple: true, checkStrictly: true }"
      clearable
    />

    <!-- 4. 搜索 cascader (filterable) -->
    <el-cascader
      v-model="searchCascader"
      :options="cascaderOptions"
      filterable
    />

    <!-- 5. 自定义 slot (header / footer / empty) -->
    <el-cascader v-model="slotCascader" :options="cascaderOptions">
      <template #default="{ data }">
        <div>{{ data.label }} - custom</div>
      </template>
    </el-cascader>

    <h2>Select 选择器</h2>

    <!-- 6. 基础 select -->
    <el-select v-model="selectValue" placeholder="请选择" clearable filterable>
      <el-option v-for="opt in options" :key="opt.value" :label="opt.label" :value="opt.value">
        <span style="float:left">{{ opt.label }}</span>
        <span style="float:right; color:#ccc; font-size:13px">{{ opt.desc }}</span>
      </el-option>
    </el-select>

    <!-- 7. 多选 select -->
    <el-select v-model="multiSelect" multiple collapse-tags clearable placeholder="多选">
      <el-option v-for="opt in options" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>

    <!-- 8. 远程搜索 select -->
    <el-select
      v-model="remoteSelect"
      :remote-method="onRemoteSearch"
      :loading="remoteLoading"
      filterable
      remote
      placeholder="输入搜索"
    >
      <el-option v-for="opt in remoteOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
    </el-select>

    <!-- 9. 分组 select (生僻) -->
    <el-select v-model="groupSelect" placeholder="分组">
      <el-option-group v-for="group in groupedOptions" :key="group.label" :label="group.label">
        <el-option v-for="opt in group.options" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-option-group>
    </el-select>

    <!-- 10. SelectV2 (虚拟滚动, 生僻) -->
    <el-select-v2 v-model="v2Select" :options="options" filterable clearable placeholder="SelectV2 虚拟滚动" />
  </div>
</template>

<script>
export default {
  data() {
    return {
      cascaderValue: [],
      lazyCascader: [],
      multiCascader: [],
      searchCascader: [],
      slotCascader: [],
      cascaderOptions: [{
        value: 'zhejiang', label: '浙江', children: [
          { value: 'hangzhou', label: '杭州', children: [
            { value: 'xihu', label: '西湖区' },
            { value: 'yuhang', label: '余杭区' }
          ]}
        ]
      }, {
        value: 'jiangsu', label: '江苏', children: [
          { value: 'nanjing', label: '南京' }
        ]
      }],
      cascaderProps: { expandTrigger: 'hover', checkStrictly: false },
      lazyProps: { lazy: true, lazyLoad: this.lazyLoadCascader },
      selectValue: '',
      multiSelect: [],
      remoteSelect: '',
      remoteLoading: false,
      remoteOptions: [],
      groupSelect: '',
      v2Select: '',
      options: [
        { value: '1', label: '选项1', desc: '描述1' },
        { value: '2', label: '选项2', desc: '描述2' },
        { value: '3', label: '选项3', desc: '描述3' }
      ],
      groupedOptions: [
        { label: '热门', options: [{ value: 'hot1', label: '热门1' }] },
        { label: '推荐', options: [{ value: 'rec1', label: '推荐1' }] }
      ]
    }
  },
  methods: {
    onCascaderChange(value) { console.log('change', value) },
    lazyLoadCascader(node, resolve) {
      // 异步加载子节点
      setTimeout(() => resolve([{ value: node.level, label: 'lazy ' + node.level }]), 500)
    },
    onRemoteSearch(query) {
      this.remoteLoading = true
      setTimeout(() => {
        this.remoteOptions = this.options.filter(o => o.label.includes(query))
        this.remoteLoading = false
      }, 300)
    }
  }
}
</script>
