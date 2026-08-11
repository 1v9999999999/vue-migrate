<!--
  Vue 2 多 style 块共存穷举 (MultipleStyles.vue)
  iter-089 P3 验证:
    - scoped + unscoped(global) + module + scoped(nested) 多 style 块共存
    - lang 混用 (scss + postcss 简化版)
    - ::v-deep / /deep/ / >>> 三种旧穿透写法
    - :deep() 新穿透
    - :slotted() (Vue 3 新)
    - :global() (Vue 3 新)
    - CSS variable + scope 引用
    - @keyframes scoped vs global
    - postcss nesting & + scoped
    - @media query
    - CSS module 多 module 块 (生僻)
-->
<template>
  <div class="root root-cls">
    <header class="hdr">Header</header>
    <main>
      <el-button class="btn-primary" type="primary">Primary</el-button>
      <el-input class="inp" v-model="msg" />
      <slot>
        <p>Default slot content</p>
      </slot>
      <p class="theme-color">Theme color via CSS var</p>
      <p class="anim-fade">Animated</p>
    </main>
  </div>
</template>

<!-- ============ 1. scoped (主样式) ============ -->
<style scoped>
.root { padding: 1rem; font-family: system-ui; }
.hdr { color: #333; font-weight: bold; }
.btn-primary { margin: 8px 0; }

/* scoped 内 CSS 变量定义 (CSS var) */
.root {
  --primary: #409eff;
  --danger: #f56c6c;
  --spacing: 8px;
}
.theme-color { color: var(--primary); padding: var(--spacing); }

/* scoped 内 ::v-deep (Vue 2 旧穿透) */
.btn-primary ::v-deep .el-button__inner { color: red; }
.btn-primary /deep/ .el-button__inner { color: blue; }   /* /deep/ 写法 (生僻) */
.btn-primary >>> .el-button__inner { color: green; }     /* >>> 写法 (生僻) */

/* scoped 内 :deep() (Vue 3 新穿透) */
.btn-primary :deep(.el-button__inner) { color: yellow; }

/* scoped 内 @keyframes */
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.anim-fade { animation: fadeIn 0.3s; }

/* scoped 内 @media query */
@media (max-width: 768px) {
  .root { padding: 0.5rem; }
  .hdr { font-size: 14px; }
}

/* scoped 内 postcss nesting (&) */
.root-cls {
  & .hdr { color: red; }
  &:hover { background: yellow; }
  & > main { padding: 8px; }
}

/* scoped 内 :slotted() (Vue 3 新, 选 slotted 子组件根) */
:slotted(p) { color: green; }   /* 影响 <slot> 内 <p> */
</style>

<!-- ============ 2. global (无 attribute, 污染所有组件, 危险) ============ -->
<style>
/* 全局样式 — 影响所有 .el-button 元素 */
.el-button { border-radius: 4px; }
.el-button--primary { background: #409eff; }

/* 全局 CSS 变量覆盖 */
:root {
  --primary: #1890ff;   /* 覆盖 scoped 里的 --primary (就近) */
}

/* 全局 @keyframes — 不在 scoped 内 */
@keyframes global-pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
.global-pulse { animation: global-pulse 0.5s infinite; }

/* 全局 @layer cascade (CSS 新特性) */
@layer reset, base, components;
@layer reset { body { margin: 0; } }
@layer base { body { font-family: system-ui; } }
@layer components { .btn { padding: 8px; } }

/* 全局 :where() / :is() / :has() (CSS 新选择器) */
:where(h1, h2, h3) { color: gray; }
:is(.foo, .bar) { color: blue; }
.parent:has(.child) { border: 1px solid red; }

/* 全局 @scope (新) */
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

/* 全局 @media (在 scoped 之外的另一个 media) */
@media print {
  .root { display: none; }
}
</style>

<!-- ============ 3. module (CSS modules) ============ -->
<style module>
/* :export 暴露给 JS */
:export {
  brandColor: #67c23a;
  apiBase: /api/v1;
}

/* 普通 module 类 */
.moduleBox {
  border: 1px solid #dcdfe6;
  padding: 12px;
  margin: 8px 0;
}
.moduleTitle {
  font-weight: bold;
  color: v-bind(brandColor);  /* 生僻: module 引用 JS 变量 */
}

/* module 内 :global() (Vue 3 新, module 块内局部用 global) */
:global(.module-global) { color: orange; }

/* module 内 @media */
@media (max-width: 768px) {
  .moduleBox { padding: 4px; }
}
</style>

<!-- ============ 4. module 第二个块 (生僻: 多 module 块, 需要 $styleName 区分) ============ -->
<style module="$dark">
.darkBox {
  background: #000;
  color: #fff;
}
</style>

<!-- ============ 5. 第二个 scoped 块 (生僻: Vue 2/3 都支持多 scoped) ============ -->
<style scoped>
/* 第二个 scoped 块 — 跟第一个 scoped 效果一样 (都加 data-v-xxx) */
.inp { width: 200px; }

/* scoped 块 2 内 :deep() (Vue 3 新) */
.inp :deep(.el-input__inner) { border-color: green; }
</style>

<!-- ============ 6. 第二个 global 块 (生僻: 多 global 块 Vue 2 支持, Vue 3 也支持) ============ -->
<style>
/* 第二个 global 块 — 跟第一个 global 合并 */
.third-block { font-style: italic; }

/* @charset 必须在最前 (生僻) */
@charset "UTF-8";
</style>

<!-- ============ 7. lang 混用 (scss) ============ -->
<style lang="scss" scoped>
$radius: 4px;
.btn-primary { border-radius: $radius; }

/* SCSS 变量 + 嵌套 */
.btn-primary {
  &.is-disabled { opacity: 0.5; }
  & + .btn-next { margin-left: 4px; }
}

/* SCSS @function / @mixin */
@function px2rem($px) { @return $px / 16 * 1rem; }
@mixin ellipsis { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.long-text { @include ellipsis; max-width: px2rem(200); }
</style>

<!-- ============ 8. 第三个 module 块 (生僻: '$style' 默认 + '$styleA' 命名) ============ -->
<style module="$utils">
.utilClass {
  font-family: monospace;
}
</style>

<script>
export default {
  data() {
    return { msg: '' }
  },
  // 引用 CSS module 暴露的 :export
  computed: {
    styleModule() { return this.$style  // 默认 module 引用 },
    darkModule() { return this.$dark },   // 命名 module 引用
    utilsModule() { return this.$utils }  // 命名 module 引用
  },
  methods: {
    test() {
      console.log(this.styleModule.brandColor)  // 访问 module :export 变量
    }
  }
}
</script>
