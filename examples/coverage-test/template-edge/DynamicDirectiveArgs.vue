<template>
  <div class="dynamic-directive-demo">
    <h2>动态指令参数示例（Vue 2.6+ 引入，Vue 3 支持）</h2>

    <div class="controls">
      <label>事件名：
        <select v-model="eventName">
          <option value="click">click</option>
          <option value="dblclick">dblclick</option>
          <option value="mouseenter">mouseenter</option>
          <option value="mouseleave">mouseleave</option>
        </select>
      </label>

      <label>属性名：
        <select v-model="propName">
          <option value="title">title</option>
          <option value="data-info">data-info</option>
          <option value="aria-label">aria-label</option>
          <option value="placeholder">placeholder</option>
        </select>
      </label>

      <label>属性值：
        <input v-model="propValue" placeholder="输入属性值" />
      </label>

      <label>指令名：
        <select v-model="directiveName">
          <option value="focus">focus（自动聚焦）</option>
          <option value="highlight">highlight（高亮）</option>
          <option value="resize">resize（监听尺寸）</option>
        </select>
      </label>
    </div>

    <hr />

    <!-- ====== 1. 动态事件参数 :[eventName] ====== -->
    <div class="section">
      <h3>1. 动态事件 v-on:[eventName]（简写 @[eventName]）</h3>
      <button @[eventName]="onDynamicEvent" class="demo-btn">
        触发动态事件: {{ eventName }}
      </button>
      <p class="log">事件日志：{{ eventLog || '（暂无）' }}</p>
    </div>

    <!-- ====== 2. 动态 prop 参数 :[propName] ====== -->
    <div class="section">
      <h3>2. 动态 prop / attribute :[propName]</h3>
      <div :[propName]="propValue" class="target-box">
        鼠标悬停查看动态属性（当前: {{ propName }}="{{ propValue }}"）
      </div>
    </div>

    <!-- ====== 3. 动态自定义指令 v-[directiveName] ====== -->
    <div class="section">
      <h3>3. 动态自定义指令 v-[directiveName]</h3>
      <input
        v-[directiveName]="directiveValue"
        :key="directiveName"
        class="directive-input"
        placeholder="动态指令作用于此处"
      />
      <p>当前指令：v-{{ directiveName }}，值：{{ directiveValue }}</p>
    </div>

    <!-- ====== 4. 动态参数 + 修饰符 ====== -->
    <div class="section">
      <h3>4. 动态参数 + 修饰符组合</h3>
      <button @[eventName].prevent="onDynamicEvent" class="demo-btn">
        @[eventName].prevent（阻止默认行为）
      </button>
    </div>

    <!-- ====== 5. 多动态参数同时使用 ====== -->
    <div class="section">
      <h3>5. 多动态参数混合</h3>
      <DynamicTarget
        :[propName]="propValue"
        @[eventName]="onDynamicEvent"
        @[secondEvent]="onSecondEvent"
      >
        <span>多动态参数子组件</span>
      </DynamicTarget>
    </div>

    <hr />

    <div class="raw-value">
      <label>指令值（传给 v-[directiveName]）：
        <input v-model="directiveValue" placeholder="例如 red / 300" />
      </label>
      <label>第二事件：
        <select v-model="secondEvent">
          <option value="focus">focus</option>
          <option value="blur">blur</option>
          <option value="keydown">keydown</option>
        </select>
      </label>
    </div>
  </div>
</template>

<script>
/**
 * 动态指令参数（Vue 2.6+ 引入）：
 * - :[propName]="value" — 动态属性/prop
 * - @[eventName]="handler" — 动态事件
 * - v-[directiveName]="value" — 动态自定义指令
 *
 * 注意事项：
 * - 动态参数期望一个字符串，null 可移除绑定
 * - 动态参数表达式有约束（不能含空格、引号）
 * - Vue 2 & 3 语法一致，迁移无需改动
 */

const DynamicTarget = {
  name: 'DynamicTarget',
  inheritAttrs: false,
  props: {},
  template: [
    '<div class="dynamic-target">',
    '  <slot></slot>',
    '  <p>attrs: {{ JSON.stringify($attrs) }}</p>',
    '</div>'
  ].join('\n')
}

export default {
  name: 'DynamicDirectiveArgs',
  components: { DynamicTarget },
  directives: {
    focus: {
      inserted(el) {
        el.focus()
      }
    },
    highlight: {
      inserted(el, binding) {
        el.style.backgroundColor = binding.value || 'yellow'
      },
      update(el, binding) {
        el.style.backgroundColor = binding.value || 'yellow'
      }
    },
    resize: {
      inserted(el, binding) {
        el._resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            console.log('resize observed:', entry.contentRect, 'value:', binding.value)
          }
        })
        el._resizeObserver.observe(el)
      },
      unbind(el) {
        if (el._resizeObserver) {
          el._resizeObserver.disconnect()
        }
      }
    }
  },
  data() {
    return {
      eventName: 'click',
      propName: 'title',
      propValue: '动态提示文本',
      directiveName: 'highlight',
      directiveValue: '#e6f7ff',
      secondEvent: 'focus',
      eventLog: ''
    }
  },
  methods: {
    onDynamicEvent(e) {
      this.eventLog = `${this.eventName} 触发于 ${new Date().toLocaleTimeString()}`
      console.log('动态事件：', this.eventName, e)
    },
    onSecondEvent(e) {
      console.log('第二事件：', this.secondEvent, e)
      this.eventLog = `${this.secondEvent} 触发于 ${new Date().toLocaleTimeString()}`
    }
  }
}
</script>

<style scoped>
.dynamic-directive-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.dynamic-directive-demo h2 {
  color: #00bcd4;
  margin-top: 0;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.controls label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.controls select,
.controls input {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
.section {
  margin: 20px 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}
.section h3 {
  margin-top: 0;
  color: #303133;
}
.demo-btn {
  padding: 8px 16px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.target-box {
  padding: 16px;
  border: 2px dashed #00bcd4;
  border-radius: 4px;
  cursor: help;
}
.directive-input {
  padding: 8px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  width: 300px;
}
.log {
  color: #909399;
  font-style: italic;
}
.dynamic-target {
  padding: 12px;
  border: 1px solid #e6a23c;
  border-radius: 4px;
}
.raw-value {
  margin-top: 12px;
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.raw-value label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}
.raw-value input,
.raw-value select {
  padding: 4px 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
