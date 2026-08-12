<template>
  <div class="styled-components-demo">
    <h2>styled-components 风格 (vue3-styled-components)</h2>

    <!--
      真实集成场景:
      vue3-styled-components 是 Vue 3 移植的 styled-components 库,
      用 tagged template literal 创建组件, 支持 props 插值.

      Vue 2 替代: vue-styled-components (基本同 API, Vue 2.6+).

      安装: npm i vue3-styled-components
      迁移: Vue 2 → 3 时 API 大致兼容, 注意:
        - props 类型定义从 options 改为 { props: { ... } } 参数
        - 不再支持 mixin
        - 不再支持 keyframes helper
    -->

    <StyledDiv>
      <h2>标题</h2>
      <StyledButton primary size="large">Primary Large</StyledButton>
      <StyledButton primary>Primary</StyledButton>
      <StyledButton size="large">Large</StyledButton>
      <StyledButton>Default</StyledButton>
    </StyledDiv>

    <hr />

    <h3>动态 props 插值</h3>
    <StyledButton :primary="isPrimary" :size="size" @click="togglePrimary">
      Toggle ({{ size }})
    </StyledButton>

    <hr />

    <p class="note">
      ✅ vue3-styled-components 完整支持:
      <br />1. props 插值: ${p =&gt; p.primary ? 'red' : 'white'}
      <br />2. 嵌套规则: &amp;::before, &amp;:hover, &amp; &gt; span
      <br />3. media query: @media (max-width: 768px) { ... }
      <br />4. 主题: 通过 ThemeProvider 注入
    </p>
  </div>
</template>

<script>
/**
 * styled-components 集成
 *
 * 注意: 此示例依赖 vue3-styled-components (Vue 3) 或 vue-styled-components (Vue 2.6+)
 * 实际运行需要: npm i vue3-styled-components
 *
 * 本文件作为代码分析样本, 展示 styled 模式的 API 形式
 */

// import styled from 'vue3-styled-components'
// ↑ 实际项目用 import; 此处用变量占位以保证文件能被 parser 识别
const styled = null

const props = { primary: Boolean, size: String }
const StyledButton = styled
  ? styled('button', props)`
    background: ${p => p.primary ? '#42b983' : 'white'};
    color: ${p => p.primary ? 'white' : '#42b983'};
    font-size: ${p => p.size === 'large' ? '20px' : '14px'};
    padding: 8px 16px;
    border: 1px solid #42b983;
    border-radius: 4px;
    cursor: pointer;
    &:hover { opacity: 0.8; }
    &:disabled { opacity: 0.5; cursor: not-allowed; }
  `
  : { name: 'StyledButton', template: '<button><slot /></button>' }

const StyledDiv = styled
  ? styled('div')`
    padding: 16px;
    background: #f5f5f5;
    h2 { color: #42b983; }
    p { line-height: 1.6; }
  `
  : { name: 'StyledDiv', template: '<div><slot /></div>' }

export default {
  name: 'StyledComponents',
  components: { StyledButton, StyledDiv },
  data() {
    return {
      isPrimary: true,
      size: 'large'
    }
  },
  methods: {
    togglePrimary() {
      this.isPrimary = !this.isPrimary
      this.size = this.size === 'large' ? 'small' : 'large'
    }
  }
}
</script>

<style scoped>
.styled-components-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.styled-components-demo h2 {
  color: #9c27b0;
  margin-top: 0;
}
.note {
  background: #f3e5f5;
  border: 1px solid #e1bee7;
  color: #6a1b9a;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
