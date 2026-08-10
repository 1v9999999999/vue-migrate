# @vue-migrate/plugin-vue3-entry

> **P0 — 入口与全局配置迁移**（规则 1.6, 1.7, 1.8, 1.14, 1.16, 6.7）

将 Vue2 的「全局挂载 + 全局 API + 入口链」一键重写为 Vue3 的 `createApp(...).use(...).mount(...)` 链，并处理 `Vue.prototype` / `Vue.config.*` / `Vue.observable` / `Vue.filter` / `Vue.mixin` 等已移除或变更的全局 API。

vue2-compat 已经处理了 `new Vue(opts).$mount('#app')` 的基础转换（生成 `createApp(defineComponent(opts)).mount('#app')`），本插件做**后处理**：
1. 提取 `render: h => h(App)` 里的 `App`，避免无谓的 `defineComponent` 包装
2. 抽取 `options.router` / `options.store` 等"可作为 plugin 安装"项，链成 `.use(router).use(store)`
3. 把 `Vue.use(X)` / `Vue.component(X, Y)` / `Vue.directive(X, Y)` 全部串到 `createApp(App)` 的链上
4. 把 `Vue.prototype.$x = ...` 改写到 `const app = ...` 之后的 `app.config.globalProperties.$x = ...`
5. 把 `Vue.config.*` 按字段分别处理（删除 / 改写 / 转换）
6. 把 `Vue.filter` / `Vue.mixin` 标记为 manual review（无 `app.filter` / `app.mixin`）
7. 把 `Vue.observable(x)` 替换为 `reactive(x)`（所有文件）

---

## 安装

已经是 monorepo workspace 的一部分。在根目录 `pnpm install` 后即可。

CLI 引入：
```ts
// packages/cli/src/index.ts
import '@vue-migrate/plugin-vue3-entry'
```

---

## 插件契约

| 字段 | 值 |
|---|---|
| `name` | `vue3-entry` |
| `priority` | `9`（在 `vue2-compat` (10) 之后跑） |
| `fileKinds` | `['vue', 'js', 'ts']` |

### 入口识别

`file.metadata.isEntry === true`（由 scanner 按 `main.{js,ts}` / `index.{js,ts}` / `app.{js,ts}` 标记）；
**兜底**：源码里出现 `new Vue(` 也按入口处理（适用于文件名不在上述列表的入口文件，如 `main-full.js`）。

非入口文件只做"内联"级别的替换（`Vue.observable → reactive`），不进行链式重构。

---

## 实现的规则

| 规则编号 | Vue2 写法 | Vue3 写法 | 说明 |
|---|---|---|---|
| 1.6 | `Vue.use(P, opts)` | `app.use(P, opts)` | 串到 `createApp(App)` 链上；去重（与 `options.router` 重复时跳过 Vue.use 那一处） |
| 1.7 | `Vue.component('X', C)` | `app.component('X', C)` | 串到链上 |
| 1.7 | `Vue.directive('x', D)` | `app.directive('x', D)` | 串到链上 |
| 1.7 | `Vue.filter('x', fn)` | (删除) | **manual review**：建议把过滤器函数内联到 template，或挂到 `app.config.globalProperties.$filters` |
| 1.7 | `Vue.mixin(m)` | (删除) | **manual review**：建议改为 composable 在需要的组件 `setup()` 中调用 |
| 1.8 | `Vue.prototype.$x = v` | `app.config.globalProperties.$x = v` | 改写到 `const app = ...` 之后 |
| 1.14 | `Vue.observable(o)` | `reactive(o)` | 内联替换（所有文件） |
| 1.16 | `new Vue({render, router, store}).$mount('#app')` | `const app = createApp(App).use(router).use(store).mount('#app')` | vue2-compat 先转成 `createApp(defineComponent({...})).mount('#app')`，本插件后处理 |
| 6.7 | `Vue.config.productionTip = false` | (删除) | **manual review** |
| 6.7 | `Vue.config.silent = X` | `app.config.silent = X` | 改写到 `app.config` 之后 |
| 6.7 | `Vue.config.devtools = X` | `app.config.devtools = X` | 改写到 `app.config` 之后 |
| 6.7 | `Vue.config.errorHandler = X` | `app.config.errorHandler = X` | 改写到 `app.config` 之后 |
| 6.7 | `Vue.config.warnHandler = X` | (删除) | **manual review** |
| 6.7 | `Vue.config.keyCodes = X` | (删除) | **manual review** |
| 6.7 | `Vue.config.async = X` | (删除) | **manual review** |
| 6.7 | `Vue.config.ignoredElements = [...]` | `app.config.compilerOptions.isCustomElement = tag => [...].includes(tag)` | 自动包成 `isCustomElement` 谓词 |

---

## 关键约束

- **必须 `new Vue(opts)` 走的是 `createApp(defineComponent(opts)).mount(sel)`**（vue2-compat 的产物）。本插件假设 vue2-compat 已经跑过（priority=9 < vue2-compat=10）。
- **入口识别**靠 `file.metadata.isEntry` 或源码含 `new Vue(`。
- **去重**：如果同一个 `router`（或 `store` 等）**既**出现在 `Vue.use(router)` **又**出现在 `new Vue({router})` 的 options 里，链上只出现一次（从 options 那一处来，保留源码顺序）。
- **内联 `Vue.observable`**：在所有文件里都做（不只是入口），因为它就是一个 call 替换。
- **directive / component 的内容**不被本插件修改（生命周期重命名 `inserted → mounted` 等是 `vue3-directives` 的职责）。本插件只搬动 `Vue.directive(...)` 调用的位置。
- **`render: h => h(X)` 的 App 提取**：仅识别单层 `h(App)` / `h(Component)`，不识别 `h(SomeComp({prop: x}))` 等更复杂的形式——后者回退到 `defineComponent` 包装。

---

## 已知限制 / 不会做的事

1. **不在 .vue 文件里做入口链**——本插件只对 .js / .ts 入口文件做链式重构。.vue 文件里的 `new Vue({...})` 不常见，且 vue2-compat 已经能处理。
2. **不会自动 import `reactive` 到非入口文件**——`Vue.observable → reactive` 只在有 `Vue.observable` 调用的文件里追加 import。如果你的项目用 import alias，要手动确认。
3. **`Vue.config.ignoredElements` 仅为 ArrayExpression** 自动转换；如果是 RegExp 数组、字符串、变量等，会原样搬过去（`isCustomElement` 接收函数或字符串列表，需要人工调整）。
4. **`Vue.prototype.$x = expr` 中 `expr` 如果引用了 `new Vue()`**（事件总线常见写法），会保留 `new Vue()` 调用（因为 Vue3 仍然支持 `new Vue()` 作为兼容兜底，但功能受限）。会发 manual review 提示。
5. **`import Vue from 'vue'` 默认导入不会自动删除**——即使 `Vue` 不再被引用，本插件保留默认导入以避免误删。`reactive` / `createApp` / `defineComponent` 这类具名导入会在未被引用时**自动清理**。
6. **多入口文件**（多个 `new Vue` 调用）只处理**第一个**找到的入口链。

---

## 测试样例

### 输入 (`examples/vue2-sample/src/main-full.js`)

```js
// Comprehensive Vue2 entry file
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import axios from 'axios'
import GlobalX from './components/GlobalX.vue'
import focusDirective from './directives/focus'

// 1.6 Vue.use → app.use
Vue.use(ElementUI, { size: 'small' })
Vue.use(router)
Vue.use(store)

// 1.7 Vue.component / directive
Vue.component('GlobalX', GlobalX)
Vue.directive('focus', focusDirective)

// 1.7 Vue.filter / mixin → manual review
Vue.filter('upper', (str) => (str || '').toUpperCase())
Vue.mixin({ created() { console.log('mixin') } })

// 1.8 Vue.prototype → globalProperties
Vue.prototype.$axios = axios
Vue.prototype.$bus = new Vue()

// 6.7 Vue.config.*
Vue.config.productionTip = false
Vue.config.silent = true
Vue.config.devtools = true
Vue.config.errorHandler = (err, vm, info) => { console.error(err, info) }
Vue.config.warnHandler = (msg) => { console.warn(msg) }
Vue.config.keyCodes = { esc: 27 }
Vue.config.async = true
Vue.config.ignoredElements = ['my-el', 'ion-icon']

// 1.14 Vue.observable → reactive
const sharedState = Vue.observable({ count: 0 })

// 1.16 入口链
new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app')
```

### 输出（精简后）

```js
import Vue, { createApp, reactive } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import axios from 'axios'
import GlobalX from './components/GlobalX.vue'
import focusDirective from './directives/focus'

const sharedState = reactive({ count: 0 })

const app = createApp(App)
  .use(router)
  .use(store)
  .use(ElementUI, { size: 'small' })
  .component('GlobalX', GlobalX)
  .directive('focus', focusDirective)
  .mount('#app')
app.config.globalProperties.$axios = axios
app.config.globalProperties.$bus = new Vue()
app.config.silent = true
app.config.devtools = true
app.config.errorHandler = (err, vm, info) => { console.error(err, info) }
app.config.compilerOptions.isCustomElement = (tag) => ['my-el', 'ion-icon'].includes(tag)
```

> **注意**：Babel generator `retainLines: true` 会让本插件的输出**保留大量原行号空行**（来自被删除的 `Vue.use(...)` 等语句的位置），整条链也会挤在一行。建议在生产 CI 里对输出跑一遍 `prettier --write`。

### manual review 输出

```
✗ Vue.filter 已被移除（Vue3 不支持）。请在 template 里把过滤器函数内联调用（如 {{ x | filterName }} 改为 {{ filterName(x) }}），或挂到 app.config.globalProperties.$filters 上。
✗ Vue.mixin 已被移除（Vue3 推荐用 composable）。请把全局 mixin 改为在需要的组件 setup() 中调用对应的 composable 函数。
✗ 删除了 Vue.config.productionTip（Vue3 已无此选项；生产模式下不再有提示）。
✗ 删除了 Vue.config.warnHandler（Vue3 已移除 warnHandler；如需捕获警告，改用 app.config.errorHandler 或构建工具的 warning handler）。
✗ 删除了 Vue.config.keyCodes（Vue3 已移除；请把 @keyup.13 改为 @keyup.enter 等命名修饰符）。
✗ 删除了 Vue.config.async（Vue3 中异步错误处理统一由 app.config.errorHandler 接管）。
```

---

## 本地验证

仓库根目录：

```bash
pnpm install
pnpm --filter @vue-migrate/cli dev plugins
# 期望输出:
#   - vue2-compat
#   - vue3-entry
```

跑全量转换：

```bash
pnpm --filter @vue-migrate/cli dev transform \
  ./examples/vue2-sample/src \
  -o ./examples/vue2-sample/dist-vue3-entry
```

或单独跑 vue3-entry 的开发测试（仓内 tsx）：

```bash
cd packages/cli
node_modules/.bin/tsx ../../packages/plugins/vue3-entry/test-plugin.mts
```

---

## 文件清单

```
packages/plugins/vue3-entry/
├── package.json
├── tsconfig.json
├── README.md           ← 本文件
├── src/
│   ├── index.ts        ← 插件主文件
│   └── utils.ts        ← AST 辅助函数
├── test-plugin.mts     ← 集成测试（已注册 vue2-compat + vue3-entry 跑整条 pipeline）
└── test-debug.mts      ← 调试用：手动跑 transform + 生成代码（绕过 self-check）
```

---

## 需要 core 调整（清单）

> **本插件在开发过程中发现 core 包的以下问题，建议由 core 维护者手动调整**

### 1. `TransformUtils.markChanged` 的类型签名需要支持可选 msg

**问题**：`packages/core/src/types.ts` 里 `TransformUtils.markChanged(): void`，没有参数。但 `packages/core/src/context.ts` 的实现是 `markChanged(msg?: string)`，且 orchestrator 期望 `markChanged(msg)` 来更新 `__lastMessage`。所有插件都在调用 `utils.markChanged('xxx')`，但 TS 编译会报 "Expected 0 arguments, but got 1."。

**建议**：把类型签名改为
```ts
markChanged(msg?: string): void
```

### 2. core 包自身的 TS 编译错误

`packages/core/src/` 里有多处 TS 错误（pre-existing），包括：
- `@babel/generator` 缺少 type declaration → 加 `@types/babel__generator` 或 `declare module '@babel/generator';`
- `context.ts` 里的 `markChanged` 重写有问题（互相引用导致类型推断失败）
- `orchestrator.ts` 缺 `node:fs/promises`、`node:path` 类型 → `@types/node`
- `lib` 配置缺 `dom`（console 才不出错），或改成 ES2022 + Node 类型

修好后整条 monorepo 才能 `tsc --noEmit` 干净。

### 3. 插件间协调：vue2-compat 应该避免双引号

`vue2-compat/src/index.ts:62` 创建了 `t.stringLiteral('#app')`（无 raw）作为 mount 参数，导致 Babel generator 用双引号输出。本插件已经用 `ensureStringRaw` 兜底，但更干净的方案是 vue2-compat 在创建 stringLiteral 时设置 `extra.raw`。

### 4. codegen 的 retainLines 副作用

`packages/core/src/codegen.ts:18-25` 的 `GENERATOR_OPTIONS.retainLines: true` 让本插件的输出**保留大量原行号空行**（来自被删除语句的位置）。如果改成 `retainLines: false`，整文件会被重新格式化，但没改动的部分也会被改。建议加一个开关："如果文件被改超过 N 个 statement，就 disable retainLines"。

### 5. 期望 core 增加 helper

为了简化各插件对入口链的处理，建议 core 增加：
- `isEntry(file): boolean` — 综合 `metadata.isEntry` + 源码含 `new Vue(` 判断
- `findEntryChain(ast): { createAppCall, optionsObj, mountSelector, mountStmtPath } | null` — 统一找入口链的工具
- `getAppVarName(ast): string | null` — 找 `const app = ...` 的标识符
- `insertStatementsAfter(path, stmts)` — 跨插件复用的"在 path 之后插入多个 statement 并保留行号"工具

### 6. 报告里"需人工"统计始终为 0

**问题**：`packages/core/src/orchestrator.ts:115-124` 只把 `file.transforms` 里 `t.error` 的项当作 review，但插件调用 `utils.manualReview(reason)` 是 push 到 `file.transforms`（plugin: 'manual-review'），不会被统计进 `manualReviewRequired`。导致即使插件报了大量 manual review，报告里 "需人工" 永远是 0。

**建议**：orchestrator 的 review 收集应该遍历所有 `t.plugin === 'manual-review'` 的项，或 `manualReview` 调用时直接增加 `ctx.stats.manualReviewRequired`。
