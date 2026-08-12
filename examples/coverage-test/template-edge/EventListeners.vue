<template>
  <div class="event-listeners-demo">
    <h2>v-on 对象语法 & $listeners 透传示例（Vue 2 → Vue 3 迁移）</h2>

    <!-- ====== 1. v-on 对象语法 ====== -->
    <!-- Vue 2 & 3 都支持 v-on="{ click: fn, focus: fn }" -->
    <button v-on="{ click: handleClick, focus: handleFocus, blur: handleBlur }">
      v-on 对象语法按钮（点我/聚焦/失焦）
    </button>
    <span class="log">{{ eventLog }}</span>

    <hr />

    <!-- ====== 2. v-on 对象 + @click.stop 混用 ====== -->
    <div class="outer" @click="handleOuterClick">
      <div class="inner"
        v-on="{ click: handleInnerClick, mouseenter: handleMouseEnter }"
        @click.stop="handleStopClick"
      >
        混用：v-on 对象 + @click.stop（内部）
      </div>
    </div>

    <hr />

    <!-- ====== 3. $listeners 透传到子组件 ====== -->
    <BaseButton
      @click="onTransmitClick"
      @focus="onTransmitFocus"
      @blur="onTransmitBlur"
      @mouseenter="onTransmitEnter"
    >
      事件透传按钮（$listeners）
    </BaseButton>

    <hr />

    <!-- ====== 4. v-on="$listeners" 直接透传 ====== -->
    <WrapperButton @custom-action="onCustomAction">
      <template #label>WrapperButton（v-on="$listeners"）</template>
    </WrapperButton>

    <hr />

    <!-- ====== 5. 合并 $listeners 与自定义事件 ====== -->
    <SmartInput
      @input="onSmartInput"
      @focus="onSmartFocus"
      @keyup="onSmartKeyup"
    />
  </div>
</template>

<script>
/**
 * Vue 2 $listeners：
 * - 包含父组件注册的所有事件监听器
 * - 常配合 v-on="$listeners" 实现事件透传
 *
 * Vue 3 变化：
 * - $listeners 被移除，事件监听器合并到 $attrs 中
 * - v-on="$listeners" → v-on="$attrs"（或直接用 inheritAttrs + $attrs）
 * - $attrs 包含事件监听器（onXxx 形式）和 attribute
 */

const BaseButton = {
  name: 'BaseButton',
  template: [
    '<button v-on="$listeners" class="base-btn">',
    '  <slot></slot>',
    '</button>'
  ].join('\n')
}

const WrapperButton = {
  name: 'WrapperButton',
  inheritAttrs: false,
  template: [
    '<div class="wrapper-btn">',
    '  <button v-on="$listeners">',
    '    <slot name="label"></slot>',
    '  </button>',
    '  <p>listeners keys: {{ listenerKeys }}</p>',
    '</div>'
  ].join('\n'),
  computed: {
    listenerKeys() {
      return Object.keys(this.$listeners).join(', ') || '(none)'
    }
  },
  methods: {
    // 子组件也可以在 $listeners 基础上包装
    relayEvent() {
      this.$emit('custom-action', { from: 'WrapperButton' })
    }
  }
}

const SmartInput = {
  name: 'SmartInput',
  inheritAttrs: false,
  data() {
    return { inner: '' }
  },
  template: [
    '<div class="smart-input-wrapper">',
    '  <input',
    '    v-on="combinedListeners"',
    '    v-model="inner"',
    '    placeholder="SmartInput"',
    '  />',
    '  <small>透传事件 + 自定义 input</small>',
    '</div>'
  ].join('\n'),
  computed: {
    combinedListeners() {
      // 合并 $listeners 与自身处理逻辑（Vue 2 经典模式）
      return Object.assign({}, this.$listeners, {
        input: (e) => {
          this.inner = e.target.value
          this.$emit('input', this.inner)
        }
      })
    }
  }
}

export default {
  name: 'EventListeners',
  components: { BaseButton, WrapperButton, SmartInput },
  data() {
    return {
      eventLog: ''
    }
  },
  methods: {
    handleClick() {
      this.eventLog = 'click @ ' + new Date().toLocaleTimeString()
    },
    handleFocus() {
      this.eventLog = 'focus @ ' + new Date().toLocaleTimeString()
    },
    handleBlur() {
      this.eventLog = 'blur @ ' + new Date().toLocaleTimeString()
    },
    handleOuterClick() {
      console.log('outer clicked')
    },
    handleInnerClick() {
      console.log('inner clicked (v-on object)')
    },
    handleStopClick() {
      console.log('inner clicked (@click.stop)')
    },
    handleMouseEnter() {
      console.log('mouse entered inner')
    },
    onTransmitClick() {
      this.eventLog = '透传 click'
    },
    onTransmitFocus() {
      this.eventLog = '透传 focus'
    },
    onTransmitBlur() {
      this.eventLog = '透传 blur'
    },
    onTransmitEnter() {
      this.eventLog = '透传 mouseenter'
    },
    onCustomAction(payload) {
      this.eventLog = 'custom-action: ' + JSON.stringify(payload)
    },
    onSmartInput(val) {
      console.log('SmartInput input:', val)
    },
    onSmartFocus() {
      console.log('SmartInput focused')
    },
    onSmartKeyup(e) {
      console.log('SmartInput keyup:', e.key)
    }
  }
}
</script>

<style scoped>
.event-listeners-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.event-listeners-demo h2 {
  color: #f56c6c;
  margin-top: 0;
}
.log {
  margin-left: 12px;
  color: #909399;
  font-style: italic;
}
.outer {
  padding: 20px;
  background: #f5f7fa;
  border: 1px dashed #c0c4cc;
}
.inner {
  padding: 12px;
  background: #ecf5ff;
  border: 1px solid #409eff;
  cursor: pointer;
}
.base-btn {
  padding: 8px 16px;
  background: #67c23a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.wrapper-btn {
  margin: 8px 0;
}
.wrapper-btn button {
  padding: 8px 16px;
  background: #e6a23c;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.smart-input-wrapper input {
  padding: 6px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
