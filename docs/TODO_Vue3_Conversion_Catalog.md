# Vue 2 → Vue 3 核心规则目录

**56 条规则**。每条规则标注：plugin / priority / 类型 / 影响文件数 / 状态。

## 全局替换（vue2-compat, priority 10）

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 1 | filter 移除 | `Vue.filter('xxx', fn)` | 删除 + 在 component 内部用函数替代 |
| 2 | `$on/$off/$once` 移除 | `this.$on('xxx', fn)` | 用 `mitt` 或 `addEventListener` |
| 3 | `$children` 移除 | `this.$children[0]` | 用 `template ref` |
| 4 | `$listeners` 移除 | `this.$listeners.click` | Vue 3 中合并到 `$attrs` |
| 5 | `$scopedSlots` 改名 | `this.$scopedSlots.xxx` | `this.$slots.xxx()` |
| 6 | `functional` 移除 | `functional: true` | 用函数式组件 |
| 7 | `inline-template` 移除 | `inline-template: true` | 默认行为 |
| 8 | `$set` 移除 | `this.$set(obj, k, v)` | 直接赋值（reactive） |
| 9 | `$delete` 移除 | `this.$delete(obj, k)` | `delete obj.k`（reactive） |
| 10 | `$destroy` 移除 | `this.$destroy()` | 用 `unmount` |
| 11 | keycode 修饰符移除 | `@keyup.13` | `@keyup.enter` |
| 12 | 过滤器模板移除 | `{{ x \| format }}` | 用 `{{ format(x) }}` |
| 13 | `v-on:click` 改写 | `v-on:click` | `@click` |
| 14 | `v-bind:src` 改写 | `v-bind:src` | `:src` |
| 15 | `slot="xxx"` 改写 | `slot="header"` | `#header` |
| 16 | `slot-scope` 移除 | `slot-scope="props"` | `v-slot="props"` |
| 17 | `<template slot="xxx">` | `<template slot="header">` | `<template #header>` |

## 入口改造（vue3-entry, priority 9）

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 18 | `new Vue({...}).$mount('#app')` | `new Vue({el:'#app', ...})` | `createApp(...).mount('#app')` |
| 19 | `Vue.use(plugin)` 转链式 | `Vue.use(Router)` | `createApp(App).use(Router)` |
| 20 | `import Vue from 'vue'` 移除 | `import Vue from 'vue'` | `import { createApp } from 'vue'` |
| 21 | `Vue.prototype.$http = axios` | 全局挂载 | `app.config.globalProperties.$http = axios` |
| 22 | `Vue.component('X', X)` | 全局注册 | `app.component('X', X)` |
| 23 | `Vue.directive('xxx', ...)` | `Vue.directive('xxx', fn)` | `app.directive('xxx', fn)` |
| 24 | `Vue.mixin({...})` | 全局 mixin | 移到 component `mixins: [...]` |
| 25 | `template: '<App/>'` + `components: {App}` 提取 | 内联 | `import App from './App'` |

## 模板改造（vue3-template, priority 9）

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 26 | `v-if` 在 `<template>` 上保持 | `<template v-if>` | 相同 |
| 27 | 多个 v-if 合并 v-show | — | — |
| 28 | `slot="default"` 移除 | 显式 default | 默认 slot |
| 29 | `slot-scope` 改 `v-slot` | `slot-scope="props"` | `v-slot="props"` |
| 30 | `<keep-alive>` 不需要 include attrs | 必填 | 默认包含所有 |
| 31 | `transition` name 默认 | `v-enter` | `v-enter-from` 等 |
| 32 | `v-html` 在 SSR 限制 | — | — |
| 33 | `v-once` 行为变化 | 静态优化 | 仍支持 |
| 34 | `v-pre` 跳过编译 | 行为不变 | 行为不变 |

## 指令改造（vue3-directives, priority 30）

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 35 | `.sync` 改 `v-model:prop` | `:visible.sync="x"` | `v-model:visible="x"` |
| 36 | `.native` 移除 | `@click.native` | 子组件 `emits: ['click']` |
| 37 | 自定义指令 `bind` 改名 | `bind(el, binding)` | `beforeMount` |
| 38 | 自定义指令 `inserted` 改名 | `inserted` | `mounted` |
| 39 | 自定义指令 `update` 拆分 | `update(el, binding)` | `beforeUpdate` + `updated` |
| 40 | 自定义指令 `unbind` 改名 | `unbind` | `unmounted` |
| 41 | `v-model` 默认 prop 改 `modelValue` | `value` | `modelValue` |
| 42 | `v-model` 默认 event 改 `update:modelValue` | `input` | `update:modelValue` |
| 43 | 多个 `v-model` 支持 | 单个 | 多个 `v-model:foo` |

## TypeScript 改造（vue3-types, priority 5）

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 44 | `Vue.extend` 改 `defineComponent` | `Vue.extend({...})` | `defineComponent({...})` |
| 45 | `PropType` 改 `import type` | `Prop<MyType>` | `PropType<MyType>` |
| 46 | `mixins` 类型推导 | 弱 | 强 |
| 47 | `data()` 返回类型注解 | 不需要 | `Data = { ... }` |
| 48 | `this` 在 method 推断 | 弱 | 强 |
| 49 | `defineComponent` 必填泛型 | — | `defineComponent<{}, {}, {}>()` |
| 50 | `ref<HTMLElement>()` 必填 | `ref="dom"` | `const dom = ref<HTMLElement>()` |
| 51 | `reactive<MyType>()` 推断 | — | 必填 |
| 52 | `defineProps<{...}>()` 替代 | `props: {x: String}` | `defineProps<{x: string}>()` |
| 53 | `defineEmits<{...}>()` 替代 | `emits: ['x']` | `defineEmits<{(e: 'x'): void}>()` |
| 54 | `expose()` 显式暴露 | — | `defineExpose({...})` |
| 55 | `withDefaults()` 默认值 | — | `withDefaults(defineProps<...>(), {...})` |
| 56 | TS 装饰器兼容 | `vue-property-decorator` | 用 `vue-class-component` 或不用装饰器 |

## Plugin 优先级图

```
composition (0)  →  Options→Setup，先跑
vue3-types (5)   →  TS 类型补全
vue2-compat (10) →  全局替换
vue3-entry (9)   →  入口改造
vue3-template (9)→  模板语法
vue-router-v4 (9)→  路由
vuex-pinia (9)   →  store
elementui (25)   →  UI 库
vue3-directives(30) → 指令（最后跑，避免覆盖）
```

## 影响范围

| 类别 | 文件数 | 占比 |
|---|---|---|
| 全局替换 | ~70% | 大量 |
| 入口改造 | 1-2 个 main.js | 必改 |
| 模板改造 | 几乎所有 .vue | 大部分 |
| 指令改造 | ~30% .vue | 中等 |
| TS 改造 | TS 项目 100% | 仅 TS 项目 |
