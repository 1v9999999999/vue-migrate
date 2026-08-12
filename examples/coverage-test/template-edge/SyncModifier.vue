<template>
  <div class="sync-parent">
    <h2>.sync 修饰符示例（Vue 2 → Vue 3 迁移：改用 v-model:foo）</h2>

    <div class="state-panel">
      <p>父组件状态：</p>
      <ul>
        <li>bar = {{ bar }}</li>
        <li>show = {{ show }}</li>
        <li>title = {{ title }}</li>
        <li>staticValue = {{ staticValue }}</li>
      </ul>
    </div>

    <!-- 多个 .sync 修饰符同时使用 -->
    <!-- Vue 2 写法：:foo.sync="bar"  →  Vue 3: v-model:foo="bar" -->
    <SyncChild
      :foo.sync="bar"
      :visible.sync="show"
      :title.sync="title"
      :static-prop="staticValue"
      class="child-wrapper"
      @custom-event="onCustomEvent"
    />

    <!-- 单独一个 .sync -->
    <SyncChild
      :foo.sync="bar"
      :static-prop="'only-foo-sync'"
    />

    <div class="actions">
      <button @click="resetAll">重置全部 .sync 状态</button>
      <button @click="bar = '父组件直接改的值'">父组件直接修改 bar</button>
    </div>
  </div>
</template>

<script>
/**
 * 子组件定义（内联，便于单文件自包含）
 * Vue 2 中 .sync 的本质：父组件监听 update:propName 事件并回写
 * 子组件通过 this.$emit('update:foo', newVal) 通知父组件
 */
const SyncChild = {
  name: 'SyncChild',
  props: {
    foo: { type: String, default: '' },
    visible: { type: Boolean, default: true },
    title: { type: String, default: '' },
    staticProp: { type: String, default: '' }
  },
  data() {
    return {
      localFoo: '',
      localTitle: ''
    }
  },
  watch: {
    foo: {
      immediate: true,
      handler(val) {
        this.localFoo = val
      }
    },
    title: {
      immediate: true,
      handler(val) {
        this.localTitle = val
      }
    }
  },
  template: [
    '<div class="sync-child">',
    '  <h3>SyncChild 子组件</h3>',
    '  <p>foo (props): {{ foo }}</p>',
    '  <input :value="localFoo" @input="onFooInput" placeholder="修改 foo" />',
    '  <p>title (props): {{ title }}</p>',
    '  <input :value="localTitle" @input="onTitleInput" placeholder="修改 title" />',
    '  <p>visible: {{ visible }}</p>',
    '  <button @click="toggleVisible">切换 visible（emit update:visible）</button>',
    '  <p>staticProp (普通绑定): {{ staticProp }}</p>',
    '  <button @click="emitCustom">发送自定义事件</button>',
    '</div>'
  ].join('\n'),
  methods: {
    onFooInput(e) {
      this.localFoo = e.target.value
      // .sync 的核心：emit 'update:propName'
      this.$emit('update:foo', this.localFoo)
    },
    onTitleInput(e) {
      this.localTitle = e.target.value
      this.$emit('update:title', this.localTitle)
    },
    toggleVisible() {
      this.$emit('update:visible', !this.visible)
    },
    emitCustom() {
      // .sync 与普通事件可以共存
      this.$emit('custom-event', { time: Date.now(), source: 'SyncChild' })
    }
  }
}

export default {
  name: 'SyncModifier',
  components: { SyncChild },
  data() {
    return {
      bar: 'hello sync',
      show: true,
      title: '初始标题',
      staticValue: '我是普通单向绑定'
    }
  },
  methods: {
    onCustomEvent(payload) {
      console.log('收到 custom-event：', payload)
    },
    resetAll() {
      this.bar = 'hello sync'
      this.show = true
      this.title = '初始标题'
    }
  }
}
</script>

<style scoped>
.sync-parent {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.sync-parent h2 {
  margin-top: 0;
  color: #409eff;
}
.state-panel {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}
.state-panel ul {
  margin: 0;
  padding-left: 20px;
}
.child-wrapper {
  margin: 12px 0;
  padding: 12px;
  border: 1px dashed #e6a23c;
  border-radius: 4px;
}
.actions {
  margin-top: 16px;
}
.actions button {
  margin-right: 8px;
  padding: 6px 16px;
  cursor: pointer;
}
</style>
