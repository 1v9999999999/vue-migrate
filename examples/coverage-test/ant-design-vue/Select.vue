<template>
  <div class="select-demo">
    <h3>基础 Select (v-model + options 2 种语法)</h3>
    <a-select
      v-model="value1"
      :options="simpleOptions"
      placeholder="请选择"
      style="width: 200px"
      allow-clear
    />
    <a-select
      v-model="value1"
      style="width: 200px"
    >
      <a-select-option v-for="opt in simpleOptions" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </a-select-option>
    </a-select>

    <h3>多选 + maxTagCount + tagRender</h3>
    <a-select
      v-model="value2"
      :options="tagOptions"
      mode="multiple"
      :max-tag-count="3"
      :max-tag-text-length="6"
      placeholder="多选"
      style="width: 300px"
      allow-clear
      :default-active-first-option="false"
      @change="onMultiChange"
    >
      <template slot="maxTagPlaceholder" slot-scope="omittedValues">
        <span style="color: red">+ {{ omittedValues.length }}...</span>
      </template>
      <template slot="tagRender" slot-scope="{ label, closable, onClose, value }">
        <a-tag :closable="closable" @close="onClose" :color="value === 'vue' ? 'blue' : 'green'">
          {{ label }}
        </a-tag>
      </template>
    </a-select>

    <h3>tags 模式 (自由输入)</h3>
    <a-select
      v-model="value3"
      mode="tags"
      placeholder="输入后回车"
      style="width: 300px"
      :token-separators="[',']"
    />

    <h3>combobox 模式</h3>
    <a-select
      v-model="value4"
      mode="combobox"
      :options="comboOptions"
      placeholder="搜索或输入"
      :filter-option="false"
      @search="onComboSearch"
    />

    <h3>remote search (远程搜索)</h3>
    <a-select
      v-model="value5"
      mode="multiple"
      :filter-option="false"
      :options="remoteOptions"
      placeholder="远程搜索"
      :not-found-content="remoteLoading ? '搜索中...' : '无数据'"
      @search="onRemoteSearch"
    />

    <h3>labelInValue + 3 事件 (change / search / select)</h3>
    <a-select
      v-model="value6"
      :options="simpleOptions"
      label-in-value
      @change="onLabelChange"
      @select="onSelectEvent"
      @deselect="onDeselect"
    />

    <h3>size 3 种 + disabled + loading</h3>
    <a-select v-model="value1" :options="simpleOptions" size="large" />
    <a-select v-model="value1" :options="simpleOptions" size="default" />
    <a-select v-model="value1" :options="simpleOptions" size="small" />
    <a-select v-model="value1" :options="simpleOptions" disabled />
    <a-select v-model="value1" :options="simpleOptions" :loading="true" />

    <h3>自定义 dropdownRender (Vue 2 旧用法)</h3>
    <a-select
      v-model="value7"
      placeholder="自定义 dropdown"
      style="width: 200px"
    >
      <template #dropdownRender="{ menu }">
        <v-node :el="menu" />
        <a-divider style="margin: 4px 0" />
        <div style="padding: 4px 8px; cursor: pointer" @mousedown="e => e.preventDefault()" @click="addItem">
          <a-icon type="plus" /> Add item
        </div>
      </template>
    </a-select>

    <h3>OptGroup (分组)</h3>
    <a-select v-model="value8" style="width: 200px">
      <a-select-opt-group v-for="g in grouped" :key="g.label">
        <template slot="label">
          <a-icon type="folder" /> {{ g.label }}
        </template>
        <a-select-option v-for="o in g.options" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-select-option>
      </a-select-opt-group>
    </a-select>
  </div>
</template>

<script>
import { Select } from 'ant-design-vue'

export default {
  name: 'AntSelectDemo',
  components: { VNode: { props: ['el'], render: h => h('div', [h('span', this.$slots.default), h('div', this.el)]) } },
  data() {
    return {
      value1: undefined,
      value2: [],
      value3: [],
      value4: undefined,
      value5: [],
      value6: undefined,
      value7: undefined,
      value8: undefined,
      simpleOptions: [
        { value: 'vue', label: 'Vue' },
        { value: 'react', label: 'React' },
        { value: 'angular', label: 'Angular' }
      ],
      tagOptions: [
        { value: 'vue', label: 'Vue' },
        { value: 'react', label: 'React' },
        { value: 'angular', label: 'Angular' },
        { value: 'svelte', label: 'Svelte' },
        { value: 'solid', label: 'Solid' }
      ],
      comboOptions: [],
      remoteOptions: [],
      remoteLoading: false,
      grouped: [
        { label: '前端', options: [{ value: 'vue', label: 'Vue' }, { value: 'react', label: 'React' }] },
        { label: '后端', options: [{ value: 'go', label: 'Go' }, { value: 'rust', label: 'Rust' }] }
      ]
    }
  },
  methods: {
    onMultiChange(value) {
      this.$message.info(`multi: ${value.length} selected`)
    },
    onComboSearch(value) {
      this.comboOptions = value ? ['a', 'b', 'c'].filter(x => x.includes(value)).map(x => ({ value: x, label: x })) : []
    },
    onRemoteSearch(value) {
      this.remoteLoading = true
      this.remoteOptions = []
      setTimeout(() => {
        this.remoteOptions = ['Apple', 'Banana', 'Cherry']
          .filter(x => x.toLowerCase().includes((value || '').toLowerCase()))
          .map(x => ({ value: x, label: x }))
        this.remoteLoading = false
      }, 300)
    },
    onLabelChange(value, option) {
      this.$message.info(`label change: ${value} (${option.label})`)
    },
    onSelectEvent(value, option) {
      console.log('select event', value, option)
    },
    onDeselect(value, option) {
      console.log('deselect', value, option)
    },
    addItem() {
      const newVal = `item-${Date.now()}`
      this.simpleOptions = [...this.simpleOptions, { value: newVal, label: 'New Item' }]
      this.value7 = newVal
    }
  }
}
</script>
