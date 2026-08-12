<template>
  <div class="cascader-demo">
    <h3>基础级联 (options + 4 事件)</h3>
    <a-cascader
      v-model="value1"
      :options="options"
      placeholder="请选择"
      @change="onChange1"
      @popup-visible-change="onPopupVisibleChange"
    />

    <h3>可搜索 (showSearch + filter + render.filter)</h3>
    <a-cascader
      v-model="value2"
      :options="options"
      :show-search="{ filter, render: renderFilteredOption }"
      placeholder="搜索级联"
      @change="onChange2"
    />

    <h3>多选 (multiple + maxTagCount + 2 事件)</h3>
    <a-cascader
      v-model="value3"
      :options="options"
      multiple
      :max-tag-count="2"
      :show-checked-strategy="SHOW_CHILD"
      placeholder="多选级联"
      @change="onMultiChange"
    />

    <h3>fieldNames 自定义字段 (children/value/label)</h3>
    <a-cascader
      v-model="value4"
      :options="customOptions"
      :field-names="{ label: 'name', value: 'id', children: 'items' }"
      placeholder="field-names"
    />

    <h3>自定义显示 (displayRender + slot)</h3>
    <a-cascader
      v-model="value5"
      :options="options"
      :display-render="displayRender"
      placeholder="display-render"
    >
      <template #displayRender="{ labels, selectedOptions }">
        <span v-for="(label, i) in labels" :key="i">
          <span v-if="i === labels.length - 1">{{ label }} ({{ selectedOptions[i].value }})</span>
          <span v-else>{{ label }} / </span>
        </span>
      </template>
    </a-cascader>

    <h3>size 3 种</h3>
    <a-cascader v-model="value6" :options="options" size="large" />
    <a-cascader v-model="value6" :options="options" size="default" />
    <a-cascader v-model="value6" :options="options" size="small" />

    <h3>disabled / allowClear / expandTrigger</h3>
    <a-cascader
      v-model="value7"
      :options="options"
      :disabled="true"
      :allow-clear="true"
      :expand-trigger="'hover'"
      placeholder="hover 展开"
    />

    <h3>懒加载 (loadData + 动态 children)</h3>
    <a-cascader
      v-model="value8"
      :options="lazyOptions"
      :load-data="loadData"
      placeholder="懒加载级联"
      change-on-select
    />

    <h3>a-select remoteSearch (autocomplete)</h3>
    <a-select
      v-model="value9"
      :options="searchResults"
      :filter-option="false"
      :not-found-content="searching ? '搜索中...' : '无数据'"
      placeholder="远程搜索"
      show-search
      :default-active-first-option="false"
      @search="onRemoteSearch"
    >
      <template #suffixIcon><a-icon type="search" /></template>
    </a-select>

    <h3>grouped options (OptGroup)</h3>
    <a-select v-model="value10" style="width: 200px">
      <a-select-opt-group v-for="group in groupedOptions" :key="group.label">
        <template #label>
          <a-icon type="appstore" /> {{ group.label }}
        </template>
        <a-select-option v-for="opt in group.options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </a-select-option>
      </a-select-opt-group>
    </a-select>
  </div>
</template>

<script setup>
import { ElMessage } from "element-plus";

import { reactive, ref } from 'vue'

const SHOW_CHILD = ref('SHOW_CHILD')
const value1 = reactive([])
const value2 = reactive([])
const value3 = reactive([])
const value4 = reactive([])
const value5 = reactive([])
const value6 = reactive([])
const value7 = reactive(['zhejiang', 'hangzhou', 'xihu'])
const value8 = reactive([])
const value9 = ref(null)
const value10 = ref(null)
const searching = ref(false)
const searchResults = reactive([])
const options = reactive([{
  value: 'zhejiang',
  label: '浙江',
  children: [{
    value: 'hangzhou',
    label: '杭州',
    children: [{
      value: 'xihu',
      label: '西湖区',
      isLeaf: true
    }, {
      value: 'yuhang',
      label: '余杭区',
      isLeaf: true
    }]
  }, {
    value: 'ningbo',
    label: '宁波',
    isLeaf: true
  }]
}, {
  value: 'jiangsu',
  label: '江苏',
  children: [{
    value: 'nanjing',
    label: '南京',
    children: [{
      value: 'gulou',
      label: '鼓楼区',
      isLeaf: true
    }]
  }]
}])
const customOptions = reactive([{
  id: '1',
  name: '一级',
  items: [{
    id: '1-1',
    name: '二级',
    items: [{
      id: '1-1-1',
      name: '三级'
    }]
  }]
}])
const lazyOptions = reactive([{
  value: 'beijing',
  label: '北京',
  isLeaf: false
}])
const groupedOptions = reactive([{
  label: '前端',
  options: [{
    value: 'vue',
    label: 'Vue'
  }, {
    value: 'react',
    label: 'React'
  }]
}, {
  label: '后端',
  options: [{
    value: 'go',
    label: 'Go'
  }, {
    value: 'node',
    label: 'Node'
  }]
}])
const allCities = reactive([{
  value: 'beijing',
  label: '北京'
}, {
  value: 'shanghai',
  label: '上海'
}, {
  value: 'guangzhou',
  label: '广州'
}, {
  value: 'shenzhen',
  label: '深圳'
}])

function onChange1(value, selectedOptions) {
    ElMessage.info(`change1: ${value.join('/')}`);
}
function onChange2(value, selectedOptions) {
    console.log('change2', value);
}
function onMultiChange(value, selectedOptions) {
    ElMessage.info(`multi: ${value.length} selected`);
}
function onPopupVisibleChange(visible) {
    console.log('popup visible:', visible);
}
function filter(inputValue, path) {
    return path.some(opt => opt.label.toLowerCase().includes(inputValue.toLowerCase()));
}
function renderFilteredOption(inputValue, path) {
    return path.map(opt => opt.label).join(' / ');
}
function displayRender({
  labels,
  selectedOptions
}) {
    return labels.join(' > ');
}
function loadData(selectedOptions) {
    const target = selectedOptions[selectedOptions.length - 1];
  target.loading = true;
  setTimeout(() => {
    target.loading = false;
    target.children = [{
      label: `${target.label} 动态 1`,
      value: `${target.value}-1`,
      isLeaf: true
    }, {
      label: `${target.label} 动态 2`,
      value: `${target.value}-2`,
      isLeaf: true
    }];
    lazyOptions.splice(0, lazyOptions.length, ...[...lazyOptions]);
  }, 500);
}
function onRemoteSearch(value) {
    searching.value = true;
  searchResults.splice(0, searchResults.length, ...[]);
  setTimeout(() => {
    searchResults.splice(0, searchResults.length, ...(allCities.filter(c => c.label.toLowerCase().includes((value || '').toLowerCase()))));
    searching.value = false;
  }, 300);
}


;
</script>
