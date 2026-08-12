<template>
  <div :class="$style.container">
    <h1 :class="$style.title">CSS Modules + Composition API</h1>
    <p :class="$style.content">通过 &lt;style module&gt; 自动生成 hash class</p>

    <!--
      真实集成场景:
      <style module> 是 Vue 2.7+ 内置特性, 编译时生成 CSS Modules.
      每个 class 会被重命名为唯一 hash, 避免全局污染.

      Vue 2 用法:
        - <style module> → $style.xxx
        - <style module="custom"> → custom.xxx
      Vue 3 用法:
        - 同 Vue 2.7+
        - Composition API: const $style = useCssModule()
        - 多个 module: <style module="a"> <style module="b">

      优势:
        - 自动 scope 隔离
        - 与 TypeScript 配合 (types: string)
        - 支持 :class 数组组合
    -->

    <h2 :class="$style.subtitle">子组件示例</h2>

    <button :class="[$style.btn, $style.btnPrimary]" @click="onClick">
      Primary
    </button>
    <button :class="[$style.btn, $style.btnSecondary]">
      Secondary
    </button>

    <hr :class="$style.divider" />

    <h3 :class="$style.subtitle">条件 class (数组语法)</h3>
    <div :class="[$style.alert, isError ? $style.alertError : $style.alertOk]">
      {{ isError ? '错误状态' : '正常状态' }}
    </div>
    <button :class="$style.btn" @click="toggleState">toggle state</button>

    <hr :class="$style.divider" />

    <h3 :class="$style.subtitle">:class 传入外部 module</h3>
    <ChildModule :external-class="externalClass" />

    <hr :class="$style.divider" />

    <p :class="$style.note">
      ✅ 完整 API:
      <br />1. &lt;style module&gt; → $style
      <br />2. &lt;style module="custom"&gt; → custom
      <br />3. Composition API: useCssModule() / useCssModule('custom')
      <br />4. 与 scoped 同时使用: 同时开启两个特性
    </p>
  </div>
</template>

<script>
/**
 * CSS Modules + Composition API 集成
 *
 * Vue 2.7+ 内置 CSS Modules 支持
 * Vue 3 + Composition: import { useCssModule } from 'vue'
 *
 * 注意: 此文件同时使用了 <script setup> 风格的写法 (下方注释)
 * 实际项目用 Options API 或 Composition API 二选一
 */

// Composition API 风格 (如果用 setup)
// import { useCssModule } from 'vue'
// const $style = useCssModule()

const ChildModule = {
  name: 'ChildModule',
  props: {
    externalClass: { type: String, default: '' }
  },
  template: `
    <div :class="[externalClass, 'child-wrapper']">
      <p>子组件, 接收外部 module class</p>
    </div>
  `
}

export default {
  name: 'CssModules',
  components: { ChildModule },
  data() {
    return {
      isError: false,
      externalClass: 'from-parent'
    }
  },
  methods: {
    onClick() {
      console.log('CSS module button clicked')
    },
    toggleState() {
      this.isError = !this.isError
    }
  }
}
</script>

<!--
  Vue 2.7+ / Vue 3 <style module>:
  - 自动生成 hash class
  - 暴露为 $style 对象
  - <style module="name"> 暴露为 name 对象 (多 module 场景)
-->
<style module>
.container {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
  background: #fafafa;
}
.title {
  color: #1976d2;
  font-size: 24px;
  margin: 0 0 12px;
}
.subtitle {
  color: #424242;
  font-size: 18px;
  margin: 12px 0 8px;
}
.content {
  color: #616161;
  line-height: 1.6;
  margin-bottom: 16px;
}
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-right: 8px;
}
.btnPrimary {
  background: #1976d2;
  color: white;
}
.btnPrimary:hover {
  background: #1565c0;
}
.btnSecondary {
  background: white;
  color: #1976d2;
  border: 1px solid #1976d2;
}
.btnSecondary:hover {
  background: #e3f2fd;
}
.divider {
  border: none;
  border-top: 1px solid #e0e0e0;
  margin: 16px 0;
}
.alert {
  padding: 12px;
  border-radius: 4px;
  margin: 8px 0;
  font-weight: 500;
}
.alertOk {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}
.alertError {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}
.note {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
  color: #0d47a1;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.6;
  font-family: monospace;
}
</style>
