# Vue 2 → Vue 3 迁移 — Coverage Taxonomy (代码类型分类清单)

> iter-088 P3 验证 — 第一步:穷举 Vue 2 项目里所有出现的代码类型,做完整分类。
> 后续轮次按这个分类,1 个 module / 1 个文件 1 轮,逐步落实到 `examples/coverage-test/` 目录。

## 0. 总体策略

按 **项目结构** → **文件类型** → **写法 (pattern)** → **生僻变体** 4 层穷举:

```
项目结构
├── 入口文件
├── 业务组件 (.vue)
├── 公共组件 / 工具组件
├── 路由 (router/)
├── 状态管理 (store/)
├── API / service 层
├── 工具 (utils/)
├── 静态资源 (assets/, public/)
├── 配置 (config/, env)
├── 构建配置 (vue.config.js / vite.config.js)
├── 类型定义 (.d.ts)
└── 测试文件 (tests/)
```

## 1. 文件类型清单 (12 大类)

### 1.1 入口文件

| 文件 | Vue 2 写法 | Vue 3 改法 |
|------|-----------|-----------|
| `main.js` / `main.ts` | `new Vue({...}).$mount('#app')` | `createApp(App).use(...).mount('#app')` |
| `entry-client.js` (SSR) | 同上 + 异步 bootstrap | 同上 |
| `entry-server.js` (SSR) | `new Vue({...}).$mount()` + `return { app, router, store }` | `createSSRApp(App).mount()` |

### 1.2 单文件组件 (.vue)

按 `<template>` / `<script>` / `<style>` 3 段独立穷举 (见 2-4 节)。

### 1.3 路由文件

| 文件 | Vue Router 3 写法 | Vue Router 4 改法 |
|------|------------------|-----------------|
| `router/index.js` | `new Router({...})` | `createRouter({history, routes})` |
| `router/routes/*.js` | 静态路由表 | 不变 (只是导出方式) |
| `router/guards.js` | `router.beforeEach(...)` | 不变 (API 兼容) |

### 1.4 状态管理

| 文件 | Vuex 3/4 写法 | Pinia 改法 |
|------|---------------|-----------|
| `store/index.js` | `new Vuex.Store({...})` | `createPinia()` + `defineStore()` |
| `store/modules/*.js` | `namespaced: true` + types | `defineStore(id, () => {...})` |
| `store/types.js` | `export const X = 'X'` mutation types | 删除 (Pinia 用 store.X 直接调用) |
| `store/plugins/*.js` | `store: { state, commit }` | `pinia.use(({store}) => {...})` |

### 1.5 API / service 层

| 文件 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `api/user.js` | `import axios from 'axios'; export const login = data => axios.post(...)` | 大致不变 (axios 升级 v1+) |
| `api/interceptor.js` | `axios.interceptors.request.use(...)` | 不变 |
| `api/mock.js` | `Mock.mock(...)` (mockjs) | 不变 (3rd-party) |

### 1.6 工具 (utils/)

| 文件 | 写法 |
|------|------|
| `utils/format.js` | 纯函数 |
| `utils/storage.js` | localStorage 包装 (Vue 2 跟 Vue 3 一样) |
| `utils/permission.js` | 自定义 RBAC 逻辑 |
| `utils/request.js` | axios 封装 |
| `utils/validate.js` | 表单验证 |
| `directives/*.js` | 自定义指令 (跟 2.5 节共享) |
| `filters/*.js` | 全局 filter (Vue 3 移除 options.filters, 但纯函数仍可 import) |
| `mixins/*.js` | mixin (Vue 3 不推荐) |
| `composables/*.js` (Vue 3) | 替代 mixin (新增) |

### 1.7 配置 (config/)

| 文件 | 用途 |
|------|------|
| `vue.config.js` | vue-cli 配置 (Vue 2/3 共有) |
| `vite.config.js` | Vite 配置 (Vue 3 新增) |
| `.env` / `.env.development` / `.env.production` | 环境变量 (Vue 2 跟 Vue 3 一样) |
| `tsconfig.json` | TypeScript 配置 |
| `babel.config.js` / `.babelrc` | Babel 配置 |
| `postcss.config.js` | PostCSS 配置 |
| `package.json` | 依赖 + scripts |
| `.eslintrc.js` | ESLint 配置 |

### 1.8 测试文件

| 文件 | 写法 |
|------|------|
| `tests/unit/*.spec.js` | `@vue/test-utils` + Jest/Mocha |
| `tests/e2e/*.spec.js` | Cypress / Playwright |
| `__mocks__/*.js` | mock 文件 |

### 1.9 静态资源

| 文件 | 写法 |
|------|------|
| `assets/images/*.png` / `*.svg` | 静态资源 |
| `assets/fonts/*.woff` | 字体 |
| `public/index.html` | HTML 入口 |
| `public/favicon.ico` | favicon |

### 1.10 类型定义

| 文件 | 用途 |
|------|------|
| `types/*.d.ts` | 全局类型 (Vue.extend, etc.) |
| `shims-*.d.ts` | 旧项目 shim (例如 `shims-vue.d.ts`) |
| `globals.d.ts` | 全局变量声明 |

### 1.11 移动端 / 跨端

| 框架 | 特点 |
|------|------|
| uni-app | Vue 2 跟 Vue 3 写法差异 |
| Taro | React 跟 Vue 双版本 |
| Weex | 已 deprecated |
| 微信小程序 (mpvue / wepy) | Vue 2 时代 |

### 1.12 SSR / SSG

| 框架 | 特点 |
|------|------|
| Nuxt 2 | Vue 2 时代, Nuxt 3 升 Vue 3 |
| Nuxt 3 | Vue 3, Vite 默认 |
| 自建 SSR (entry-client.js + entry-server.js) | Vue 2 跟 Vue 3 写法差异 |

## 2. .vue 模板 (<template>) 穷举

### 2.1 基础指令

| 指令 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `v-if` | `<p v-if="cond">` | 不变 |
| `v-else-if` / `v-else` | 链式 | 不变 |
| `v-show` | `<p v-show="visible">` | 不变 |
| `v-for` | `<li v-for="(item, i) in items" :key="item.id">` | 不变 (但 `<template v-for>` + `v-if` 优先级 Vue 2 vs 3 变) |
| `v-pre` / `v-cloak` / `v-once` | 不变 | 不变 |

### 2.2 绑定指令

| 指令 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `v-bind` 完整 | `v-bind="obj"` | 不变 |
| `v-bind:class` 数组 | `:class="[activeClass, errorClass]"` | 不变 |
| `v-bind:class` 对象 | `:class="{ active: isActive, 'text-danger': hasError }"` | 不变 |
| `v-bind:style` 对象 | `:style="{ color: color, fontSize: size + 'px' }"` | 不变 |
| `v-bind:style` 数组 | `:style="[baseStyles, overridingStyles]"` | 不变 |
| `v-bind:prop` (单 prop) | `:prop="value"` | 不变 |
| `v-bind.sync` | `:foo.sync="bar"` | `v-model:foo="bar"` |
| `v-bind="object"` 全 | 跟 `v-bind:foo` 混合 | 不变 |

### 2.3 事件指令

| 指令 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `v-on:click` | `@click="handler"` | 不变 |
| `v-on:click.stop` | 修饰符 | 不变 |
| `v-on:click.prevent` | 修饰符 | 不变 |
| `v-on:click.once` | 修饰符 | 不变 |
| `v-on:click.self` | 修饰符 | 不变 |
| `v-on:click.passive` | 修饰符 | 不变 |
| `v-on:click.capture` | 修饰符 | 不变 |
| `v-on:keyup.enter` | 按键修饰符 | 不变 |
| `v-on:keyup.esc` | 按键修饰符 | 不变 |
| `v-on:keyup.delete` | 按键修饰符 (生僻) | 不变 |
| `v-on:keyup.space` | 按键修饰符 (生僻) | 不变 |
| `v-on:keyup.tab` | 按键修饰符 (生僻) | 不变 |
| `v-on:keyup.up/down/left/right` | 方向键 | 不变 |
| `v-on:keyup.ctrl` / `.alt` / `.shift` / `.meta` | 系统键 | 不变 |
| `v-on:keyup.ctrl.enter` | 组合键 | 不变 |
| `v-on:click.exact` | 精确系统键 (Vue 2.5+) | 不变 |
| `v-on:click.left/right/middle` | 鼠标按键修饰符 | 不变 |
| `v-on:scroll.passive` | 滚动性能 | 不变 |
| `v-on="listeners"` (object) | 监听对象 (生僻) | `v-on="listeners"` 仍可用,但 event 名要带 onXxx 前缀 |
| 自定义事件 + 修饰符 | `@my-event.passive` | 不变 |

### 2.4 v-model 指令

| 形态 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `<input v-model="x">` | input 默认 | 不变 |
| `<input v-model.lazy="x">` | 修饰符 | 不变 |
| `<input v-model.number="x">` | 修饰符 | 不变 |
| `<input v-model.trim="x">` | 修饰符 | 不变 |
| `<my-input v-model="x">` | 自定义组件 model 选项 | `v-model` 默认 `modelValue` + `update:modelValue` |
| `<my-input :value="x" @input="x = $event">` | 手写 v-model 模拟 | `v-model="x"` |
| `<my-input v-model:title="x">` (Vue 3) | 多 v-model | Vue 2 用 `:title.sync="x"` (生僻) |
| `<my-input v-model:visible="show">` | 多个 v-model | `:visible.sync="show"` (Vue 2) |
| `<input v-model="x" v-model:custom="y">` | 不允许 | 不允许 |
| `<el-form v-model="form">` | 第三方 UI v-model | 视 UI 库 |

### 2.5 自定义指令

| 形态 | 写法 | Vue 3 改法 |
|------|------|-----------|
| 全局注册 | `Vue.directive('name', { ... })` | `app.directive('name', { ... })` |
| 局部注册 | `directives: { name: {...} }` | 同 |
| `bind` (Vue 2 老钩子) | `bind(el, binding)` | `beforeMount(el, binding)` |
| `inserted` (Vue 2 老钩子) | `inserted(el, binding)` | `mounted(el, binding)` |
| `update` (Vue 2 老钩子) | `update(el, binding)` | `beforeUpdate(el, binding)` |
| `componentUpdated` (Vue 2 老钩子) | `componentUpdated(el, binding)` | `updated(el, binding)` |
| `unbind` (Vue 2 老钩子) | `unbind(el, binding)` | `unmounted(el, binding)` |
| 动态参数 | `v-foo:arg.modifier="value"` | 不变 |
| 简写 callback | `directives: { foo: (el) => el.focus() }` | 仅 `mounted` + `updated` |
| 简写 mounted (Vue 3) | `directives: { foo(el) { ... } }` | 等价于 `mounted` |

### 2.6 内置 template 标签

| 标签 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `<slot>` 默认 | `<slot/>` | 不变 |
| `<slot name="x">` 具名 | 不变 | 不变 |
| `<slot :data="x">` scoped | 不变 | 不变 (改 #slot 语法) |
| `<template slot="x">` | 不推荐 (Vue 2 旧) | `<template #x>` |
| `<template slot-scope="props">` | scoped slot | `<template #default="props">` |
| `<template v-slot:x="props">` | 完整语法 | 不变 (但 Vue 3 推广 #x 简写) |
| `<template #default="props">` (Vue 3) | 简写 | 推荐 |
| `<slot v-bind:foo="bar">` (Vue 2.6) | 多 prop 传递 | `<slot :foo="bar">` |
| `<keep-alive>` | `<keep-alive><component/></keep-alive>` | 不变 |
| `<keep-alive include/exclude/max>` | 缓存规则 | 不变 |
| `<transition>` | `<transition name="fade">` | 不变 |
| `<transition-group>` | list 动画 | 不变 |
| `<component :is="X">` | 动态组件 | 不变 |
| `<component :is="{ template: '...' }">` | 内联 component (生僻) | 不变 |
| `<teleport to="body">` (Vue 3) | 新增 | 不适用 Vue 2 |
| `<suspense>` (Vue 3) | 异步组件 fallback | 不适用 Vue 2 |
| `<fragment>` (Vue 3 多 root) | 多 root 支持 | 不适用 Vue 2 |
| `<template>` 隐式 fragment (Vue 3) | 多 root | Vue 2 需要 1 个根 |

### 2.7 v-bind / v-on 对象形式

| 形态 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `v-bind="{ id: foo, name: bar }"` | 动态属性 | 不变 |
| `v-on="{ click: handler, focus: focusHandler }"` | 动态事件 | 不变 (Vue 2.4+) |
| 混入时 `:foo` + `v-bind="rest"` | 合并 | Vue 3 合并行为略变 |

### 2.8 模板特殊语法

| 形态 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `{{ msg }}` mustache | 不变 | 不变 |
| `{{ msg \| upper }}` 过滤器 | 不推荐 | 删 filter, 用 method |
| `{{ msg \| upper(arg) }}` 过滤器带参 | 不推荐 | 同 |
| `{{{ html }}}` 三括号 (Vue 1 旧) | 不适用 Vue 2 | 不适用 |
| `v-html` | 不变 | 不变 |
| `v-text` | 不变 | 不变 |
| `v-once` | 不变 | 不变 |
| `v-pre` | 不变 | 不变 |
| `v-cloak` | 防闪烁 | 不变 |
| `v-pre` + `v-cloak` | 组合 | 不变 |
| `inline-template` (生僻) | `<my-comp inline-template>` | 删除 (需手动 <slot> 注入) |

## 3. .vue script (<script>) 穷举

### 3.1 组件配置 options

| 字段 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `name` | `name: 'MyComp'` | 不变 |
| `components` | 局部注册 | 不变 |
| `directives` | 局部注册 | 不变 |
| `mixins` | `mixins: [mixA, mixB]` | 不推荐, 改 composables |
| `extends` | `extends: CompA` | 不推荐 |
| `provide / inject` | `provide() { return {...} }` | 不变 |
| `model` | `model: { prop, event }` | 默认 `modelValue` + `update:modelValue` |
| `inheritAttrs` | `inheritAttrs: false` | 不变 |
| `customOptions` (3rd-party 字段) | `myOption: ...` | 不变 (运行时存在) |

### 3.2 数据相关

| 字段 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `data` 对象 | `data: { msg: 'hi' }` | 删 (跟 Vue 实例冲突) |
| `data` 工厂 | `data() { return {...} }` | 不变 |
| `data` async 工厂 (生僻) | `async data() {...}` | 不支持 |
| `props` 数组 | `props: ['a', 'b']` | `defineProps(['a', 'b'])` |
| `props` 对象 (type only) | `props: { a: String }` | `defineProps<{a: string}>()` |
| `props` 对象 (type + default) | `props: { a: { type: String, default: '' } }` | `defineProps<T>()` + `withDefaults` |
| `props` validator | `props: { a: { validator(v) {...} } }` | 不支持 validator (用 computed 验证) |
| `computed` getter | `computed: { x() { return ... } }` | `computed(() => ...)` |
| `computed` setter | `x: { get() {...}, set(v) {...} }` | 同样形式 (但需要 ref) |
| `methods` | `methods: { foo() {...} }` | 函数声明 (不挂对象) |
| `watch` 简写 | `watch: { x(new, old) {...} }` | `watch(x, (new, old) => ...)` |
| `watch` 完整 | `watch: { x: { handler, deep, immediate } }` | `watch(x, ..., { deep, immediate })` |
| `watch` 字符串 key | `watch: { 'a.b.c': 'method' }` | 不支持 (用 computed) |
| `watch` immediate | `immediate: true` | 不变 |
| `watch` deep | `deep: true` | 不变 |
| `watch` flush | `flush: 'post'` | 不变 |

### 3.3 生命周期 hooks

| Vue 2 hook | Vue 3 改法 |
|-----------|-----------|
| `beforeCreate` | 删除 (setup 自动) |
| `created` | 删除 (setup 自动) |
| `beforeMount` | `onBeforeMount` |
| `mounted` | `onMounted` |
| `beforeUpdate` | `onBeforeUpdate` |
| `updated` | `onUpdated` |
| `beforeDestroy` | `onBeforeUnmount` |
| `destroyed` | `onUnmounted` |
| `activated` | `onActivated` |
| `deactivated` | `onDeactivated` |
| `errorCaptured` | `onErrorCaptured` |
| `renderTracked` (Vue 2.5+) | `onRenderTracked` |
| `renderTriggered` (Vue 2.5+) | `onRenderTriggered` |
| `serverPrefetch` (SSR) | `onServerPrefetch` |
| `errorCaptured` 多实例 (链式) | 不变 |

### 3.4 Vue 2 移除的 instance API (this.X)

| API | 替代方案 |
|-----|---------|
| `this.$children` | 模板 ref 数组 |
| `this.$root` | `app.config.globalProperties` 或 `provide/inject` |
| `this.$listeners` | `this.$attrs` (合并) |
| `this.$scopedSlots` | `this.$slots` |
| `this.$vnode` | `getCurrentInstance()` |
| `this.$isServer` | `import.meta.env.SSR` |
| `this.$isDestroyed` | `onUnmounted` |
| `this.$on / $off / $once` | mitt / tiny-emitter |
| `this.$set / $delete` | 直接赋值 (响应式自动) |
| `this.$forceUpdate` | `triggerRef()` |
| `this.$options.componentName` | `defineOptions({ name: 'X' })` |
| `this.$options.propsData` | `props` (组合式 API) |
| `this.$ssrContext` (SSR) | `useSSRContext()` |
| `this.$createElement` (render fn) | `h` from 'vue' |

### 3.5 Vue 2 移除的 Options API 字段

| 字段 | 替代方案 |
|------|---------|
| `filters: {...}` | 删, 用 method 或 import 函数 |
| `functional: true` (SFC) | 删, 用函数式组件 `(props) => h(...)` |
| `inserted / unbind` (directive) | `mounted / unmounted` |
| `Vue.config.keyCodes` | 删 (用 `event.key`) |
| `Vue.config.errorHandler` callback 第 4 参数 `info` | 不变 (3 参) |
| `Vue.config.async` | 已 deprecated |
| `Vue.config.ignoredElements` | 删 (用 compilerOptions.isCustomElement) |
| `Vue.config.devtools = true` | 不变 |
| `Vue.config.performance` | `app.config.performance` |

### 3.6 Vue 2 静态 API (Vue.X)

| API | 替代方案 |
|-----|---------|
| `Vue.use(plugin, opts)` | `app.use(plugin, opts)` |
| `Vue.component(name, comp)` | `app.component(name, comp)` |
| `Vue.directive(name, def)` | `app.directive(name, def)` |
| `Vue.filter(name, fn)` | 删 (用 method) |
| `Vue.mixin(obj)` | `app.mixin(obj)` |
| `Vue.extend(Comp)` | 删 (用 `defineComponent`) |
| `Vue.set(obj, key, val)` | 直接赋值 (响应式) |
| `Vue.delete(obj, key)` | `delete obj.key` |
| `Vue.nextTick(cb)` | `nextTick(cb)` from 'vue' |
| `Vue.observable(obj)` | `reactive(obj)` |
| `Vue.compile(template)` | 删 (用 `@vue/compiler-dom`) |
| `Vue.version` | 不变 (运行时) |
| `Vue.config.*` | `app.config.*` |
| `Vue.prototype.$x = ...` | `app.config.globalProperties.$x = ...` |
| `new Vue({...})` | `createApp(...).mount()` |
| `Vue.config.productionTip` | 删 |
| `Vue.config.silent` | 删 |
| `Vue.config.devtools` | `app.config.devtools` |
| `Vue.config.performance` | `app.config.performance` |

## 4. .vue style (<style>) 穷举

### 4.1 块属性

| 属性 | 写法 | Vue 3 改法 |
|------|------|-----------|
| `scoped` | `<style scoped>` | 不变 |
| `module` (CSS modules) | `<style module>` | 不变 |
| `lang="scss"` | `<style lang="scss">` | 不变 (装 sass-loader) |
| `lang="less"` | `<style lang="less">` | 不变 |
| `lang="stylus"` | `<style lang="stylus">` | 不变 |
| `lang="postcss"` | `<style lang="postcss">` | 不变 |
| `lang="css"` (默认) | `<style>` | 不变 |
| 多 style 块 | 多个 `<style>` 共存 | 不变 (Vue 2 跟 Vue 3 都支持) |

### 4.2 样式穿透

| 写法 | Vue 2 状态 | Vue 3 改法 |
|------|-----------|-----------|
| `>>>` (生僻) | `<style scoped> .x >>> .y {} </style>` | 删除 |
| `/deep/` (生僻) | `<style scoped> .x /deep/ .y {} </style>` | 删除 |
| `::v-deep` | `<style scoped> .x ::v-deep .y {} </style>` | 改 `:deep(.y)` |
| `:deep()` (Vue 3) | 不适用 | `<style scoped> .x :deep(.y) {} </style>` |
| `:slotted()` (Vue 3) | 不适用 | `<style scoped> :slotted(.x) {} </style>` (slotted 子组件根) |
| `:global()` (Vue 3) | 不适用 | `<style scoped> :global(.x) {} </style>` |

### 4.3 CSS 高级特性

| 特性 | 写法 | Vue 3 兼容性 |
|------|------|------------|
| CSS variables | `--primary: #409eff; var(--primary)` | 不变 |
| `@keyframes` | 不变 | 不变 |
| `@media` query | 不变 | 不变 |
| `@supports` query | 不变 | 不变 |
| `@container` query | 不变 | 不变 |
| `@layer` cascade | 不变 | 不变 |
| `::v-deep` 旧穿透 | 见 4.2 | 改 `:deep()` |
| `:deep()` 新穿透 | 不适用 | 推荐 |
| CSS nesting (`&`) | postcss-nested 编译 | 不变 |
| `@scope` (新) | CSS 新特性 | 不变 |
| `:where()` / `:is()` | CSS 新选择器 | 不变 |
| `:has()` | CSS 新选择器 | 不变 |

### 4.4 预处理器特有

| 特性 | scss | less | stylus |
|------|------|------|--------|
| 变量 | `$x: 1;` | `@x: 1;` | `$x = 1` |
| 嵌套 | `&` | `&` | `&` |
| mixin | `@mixin` | `.mixin()` | `mixin()` |
| 函数 | `@function` | 函数 | function |
| 循环 | `@for` | each | for |

## 5. main.js / 入口文件 穷举 (见 iter-087)

## 6. router (Vue Router 3 → 4) 穷举

### 6.1 路由表

| 写法 | Vue Router 3 | Vue Router 4 |
|------|-------------|-------------|
| 静态路由 | `routes: [{ path, component }]` | 不变 |
| 动态路由参数 | `path: '/user/:id'` | 不变 |
| 正则路由 | `path: '/user/:id(\\d+)'` | 不变 |
| 可选参数 | `path: '/user/:id?'` | 不变 |
| 通配符 | `path: '*'` | `path: '/:pathMatch(.*)*'` |
| 嵌套路由 | `children: [...]` | 不变 (但要 `<router-view>` 嵌套) |
| 命名路由 | `name: 'user'` | 不变 |
| 命名视图 | `components: { default: A, sidebar: B }` | 不变 |
| 重定向 | `redirect: '/home'` | 不变 |
| 别名 | `alias: '/home'` | 不变 |
| 路由元信息 | `meta: { requiresAuth: true }` | 不变 |

### 6.2 路由懒加载

| 写法 | Vue 2 兼容 | Vue 3 兼容 |
|------|-----------|-----------|
| `() => import('./Foo.vue')` | ✓ | ✓ |
| `() => import(/* webpackChunkName */ './Foo.vue')` | ✓ | ✓ |
| `const Foo = () => import('./Foo.vue')` | ✓ | ✓ |
| `const Foo = () => require(['./Foo.vue'], ...)` (AMD) | ✓ | 不支持 |
| `component: () => import('./Foo.vue').then(m => m.default)` | ✓ | ✓ |

### 6.3 Router 配置

| 字段 | Vue Router 3 | Vue Router 4 |
|------|-------------|-------------|
| `mode: 'history'` | `mode: 'history'` | `history: createWebHistory()` |
| `mode: 'hash'` | 同上 | `history: createWebHashHistory()` |
| `mode: 'abstract'` | 同上 | `history: createMemoryHistory()` |
| `base: '/app/'` | 同上 | 同上 (但放 createWebHistory 第 1 参) |
| `linkActiveClass` | 同上 | 移走, `<router-link>` 自带 active-class |
| `linkExactActiveClass` | 同上 | 同上 |
| `scrollBehavior(to, from, savedPos)` | 同上 | 不变 |
| `parseQuery` / `stringifyQuery` | 同上 | 不变 |
| `fallback` | hash fallback | 删 (createWebHashHistory 自动) |
| `duplicateNavigation` | — | 新增 |
| `strict` | URL 严格 / | 删 |
| `sensitive` | 大小写敏感 | 删 |

### 6.4 Router 导航

| 写法 | Vue Router 3 | Vue Router 4 |
|------|-------------|-------------|
| `router.push('/user')` | 不变 | 不变 |
| `router.push({ name, params })` | 不变 | 不变 |
| `router.replace(...)` | 不变 | 不变 |
| `router.go(n)` | 不变 | 不变 |
| `router.back()` / `forward()` | 不变 | 不变 |
| `router.replace + Promise.catch` | `router.push(...).catch(err => ...)` | 成功 resolve 也会 catch 取消 |

### 6.5 Router 守卫

| 写法 | Vue Router 3 | Vue Router 4 |
|------|-------------|-------------|
| `beforeEach` | 3 参 (to, from, next) | 3 参, next 仍兼容 |
| `beforeEach` (无 next) | 不支持 | 2 参 (to, from) + return false / throw / new Error |
| `beforeResolve` | 同上 | 同上 |
| `afterEach` | 不支持 next | 不支持 next |
| `beforeEnter` (路由内) | 不变 | 不变 |
| `beforeRouteEnter` (组件内) | 3 参 + next(vm => ...) | 3 参 + next(vm => ...) (但 setup 内拿不到 vm) |
| `beforeRouteUpdate` | 不变 | 不变 |
| `beforeRouteLeave` | 不变 | 不变 |

## 7. store (Vuex 3/4 → Pinia) 穷举

### 7.1 Vuex 写法

| 字段 | 写法 |
|------|------|
| `state` | `state: { count: 0 }` |
| `getters` | `getters: { double: state => state.count * 2 }` |
| `mutations` | `mutations: { inc(state) { state.count++ } }` (参数是 state) |
| `mutations` 载荷 | `mutations: { inc(state, payload) {...} }` |
| `actions` | `actions: { incAsync({ commit }) { commit('inc') } }` (参数是 context) |
| `actions` 载荷 | `actions: { inc({ commit }, payload) {...} }` |
| `modules` | `modules: { user: { namespaced: true, state: {...} } }` |
| `namespaced` | `namespaced: true` (action 名 'user/login') |
| `getters` (modules) | `getters: { isAdmin: (state, getters, rootState) => ... }` |
| `actions` (modules) | `actions: { login({ commit, rootState }) {...} }` |
| `root: true` (嵌套模块) | 父模块 root 状态 |
| `plugins` | `plugins: [logger, persist]` |
| `subscribe` | `store.subscribe(mutation => ...)` |
| `registerModule` | 动态注册 |
| `unregisterModule` | 动态注销 |
| `mapState` / `mapGetters` / `mapMutations` / `mapActions` | 组件内 helper |
| `createNamespacedHelpers` | namespaced helper |

### 7.2 Pinia 写法

| 写法 | 说明 |
|------|------|
| `defineStore('id', { state, getters, actions })` | Options 风格 |
| `defineStore('id', () => { return { ref1, ref2 } })` | Setup 风格 (推荐) |
| `storeToRefs(store)` | 模板用响应式解构 |
| `store.$patch({})` | 批量更新 |
| `store.$reset()` | 重置 state |
| `store.$subscribe((mutation, state) => {})` | 订阅 |
| `store.$onAction(callback)` | 订阅 action |
| `store.$dispose()` | 销毁 |
| `defineStore` with `pinia.use(plugin)` | 插件扩展 |

## 8. package.json 穷举

| 字段 | Vue 2 时代 | Vue 3 改法 |
|------|-----------|-----------|
| `dependencies.vue` | `"^2.6.0"` | `"^3.4.0"` |
| `dependencies.vue-template-compiler` | `"^2.6.0"` | 删 (用 `@vue/compiler-sfc`) |
| `dependencies.vuex` | `"^3.0.0"` | 删 / 改 `pinia` |
| `dependencies.vue-router` | `"^3.0.0"` | `"^4.0.0"` |
| `dependencies.element-ui` | `"^2.0.0"` | `"element-plus": "^2.4.0"` |
| `dependencies.vue-cli-plugin-element` | 删 | 删 |
| `devDependencies.@vue/cli-service` | `"^4.0.0"` | 删 (Vite 替代) |
| `devDependencies.vue-loader` | `"^15.0.0"` | `"^17.0.0"` |
| `devDependencies.@vue/compiler-sfc` | 不存在 | `"^3.4.0"` |
| `devDependencies.sass-loader` | `"^10.0.0"` | `"^13.0.0"` |
| `devDependencies.vite` | 不存在 | `"^4.0.0"` |
| `devDependencies.@vitejs/plugin-vue` | 不存在 | `"^4.0.0"` |
| `devDependencies.typescript` | `"^4.0.0"` | `"^5.0.0"` |
| `scripts.serve` | `"vue-cli-service serve"` | `"vite"` |
| `scripts.build` | `"vue-cli-service build"` | `"vite build"` |
| `scripts.lint` | `"vue-cli-service lint"` | `"eslint --ext .js,.vue,.ts src"` |
| `scripts.test:unit` | `"vue-cli-service test:unit"` | `"vitest run"` |

## 9. vue.config.js / vite.config.js 穷举

### 9.1 vue.config.js (vue-cli 时代)

```js
module.exports = {
  publicPath: '/',
  outputDir: 'dist',
  assetsDir: 'static',
  lintOnSave: false,
  productionSourceMap: false,
  devServer: {
    port: 8080,
    open: true,
    proxy: { '/api': 'http://localhost:3000' },
    headers: { 'X-Custom': 'x' }
  },
  configureWebpack: {...},
  chainWebpack: chain => {...},
  css: { loaderOptions: { sass: {...} } },
  pluginOptions: { 'style-resources-loader': {...} },
  parallel: require('os').cpus().length > 1,
  pwa: {...}
}
```

### 9.2 vite.config.js (Vite 时代)

```js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: '/',
  build: { outDir: 'dist', assetsDir: 'assets' },
  server: {
    port: 5173,
    open: true,
    proxy: { '/api': 'http://localhost:3000' },
    cors: true
  },
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  plugins: [vue()],
  css: {
    preprocessorOptions: {
      scss: { additionalData: '@import "@/styles/variables.scss";' }
    }
  },
  build: {
    rollupOptions: { output: { manualChunks: { vendor: ['vue', 'vue-router'] } } }
  }
})
```

## 10. TypeScript 特殊

| 写法 | 备注 |
|------|------|
| `Vue.extend` + 装饰器 | `@Component` |
| `vue-class-component` | 装饰器风格 |
| `vue-property-decorator` | `@Prop @Emit` |
| `script lang="ts"` | TS in .vue |
| `defineComponent({...})` | Vue 3 TS 工厂 |
| `ComponentInstanceType<typeof X>` | 模板 ref 类型 |
| `PropType<T>` | props TS 工厂 |
| `ExtractPropTypes<typeof props>` | 推 prop 类型 |
| `defineComponent<SetupLang>` | setup 类型 |
| `defineProps<T>()` | 编译时类型 (setup 顶层) |
| `defineEmits<T>()` | emit 类型 |
| `defineExpose()` | expose 给 ref 用 |
| `withDefaults(defineProps<...>(), {...})` | 默认值 |
| `import { type PropType } from 'vue'` | 类型导入 |

## 11. 静态资源

| 类型 | Vue 2 处理 | Vue 3 处理 |
|------|----------|----------|
| `import logo from './logo.png'` | webpack 5 + Vite 都支持 | 不变 |
| `background: url('@/assets/x.png')` | CSS 中 | CSS 中 (Vite 自动处理) |
| `require('@/assets/x.png')` | CJS require | 不支持 (Vite ESM-only) |
| `<img src="@/assets/x.png">` | Vue CLI 配 alias | Vite 配 alias |
| dynamic import 资源 | `import('@/assets/x.png')` | 不变 |
| SVG as component | `vue-svg-loader` | `vite-svg-loader` / `vite-plugin-vue-svg` |
| SVG inline | `?raw` query | `?raw` query |
| Font loading | `@font-face` + ttf/woff | 不变 |

## 12. 测试文件

| 框架 | 写法 |
|------|------|
| Jest + @vue/test-utils | `mount(Comp); expect(wrapper.text()).toBe(...)` |
| Mocha + chai | 同上 |
| Vitest | `import { describe, it, expect } from 'vitest'` |
| Cypress | `cy.visit('/'); cy.get('.btn').click()` |
| Playwright | `page.click('.btn')` |

## 13. .env 文件

| 字段 | 写法 | Vue 2 vs Vue 3 |
|------|------|---------------|
| `VUE_APP_API_BASE` | `process.env.VUE_APP_API_BASE` | Vue 2 必须 VUE_APP_ 前缀 |
| `VITE_API_BASE` | `import.meta.env.VITE_API_BASE` | Vue 3 改 VITE_ 前缀, 用 import.meta.env |
| `NODE_ENV` | `process.env.NODE_ENV` | Vue 2 跟 Vue 3 一样 |
| `BASE_URL` | `process.env.BASE_URL` | Vue 3 也可 `import.meta.env.BASE_URL` |

## 14. 多端 / 跨平台

| 框架 | 特殊写法 |
|------|---------|
| uni-app | `<view>`, `<text>`, `<image>`, `<navigator>` (小程序标签) |
| uni-app | `uni.showToast()`, `uni.request()` |
| uni-app | `pages.json` (路由) |
| Taro | React / Vue 跨 |
| 微信小程序原生 | wxml / wxss / json / js 4 件套 |

## 15. SSR / Nuxt

| 框架 | 特殊 |
|------|------|
| Nuxt 2 | `~/`, `@/` alias; `asyncData`; `fetch`; `plugins/`; `middleware/` |
| Nuxt 3 | `useFetch`; `useAsyncData`; `defineNuxtComponent`; `app.vue` |
| 自建 SSR | `entry-client.js` + `entry-server.js`; `createRenderer`; `bundleRenderer` |

---

## 下一步 (iter-089 起按这个 taxonomy 建目录 + 写代码)

按 1 轮 1 module 推进 (1 个 directory + 多个 .vue / .js):

| iter | module | 覆盖 |
|------|--------|------|
| 088 | (本轮 taxonomy) | — |
| 089 | `element-ui/` | 8+ .vue (Button / Form / Table / Dialog / Pagination / Tree / Cascader / Message / Notification 全场景) |
| 090 | `ant-design-vue/` | 8+ .vue |
| 091 | `wangeditor/` | editor 集成 / 图片上传 / 自定义 toolbar |
| 092 | `sortable-drag/` | sortable / vuedraggable / drag-list |
| 093 | `store/` | index.js + 4 modules (user / app / settings / permission) + types + plugin |
| 094 | `router/` | index.js + 5 routes (login / dashboard / user / 404 / nested) + guards |
| 095 | `package.json` | Vue 2 完整 package.json (含 scripts / deps) |
| 096 | `vue.config.js` | 完整 vue-cli 配置 |
| 097 | `vite.config.js` | 完整 Vite 配置 |
| 098 | `.env.*` | development / production / staging |
| 099 | `tsconfig.json` | TS 配置 + paths |
| 100 | `app.vue` | root 组件 (transition + keep-alive + router-view + error boundary) |
| 101 | `coverage-test-summary.md` | 全量 coverage 报告 (auto vs manual, 各 module 触发数) |

每 1 轮 1 module,跑 vue-migrate 转换,记录触发数。
