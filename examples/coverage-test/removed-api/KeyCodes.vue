<template>
  <div class="key-codes">
    <h3>KeyCodes Demo</h3>
    <p>按 F1 触发: {{ f1Count }} 次</p>
    <p>按 Cancel 触发: {{ cancelCount }} 次</p>
    <p>按自定义 custom 触发: {{ customCount }} 次</p>

    <input
      ref="input"
      placeholder="按 F1 / Esc / custom"
      @keyup.f1="onF1"
      @keyup.cancel="onCancel"
      @keyup.custom="onCustom"
    />
  </div>
</template>

<script>
import Vue from 'vue'

// Vue.config.keyCodes = { f1: 112, cancel: 27, custom: [38, 40] }
Vue.config.keyCodes = {
  f1: 112,
  cancel: 27,
  custom: [38, 40]
}

// Vue.config.keyCodes.custom = 13 —— 覆盖单个按键定义
Vue.config.keyCodes.custom = 13

export default {
  name: 'KeyCodes',
  data() {
    return {
      f1Count: 0,
      cancelCount: 0,
      customCount: 0
    }
  },
  methods: {
    // @keyup.f1="handler" 自定义按键
    onF1() {
      this.f1Count++
    },
    // @keyup.cancel="onCancel"
    onCancel() {
      this.cancelCount++
    },
    // @keyup.custom="onCustom"
    onCustom() {
      this.customCount++
    }
  }
}
</script>

<style scoped>
.key-codes {
  padding: 16px;
  border: 1px solid #eee;
}
.key-codes input {
  margin-top: 8px;
  padding: 4px 8px;
}
</style>
