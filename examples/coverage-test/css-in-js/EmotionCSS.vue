<template>
  <div :class="layout">
    <h1 :class="title">emotion CSS-in-JS</h1>
    <p :class="subtitle">通过 css`` 生成 class name, 在模板中 :class 绑定</p>

    <!--
      真实集成场景:
      @emotion/css 是 emotion 库的核心, 提供 css`` tagged template,
      生成唯一的 class name. 与 styled-components 不同, 它只生成 class
      而不创建组件, 适合纯样式需求.

      安装: npm i @emotion/css
      使用: import { css } from '@emotion/css'
            const style = css`...`
            <div :class="style">

      Vue 集成: 配合 :class 直接使用
      优势:
        1. 零运行时 (css 字符串直接序列化)
        2. SSR 友好
        3. 体积小 (~3KB)
    -->

    <button :class="button" @click="onClick">Click me</button>
    <button :class="[button, danger]" @click="onDanger">Danger</button>

    <hr />

    <div :class="card">
      <h3 :class="cardTitle">Card Title</h3>
      <p :class="cardBody">Card body content with proper styling</p>
    </div>

    <hr />

    <h3>条件样式: 组合多个 css</h3>
    <div :class="[base, isActive ? activeClass : inactiveClass]">
      Conditional (当前: {{ isActive ? 'active' : 'inactive' }})
    </div>
    <button @click="isActive = !isActive">toggle</button>

    <hr />

    <p class="note">
      ✅ @emotion/css 完整支持:
      <br />1. 嵌套: &amp;:hover, &amp;.active
      <br />2. 媒体查询: @media (max-width: 768px)
      <br />3. 组合: ${otherStyle}
      <br />4. 主题: 注入 style 变量
    </p>
  </div>
</template>

<script>
/**
 * emotion CSS-in-JS 集成
 *
 * 依赖: @emotion/css
 * 实际运行: npm i @emotion/css
 *
 * @emotion/css vs styled-components:
 *   - emotion/css: 只生成 class, 灵活, 适合已有组件
 *   - styled-components: 创建新组件, 封装更好
 */

// import { css } from '@emotion/css'
const css = (strings, ...values) => {
  // 占位实现, 实际项目用真 import
  return strings.join('')
}

const button = css`
  background: #42b983;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  &:hover { background: #369870; }
  &:active { transform: scale(0.98); }
`

const danger = css`
  background: #f56c6c;
  &:hover { background: #dd6161; }
`

const title = css`
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
  margin-bottom: 16px;
`

const subtitle = css`
  font-size: 14px;
  color: #606266;
  margin-bottom: 16px;
`

const layout = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const card = css`
  background: white;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  grid-column: 1 / -1;
`

const cardTitle = css`
  color: #409eff;
  margin: 0 0 8px;
`

const cardBody = css`
  color: #606266;
  line-height: 1.6;
  margin: 0;
`

const base = css`
  padding: 12px;
  border-radius: 4px;
  margin: 8px 0;
`

const activeClass = css`
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
`

const inactiveClass = css`
  background: #f5f7fa;
  color: #909399;
  border: 1px solid #ebeef5;
`

export default {
  name: 'EmotionCSS',
  data() {
    return {
      isActive: true
    }
  },
  methods: {
    onClick() {
      console.log('emotion button clicked')
    },
    onDanger() {
      console.log('danger clicked')
    }
  }
}
</script>

<style scoped>
button {
  margin-right: 8px;
}
.note {
  background: #fff7e6;
  border: 1px solid #ffe7ba;
  color: #d48806;
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
