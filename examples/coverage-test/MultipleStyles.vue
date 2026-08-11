<!--
  Vue 2 多 style 块共存穷举 (MultipleStyles.vue)
  iter-089 P3 验证 + iter-107 扩展: 引用 @/styles/ 目录的全局文件
    - scoped + unscoped(global) + module + scoped(nested) 多 style 块共存
    - lang 混用 (scss + postcss + stylus)
    - ::v-deep / /deep/ / >>> 三种旧穿透写法
    - :deep() 新穿透
    - :slotted() (Vue 3 新)
    - :global() (Vue 3 新)
    - CSS variable + scope 引用
    - @keyframes scoped vs global
    - postcss nesting & + scoped
    - @media query
    - CSS module 多 module 块 (生僻)
    - @import url() 外部 CSS
    - @use / @forward (Sass module)
    - @function / @mixin (SCSS 实际使用)
    - @if / @for / @each (Sass control flow)
    - BEM 命名 + 嵌套
    - @import 其他 .scss 文件
    - 主题切换 (light/dark/hc)
    - @container query
    - @supports
    - @charset
    - :where / :is / :has
    - @layer cascade
    - @scope
-->
<template>
  <div :class="['root', `theme-${theme}`, 'multiple-styles-demo']">
    <header class="hdr">
      <h1>Multiple Styles Demo (Vue 2 → Vue 3)</h1>
      <p class="theme-color">Theme: {{ theme }} (CSS var)</p>
    </header>

    <main>
      <!-- 引用 UI 库 + 自定义 class -->
      <el-button class="btn-primary" type="primary" @click="toggleTheme">
        Primary (自定义覆盖)
      </el-button>
      <a-button type="primary" class="btn-primary">A Button (LESS 覆盖)</a-button>

      <el-input class="inp" v-model="msg" placeholder="输入" />

      <!-- mixin ellipsis 引用 -->
      <p class="long-text">这是一段很长的文字测试 mixin ellipsis 省略号效果。Mixin 在 mixins.scss 里 @include ellipsis;</p>

      <!-- @function px2rem 引用 -->
      <div class="func-demo">Function 转换: width 200px → 12.5rem</div>

      <!-- 主题切换 -->
      <a-radio-group v-model="theme" style="margin: 12px 0">
        <a-radio-button value="light">Light</a-radio-button>
        <a-radio-button value="dark">Dark</a-radio-button>
        <a-radio-button value="high-contrast">HC</a-radio-button>
      </a-radio-group>

      <!-- CSS module 引用 -->
      <div :class="$style.moduleBox">
        <h4 :class="$style.moduleTitle">CSS Module (默认 $style)</h4>
        <p>动态类名: {{ $style.moduleBox }} (从 :export 暴露)</p>
        <p>brandColor: {{ brandColor }}</p>
      </div>

      <!-- 第二个 module (命名 $dark) -->
      <div :class="$dark.darkBox">Module $dark 块</div>

      <!-- 第三个 module (命名 $utils) -->
      <div :class="$utils.utilClass">Module $utils 块</div>

      <!-- 全局 class (global 块污染) -->
      <p class="global-pulse">Global pulse animation</p>
      <p class="third-block">Third block (global 块 2)</p>

      <!-- 外部 CSS module 文件 -->
      <div :class="moduleCard.card">
        <div :class="moduleCard.cardHeader">外部 .module.scss 引用</div>
        <div :class="moduleCard.cardBody">从 styles/module-styles.module.scss 导入</div>
        <div :class="moduleCard.cardFooter">
          <span :class="moduleCard.badgePrimary">Primary</span>
          <span :class="moduleCard.badgeSuccess">Success</span>
        </div>
      </div>

      <!-- 自定义 @keyframes (在 global 块) -->
      <p class="anim-fade">Animated (scoped 内 @keyframes fadeIn)</p>

      <!-- 媒体查询触发 -->
      <p class="hide-mobile">只在非移动端显示</p>

      <!-- prefers-color-scheme 媒体 (系统级) -->
      <p class="theme-aware">Theme aware (随系统主题)</p>

      <!-- @container query (卡片网格) -->
      <div class="card-grid">
        <div class="card-item">Item 1</div>
        <div class="card-item">Item 2</div>
        <div class="card-item">Item 3</div>
      </div>

      <!-- reduce motion (用户偏好) -->
      <p class="anim-bounce">这个动画在 prefers-reduced-motion 下会被禁用</p>

      <!-- @supports 渐进增强 -->
      <p class="supports-grid">如果你看到 grid 布局, 说明支持 display: grid</p>

      <slot>
        <p>Default slot content (会被 :slotted() 影响)</p>
      </slot>
    </main>

    <footer>
      <p class="no-print">不打印</p>
      <p class="print-only">打印时显示 (display: block !important)</p>
    </footer>
  </div>
</template>

<!-- ============ 1. scoped (主样式) — @import 全局变量 + mixin ============ -->
<style scoped>
@import '@/styles/variables.scss';
@import '@/styles/mixins.scss';

/* 引用全局 SCSS 变量 */
.root {
  @include clearfix;
  padding: $spacing-md;
  font-family: $font-family-base;
  font-size: $font-size-base;
  color: $text-primary;
  background: var(--bg-base);
  border: 1px solid $border-light;
  border-radius: $radius-md;
  box-shadow: $shadow-base;
}

.hdr {
  @include flex-between;
  border-bottom: 1px solid $border-light;
  padding-bottom: $spacing-sm;
  margin-bottom: $spacing-md;
}

.btn-primary {
  margin: $spacing-sm 0;
  /* 引用 mixin ellipsis */
  &__text {
    @include ellipsis;
    max-width: 200px;
  }
}

.inp {
  width: 100%;
  margin: $spacing-sm 0;
}

/* scoped 内 CSS 变量定义 */
.root {
  --primary: #{$color-primary};
  --danger: #{$color-danger};
  --spacing: #{$spacing-md};
}
.theme-color { color: var(--primary); padding: var(--spacing); }

/* scoped 内 ::v-deep (Vue 2 旧穿透) */
.btn-primary ::v-deep .el-button__inner { color: red; }
.btn-primary /deep/ .el-button__inner { color: blue; }
.btn-primary >>> .el-button__inner { color: green; }

/* scoped 内 :deep() (Vue 3 新穿透) */
.btn-primary :deep(.el-button__inner) { color: yellow; }

/* scoped 内 @keyframes */
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.anim-fade { animation: fadeIn 0.3s; }

/* scoped 内 @media query */
@media (max-width: 768px) {
  .root { padding: $spacing-sm; }
  .hdr { font-size: $font-size-sm; }
}

/* scoped 内 postcss nesting (&) */
.root-cls {
  & .hdr { color: red; }
  &:hover { background: yellow; }
  & > main { padding: $spacing-sm; }
}

/* scoped 内 :slotted() (Vue 3 新) */
:slotted(p) { color: green; }

/* scoped 内 :deep + :slotted 混用 */
.inp :deep(.el-input__inner) { border-color: green; }

/* prefers-reduced-motion (用户偏好) */
@media (prefers-reduced-motion: reduce) {
  .anim-fade { animation: none; }
}

/* @supports 检测 */
.supports-grid {
  display: flex;
  @supports (display: grid) {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: $spacing-sm;
  }
}
</style>

<!-- ============ 2. global (无 attribute) ============ -->
<style>
/* @import 外部 CSS (URL 形式, 真实项目会用 Vite 静态资源处理) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* 全局样式 */
.el-button { border-radius: 4px; }
.el-button--primary { background: #1890ff; }

/* 全局 CSS 变量覆盖 */
:root {
  --primary: #1890ff;
}

/* 全局 @keyframes */
@keyframes global-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.global-pulse { animation: global-pulse 0.5s infinite; }

/* 全局 @layer cascade */
@layer reset, base, components;
@layer reset { body { margin: 0; } }
@layer base { body { font-family: system-ui; } }
@layer components { .btn { padding: 8px; } }

/* 全局 :where() / :is() / :has() */
:where(h1, h2, h3) { color: gray; }
:is(.foo, .bar) { color: blue; }
.parent:has(.child) { border: 1px solid red; }

/* 全局 @scope */
@scope (.theme-dark) {
  :root { --bg: #000; }
}

/* 全局 @container query */
@container (width > 300px) {
  .root { font-size: 18px; }
}

/* 全局 @supports */
@supports (display: grid) {
  .root { display: grid; }
}

/* 全局 @media print */
@media print {
  .root { display: none; }
}
</style>

<!-- ============ 3. module (CSS modules) — @import sass functions ============ -->
<style module>
@import '@/styles/functions.scss';

:export {
  brandColor: #67c23a;
  apiBase: /api/v1;
}

.moduleBox {
  border: 1px solid #dcdfe6;
  padding: 12px;
  margin: 8px 0;
  @include truncate-with-tooltip;
}

.moduleTitle {
  font-weight: bold;
  /* v-bind 引用 JS 变量 (Vue 3 新) */
  color: v-bind(brandColor);
}

:global(.module-global) { color: orange; }

@media (max-width: 768px) {
  .moduleBox { padding: 4px; }
}

/* 嵌套 + @media */
.utilClass {
  &.is-active { color: green; }
  & + .next { margin-left: 4px; }
}
</style>

<!-- ============ 4. module 第二个 (命名 $dark) ============ -->
<style module="$dark">
.darkBox {
  background: #000;
  color: #fff;
  padding: 12px;
  border-radius: 8px;
}
</style>

<!-- ============ 5. 第二个 scoped 块 ============ -->
<style scoped>
.inp { width: 200px; }
.inp :deep(.el-input__inner) { border-color: green; }

/* 引用 mixin */
.long-text {
  @include ellipsis;
  max-width: 200px;
}

/* 引用 function */
.func-demo {
  width: px2rem(200);
  background: $color-primary;
  color: white;
  padding: 8px;
}
</style>

<!-- ============ 6. 第二个 global 块 ============ -->
<style>
.third-block { font-style: italic; }
@charset "UTF-8";
</style>

<!-- ============ 7. lang 混用 (scss) — 大量 SCSS 特性 ============ -->
<style lang="scss" scoped>
@import '@/styles/variables.scss';
@import '@/styles/mixins.scss';
@import '@/styles/functions.scss';

$radius: 4px;
.btn-primary { border-radius: $radius; }

.btn-primary {
  &.is-disabled { opacity: 0.5; }
  & + .btn-next { margin-left: 4px; }
}

/* @function (自定义) */
@function px2rem($px) { @return $px / 16 * 1rem; }

/* @mixin */
@mixin ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.long-text { @include ellipsis; max-width: px2rem(200); }

/* @if 控制流 */
.btn-primary {
  @if $color-primary == #1890ff {
    background: $color-primary;
  } @else {
    background: $color-success;
  }
}

/* @for 循环 */
@for $i from 1 through 3 {
  .col-#{$i} {
    width: percentage(calc($i / 12));
  }
}

/* @each 遍历 map */
$themes: (
  light: #ffffff,
  dark: #000000,
  hc: #ffff00
);
@each $name, $color in $themes {
  .theme-#{$name}-bg { background: $color; }
}

/* @while 循环 */
$j: 1;
@while $j <= 3 {
  .mt-#{$j} { margin-top: $j * 8px; }
  $j: $j + 1;
}

/* 嵌套 + 父选择器 (&) */
.link {
  color: $color-primary;
  &:hover { color: lighten($color-primary, 10%); }
  &:focus { outline: 2px solid $color-primary; }
  &::before { content: '→'; margin-right: 4px; }
}

/* %placeholder + @extend */
%btn-base {
  padding: 8px 16px;
  border-radius: $radius;
  border: 1px solid;
  cursor: pointer;
}
.btn-primary {
  @extend %btn-base;
  background: $color-primary;
}
.btn-secondary {
  @extend %btn-base;
  background: $color-light;
}

/* @at-root (跳出嵌套) */
.card {
  padding: 16px;
  @at-root .card__title {
    font-weight: bold;
  }
  @at-root .card__body {
    color: $text-secondary;
  }
}
</style>

<!-- ============ 8. 第三个 module 块 (命名 $utils) ============ -->
<style module="$utils">
.utilClass {
  font-family: monospace;
  font-size: 12px;
  padding: 4px 8px;
  background: #f5f5f5;
  border-radius: 4px;
}
</style>

<!-- ============ 9. lang=postcss 块 (生僻) ============ -->
<style lang="postcss" scoped>
.postcss-block {
  display: flex;
  gap: 8px;

  & > div {
    padding: 8px;
    background: #f0f0f0;
  }

  &:hover {
    background: #e0e0e0;
  }
}
</style>

<!-- ============ 10. lang=stylus 块 (生僻) ============ -->
<style lang="stylus" scoped>
.stylus-block
  display flex
  padding 12px
  background #fafafa

  > div
    margin-right 8px
</style>

<!-- ============ 11. lang=less 块 (生僻) ============ -->
<style lang="less" scoped>
@primary: #1890ff;
.less-block {
  color: @primary;
  padding: 8px;
  border: 1px solid @primary;
}
</style>

<script>
import moduleCard from '@/styles/module-styles.module.scss'

export default {
  name: 'MultipleStyles',
  data() {
    return {
      msg: '',
      theme: 'light',
      moduleCard
    }
  },
  computed: {
    brandColor() {
      // 引用 CSS module :export 暴露的 brandColor
      return '#67c23a'
    }
  },
  methods: {
    toggleTheme() {
      const themes = ['light', 'dark', 'high-contrast']
      const i = themes.indexOf(this.theme)
      this.theme = themes[(i + 1) % themes.length]
    }
  }
}
</script>
