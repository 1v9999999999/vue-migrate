<template>
  <div class="inline-template-class-demo">
    <h2>inline-template + scoped 冲突 (Vue 3 移除)</h2>

    <!--
      真实 bug 场景:
      Vue 2:
        - inline-template 让子组件的内容作为模板在父作用域编译
        - 同时子组件有 scoped style 时, 数据属性选择器会叠加, 容易冲突
        - 子组件的 [data-v-xxx] 在 inline 模板里也会被加上, 导致样式不生效
      Vue 3:
        - 移除 inline-template
        - 必须用 slot 替代
        - scoped CSS 行为更严格

      业务危害:
        - 父组件样式意外应用到子组件 (反之亦然)
        - 迁移到 Vue 3 后整个模板失效
        - slot 替代需要重写
    -->

    <h3>1. inline-template (Vue 2 专属)</h3>
    <MyComponent inline-template>
      <div class="my-content">inline 模板内容 (父作用域编译)</div>
    </MyComponent>

    <hr />

    <h3>2. Vue 3 替代: 默认 slot</h3>
    <MyComponent>
      <div class="my-content" :class="$style.myContent">slot 模板内容</div>
    </MyComponent>

    <hr />

    <h3>3. scoped slot (更显式)</h3>
    <MyComponentScoped #default="{ scopedData }">
      <div>scoped slot: {{ scopedData }}</div>
    </MyComponentScoped>

    <hr />

    <p class="warning">
      ⚠️ Vue 3 完全移除 inline-template. 迁移时:
      <br />1. inline 模板内容 → 子组件 slot
      <br />2. 父作用域 data → 通过 props 或 provide/inject 显式传
      <br />3. scoped CSS 冲突 → 拆分子组件或 :slotted()
    </p>
  </div>
</template>

<script>
/**
 * inline-template 真实 bug 复现
 *
 * Vue 2 inline-template 机制:
 *   - 子组件标记 inline-template, 内容由父组件提供
 *   - 编译时使用父组件的作用域 (data, methods, computed)
 *   - 子组件自身的 data/methods 也可访问
 *   - 与 scoped 配合时, [data-v-xxx] 选择器会叠加, 容易错乱
 *
 * Vue 3 移除原因:
 *   - 作用域不清晰 (父 vs 子)
 *   - scoped CSS 行为难预测
 *   - 性能略差 (每次父 render 都重新编译)
 *
 * 迁移方案:
 *   1. 默认 slot: <MyComponent v-slot:default>...</MyComponent>
 *   2. 具名 slot:  <MyComponent v-slot:header>...</MyComponent>
 *   3. scoped slot: <MyComponent v-slot="{ data }">{{ data }}</MyComponent>
 */

const MyComponent = {
  name: 'MyComponent',
  props: {
    scopedData: { type: String, default: 'scoped-value' }
  },
  // Vue 2: 这里没有 template, 模板由 inline-template 提供
  // Vue 3: 必须有 template
  template: `
    <div class="my-component-wrapper">
      <slot>fallback content</slot>
    </div>
  `
}

const MyComponentScoped = {
  name: 'MyComponentScoped',
  data() {
    return { scopedData: 'from-child' }
  },
  template: `
    <div class="scoped-wrapper">
      <slot :scopedData="scopedData">default</slot>
    </div>
  `
}

export default {
  name: 'InlineTemplateClass',
  components: { MyComponent, MyComponentScoped }
}
</script>

<style scoped>
.inline-template-class-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.inline-template-class-demo h2 {
  color: #e6a23c;
  margin-top: 0;
}
.inline-template-class-demo h3 {
  color: #409eff;
  margin-top: 16px;
}
.my-component-wrapper,
.scoped-wrapper {
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
  padding: 12px;
  border-radius: 4px;
  margin: 8px 0;
}
.my-content {
  color: #67c23a;
  font-weight: bold;
}
.warning {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  color: #c45656;
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
