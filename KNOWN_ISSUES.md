# Known Issues

每个 issue 跟踪一个**有具体例子**的转换缺陷。新发现的 bug 立即加一条，已经修掉的归档到下方"已修"区。

## Open

### ~~C1. Pinia store id 推断不准（标 review 让用户手改）~~ ✅ 已修 (iter-057, 0 触发)

- **Type**: cosmetic
- **Severity**: minor
- **Files**: `examples/vue2-manage-master/src/store/index.js`, `examples/ve-admin-test/src/store/index.js` 等所有 `index.js` store
- **现状 (iter-043)**: `inferStoreNameFromPath('src/store/index.js')` 返回 `'store'`，所以输出 `export const useStoreStore = defineStore("store", {...})` — store id 重复了"store"两次，不够明确
- **修复策略**: 已加 review 提示用户改 store id 和 export 名字；自动改需要扫描项目其他文件的 import 语句（不在本轮范围）
- **iter-057 验证**: 在 11111/ (iter-050 终版) 和 iter-054 输出里, 0 个文件出现 `useStoreStore / useAppAppStore / useUserUserStore` 重复 store 名字. 实际已不是问题, 关闭.

### C2. P1-1 边缘情况：template ref 与 data 字段同名（已部分修，模板改名但有歧义）

- **Type**: semantic
- **Severity**: minor
- **Files**: `examples/vue2-manage-master/src/page/login.vue` (ref="loginForm" 与 data.loginForm 同名)
- **现状 (iter-041)**: 模板 `ref="loginForm"` 被改名为 `ref="loginFormRef"`，script 生成 `const loginFormRef = ref(null)`，`__refsMap` 加上 alias `loginForm: loginFormRef` 兼容老的 `this.$refs['loginForm']` 动态查找。**但用户代码里 `ref="loginForm"` 写死** 的话仍然引用不存在的 name, 应改为 `ref="loginFormRef"`
- **修复策略**: 模板 ref 改名是必要的(否则 ref 会绑到 reactive data field 上, 而不是真正的 ref), 用户手改这一处即可

### 15. render function / 异步组件 (partial: 标 review 提示)

- **Type**: not implemented
- **Severity**: minor (现在降级为 minor, 已部分覆盖)
- **Files**: `examples/vue2-aegis/src/main.js`, `examples/vue2-element-touzi-admin-dev-permission/src/main.js`, `examples/vue2-sample/src/main.js`, `examples/ve-admin-test/src/main.js` (4 个 example entry 文件,iter-063 验证)
- **现状 (iter-033 + iter-063)**: 转换后是 `createApp(defineComponent({ render: h => h(App), router, store })).mount('#app')` — Vue3 合法。**新加 manualReview 提示用户可手动简化**:
  ```
  [#15 render shortcut] 检测到 render: h => h(App).可手动简化为: 
  createApp(App).use(router).use(store).mount('#app')
  (把原 options 里的 router/store 抽到 .use() chain,移除 render)。
  ```
- **iter-063 验证**: vue-element-admin-master master `src/main.js` 仍有 `render: h => h(App)` (B 没手改这个, 只改了 11111/), 转换时触发 1 次 review. 11111/ (B iter-048 手改后) 0 触发.
- **修复策略**: 只标 review,不自动改(自动改风险大:router/store 要从 options 抽到 .use() chain,需要 AST 重写)
- **剩余**: 真正的组件 render 函数 (`render(h) {...}` 完整方法) 0 触发,无需处理

### 11. ~~`expandThisDollarWatch` 不支持非字符串 key~~ ✅ 0 触发(iter-031)

- **验证**: `grep '\$watch\s*\(\s*[a-zA-Z_]\w*\s*[,)]' examples/**/*.vue` 0 命中
- **结论**: 实际 sample 都没用 `this.$watch(varName, fn)`,只有 vendor JS 命中但被 elementui skip
- **action**: 关闭 issue,不需要修

### 12. ~~elementui 解析 minified vendor JS 失败~~ ✅ 已修(iter-024-final, A27)

- **修复**: elementui plugin 加 `static/js/|dist/|build/|vendor*.js|*.min.js|node_modules` 跳过规则
- **验证 (iter-031)**: 跑 `manage/static/js/` 20 个 vendor JS,全部命中 skip, 0 错误
- **action**: 关闭 issue, 与 A27 重复,归档

### 13. ~~Vue.extend() 嵌套组件未转 setup~~ ✅ 已修(vue2-compat 1.2)

- **修复**: `vue2-compat/src/index.ts:60-75` 的 `CallExpression` visitor 已经把 `Vue.extend(x) → defineComponent(x)`,并 `ensureVueImport(['defineComponent'])`
- **composition plugin (line 173-178)**: 也检测 `export default Vue.extend(...)` 形式(转成 `exportDefault.arguments[0]`),加 review 提示
- **验证 (iter-031)**: 跑 `examples/compo-test/StressTest.vue`,输出 `const BaseWidget = defineComponent({...})` ✓
- **action**: 关闭 issue, 转 A41

### 14. ~~reactive reassignment 嵌套数组~~ ✅ 0 触发(iter-031)

- **验证**: `grep 'this\.\$\w+\s*=\s*\[\s*\[' examples/**/*.vue` 0 命中
- **结论**: 实际 sample 都没有 `this.list = [[1,2]]` 这种嵌套数组赋值
- **action**: 关闭 issue,不需要修

### 7. ~~composition 插件文件被 PowerShell 编码损坏~~ ✅ 已修（iter-023）

- **修复**: 完全重写 `options-to-setup.ts` (~1100 行)
- **现状**: 真正实现 Options→Setup 转换, 包括 data/props/methods/computed/watch/lifecycle, this.x 替换, this.$watch, props 替换, reactive 重赋值等
- **新问题**: 见 #11-#15 (上面)

### 8. ~~semanticDiff 略降（0.760 → 0.722）~~ ✅ 已修（iter-024）

- **修复**: composition 插件真正启用后, avgSemanticDiff 从 0.616 回升到 0.687 (+0.071)

### 4. ~~TS 类型推断大量字段仍是 `unknown`~~ ✅ 已修（iter-024）

- **修复**: parseData 加 t.isBooleanLiteral / t.isStringLiteral / t.isNumericLiteral / t.isNullLiteral / t.isArrayExpression / t.isObjectExpression / t.isNewExpression(Date) / t.isRegExpLiteral 判断, 生成 `ref<boolean>` / `ref<string>` / `reactive<any[]>` / `reactive<Record<string, any>>` / `ref<Date>` / `ref<RegExp>` 等
- **效果**: 单文件测试 `modalVisible: false` → `ref<boolean>(false)`, `items: [...]` → `reactive<any[]>([...])`, `currentUser: {...}` → `reactive<Record<string, any>>({...})`

### 5. ~~`this.foodForm = []` reactive 数组重置语义丢失~~ ✅ 已修（iter-024）

- **修复**: replaceThisInBody 在 data field 替换之前先检测 `this.x = expr` 模式, 转 `x.splice(0, x.length, ...expr)`. 加 review 提示
- **效果**: 
  - `this.items = this.items.filter(...)` → `items.splice(0, items.length, ...items.filter(...))`
  - `this.selectedRows = rows` → `selectedRows.splice(0, selectedRows.length, ...rows)`
  - `this.city = newCity` → `city.splice(0, city.length, ...newCity)`

### ~~6. ECharts 自由变量 `myChart` TODO 注释误导~~ ✅ 已修 (iter-059, 0 残留)

- **Type**: cosmetic
- **Severity**: minor
- **Files**: examples/222/components/headTop.vue
- **现状**: 注释 `// TODO: type unknown` 但代码已经声明 `let myChart: any`，TODO 不准确
- **修复计划**: 修注释模板
- **iter-059 验证**: 4 个 chart 文件 (LineChart / PieChart / BarChart / RaddarChart) 全部用 `const chart = ref(null)` 或 `const chartEl = ref(null)` (template ref), 没有 `let myChart: any` 残留, 没有 TODO 注释. 关闭.

## 修复中

(无)

## 模板：怎么提一条新 issue

```markdown
### N. <一句话描述>

- **Type**: syntax | semantic | cosmetic | runtime
- **Severity**: blocker | warning | minor
- **Files**: 相对 examples/ 的路径（多文件用逗号分隔）
- **现状**: 转换后是什么（贴 5-10 行）
- **期望**: 应该是什么
- **修复计划**: 哪个插件加规则，或 rule-generator 自动处理
```

## 归档：已修

| # | 描述 | 修复版本 | commit |
|---|---|---|---|
| A1 | `:visible.sync` 转 `:v-model` 后 `splitDirective` 缺失 | iter-005 | composition |
| A2 | `template loc` 重复累加 `+= delta` | iter-002 | core |
| A3 | 嵌套 `<template>` 的 `findTemplateRange` regex 误匹配 | iter-002 | core |
| A4 | `ObjectMethod` vs `ObjectProperty` 类型检查错误 | iter-003 | composition |
| A5 | vuex-pinia 的 `t.objectMethod` 参数顺序错 + computed key 默认 | iter-007 | vuex-pinia |
| A6 | vue3-entry 的 `createApp(...)` 不带 `.mount()` 没处理 | iter-006 | vue3-entry |
| A7 | 模板 `el-icon` 转换只覆盖 tag name 范围 | iter-006 | elementui |
| A8 | `template ref="formData"` 与 `data.formData` 冲突 | iter-008 | composition |
| A9 | `this.$refs[formName]` 动态访问丢失语义 | iter-008 | composition |
| A10 | `cleanupUnusedVueImports` 没排除 ImportDefaultSpecifier | iter-006 | vue3-entry |
| A11 | `$notify.error()` 等链式方法没正确转 | iter-002 | elementui |
| A12 | Pinia mutation 动态 commit 没检测 | iter-005 | vuex-pinia |
| A13 | Vue Router mode: 'abstract' review note | iter-006 | vue-router-v4 |
| A14 | Scheduler `readSamplesIndex` 不识别 v1 schema | iter-008 | scheduler |
| A15 | Scheduler `runSubprocess` Windows spawn 路径问题 | iter-008 | scheduler |
| A16 | Scheduler `reportPath` 少拼一层 id | iter-008 | scheduler |
| A17 | Scheduler `phaseTest` 传错参数 | iter-008 | scheduler |
| A18 | Scheduler zombie 进程 + stale code | iter-011 | operational |
| A19 | composition plugin `parseProps` 是空函数 | iter-024 | composition |
| A20 | composition plugin `injectTopSetup` 没同步到 result.injectedTopSetup | iter-024 | composition |
| A21 | `expandThisDollarWatch` 死循环 (Invalid string length) | iter-024 | composition |
| A22 | `expandThisDollarWatch` typo `after` -> 应是 `afterKey` | iter-024 | composition |
| A23 | composition plugin 死代码: needRef 等未定义变量 | iter-024 | composition |
| A24 | `this.$bus / $on / $off / $once` 没处理 | iter-024 | composition |
| A25 | `this.$el / $forceUpdate / $destroy / $set / $delete` 没处理 | iter-024 | composition |
| A26 | `this.$watch(string, fn)` 字符串参数没正确转换 | iter-024 | composition |
| A27 | elementui 解析 minified vendor JS 失败 | iter-024-final | elementui |
| A28 | composition 不支持 `const X = Vue.extend(...)` 嵌套组件 | iter-025 | composition |
| A29 | reactive reassignment multi-line object literal 错 | iter-025 | composition |
| A30 | free variable `myChart` 误用 `let xxx: any` | iter-025 | composition |
| A31 | errorCaptured lifecycle 漏处理 | iter-026 | composition |
| A32 | computed `{get, set}` ObjectMethod 检测失败 | iter-026 | composition |
| A33 | parseComputed `t.isBlockStatement(getBody)` 误用 (get 是 ObjectMethod) | iter-026 | composition |
| B17 | `SfcBlock` interface 缺 `type?: string` field | iter-027 | core/types.ts |
| B18 | `findLastIndex` 需要 lib ES2023+ | iter-027 | elementui/global-methods |
| B19 | `tpl` 可为 null 但 sfc-source.ts 假设非空 | iter-027 | elementui/utils |
| B20 | `scriptOpenMatch.index` 可为 undefined | iter-027 | elementui/utils |
| B21 | `detectTemplateGlobals` 函数缺闭合 `}` (135+ cascading 错) | iter-027 | composition/index |
| B22 | `stateSource?.length` 在模板字符串里不 narrow | iter-027 | vuex-pinia/index |
| B23 | `t.isArrowFunction` 不存在 (应 `t.isFunction`) | iter-027 | 多处 |
| B24 | `ObjectMethod | ObjectProperty` 联合类型不兼容 | iter-027 | vuex-pinia/index |
| B25 | vue3-entry/src/index.ts 文件丢失 (bulk-delete 正则误删 768 行) | iter-027 | vue3-entry/index |
| B26 | options-to-setup.ts 深度 GBK 损坏 (135+ 唯一错误行) | iter-027 | composition/options-to-setup |
| B27 | vue3-entry 缺 `@babel/generator` 依赖 (运行时 ERR_MODULE_NOT_FOUND) | iter-027 | vue3-entry/package.json |
| B28 | vuex-pinia 缺 `@babel/generator` 依赖 | iter-027 | vuex-pinia/package.json |
| B29 | `generate` 函数未导入 vuex-pinia | iter-027 | vuex-pinia/index |
| B30 | `vue3-entry` 运行时 symlink 缺失 | iter-027 | node_modules/@vue-migrate |
| B31 | `(prop as any).value` 解决 ObjectMethod 联合类型 | iter-027 | 多处 |
| B32 | `vue3-entry` rewrite 后 review 数从 0 → 486 (实质改进: 之前 plugin 根本没跑) | iter-027 | vue3-entry |
| B33 | `<template slot-scope=...>` 被重写时再包一层 `<template>`，产生双层 template | iter-028 | vue3-template/slot-rewriting |
| B34 | vue3-entry 在源码已 `new Vue → createApp` 转换后 isEntryByContent 检测失败 | iter-028 | vue3-entry |
| B35 | vue3-entry 缺 `registerPlugin(plugin)` 调用 (rewrite 时漏写) | iter-028 | vue3-entry/index |
| B36 | vue3-entry 调 `mount('##app')` 多了个 `#` (log 字符串硬编码) | iter-028 | vue3-entry |
| B37 | vue2-compat 重复 push 'createApp' 到 import (GBK 时期遗留) | iter-028 | vue2-compat |
| B38 | vue2-compat 重复声明 `ObjectProperty` visitor (rename bug 留痕) | iter-028 | vue2-compat |
| B39 | elementui icon.ts: 多重 edit 在 `out` 上直接 splice，原 template 偏移失效 → 多字节 UTF-8 损坏 | iter-029 | elementui/icon |
| B40 | elementui tsconfig 残留 `rootDir: "./src"`，阻止跨包 import | iter-029 | elementui/tsconfig |
| A41 | `Vue.extend(x) → defineComponent(x)` 在 `vue2-compat` 已经实现（CallExpression visitor, line 60-75）| iter-031 | vue2-compat |
| B42 | vue2-compat: `new Vue({...}).$mount('#app')` 转 `createApp(...).mount(...)` 条件错（`isCallExpression(parent.object)` 应该是 `isNewExpression`），导致 `.mount()` 永远丢失 | iter-032 | vue2-compat |
| B43 | vue2-compat: `new Vue({el: '#app'})` 简写模式没处理（el 选项应该移除并加 `.mount('#app')` chain）| iter-032 | vue2-compat |
| B44 | vue3-entry: entry chain finder 只认 `.$mount(`,不认 `.mount(`（vue2-compat 修复后会输出 `.mount`）| iter-032 | vue3-entry |

## iter-035 highlights: 真实项目深度排查 + 3 个 critical bug

### 排查动机
用户问"软件会不会加 lang=ts",自主排查后发现 26 个 .vue 文件(主要在 stress-compo + vue2-sample)用 TS 语法但没标 `lang="ts"`,会 parse 失败。

### 修复 3 个 critical bug
- **iter-035a** `packages/core/src/parser.ts`: JS 解析失败时 fallback 试 TS,成功标记 `file.metadata.lang = 'ts'`
- **iter-035b** `packages/plugins/vue-router-v4/src/index.ts`: 加 `import VueRouter + new VueRouter` 检测(Vue 2 默认 import 形式)
- **iter-035c** `vue-router-v4 Pass C`: 处理 `const x = () => new Router({...})` wrapper 模式,整个 VariableDeclarator 替换;rename id 为 `__routerInstance__` 避免跟 import `createRouter` / 后续 const `router` 冲突

### 排查路径
1. probe `examples/` 下所有 .vue 文件 → 发现 26 个 needs TS 命中
2. 修 parser fallback → 26 个命中
3. 跑 baseline aegis → 1 个 selfCheck 失败
4. probe 找失败文件 → `src/router/index.js` 重复 `createRouter`
5. debug Pass C → 找到 wrapper 模式 + parent 用 `path.parent` 是 node 不是 path 的 babel trap
6. 修 Pass C wrapper rename → 0 errors

### iter-035 闭环数字
| 指标 | iter-034 | iter-035 |
|---|---|---|
| tsc errors | 0/12 | **0/12** ✓ |
| unit tests | 130/130 | **130/130** ✓ |
| 真实 parse errors (8 sample) | 1 (aegis) | **0** ✓ |
| outputValid=true sample 数 | 6/8 | **8/8** ✓ |
| review (8 sample total) | 546 | 546 |
| compileOk / astEq / semDiff / rtSafe | 0.988/0.649/0.743/0.884 | 0.988/0.649/0.743/0.885 |
| totalFiles | 232 | 232 |

✅ 闭环:0 tsc errors / 0 parse errors / 130 tests pass / 8/8 sample clean / iter-035 推送 `a299570`。

## iter-034 highlights: #15b vuex modules 标 review

### 新增功能
- **vuex-pinia** 检测 `new Vuex.Store({modules, getters})` modules 模式
- 命中时:**把 vuexStoreCall 置 null** 跳过整个自动转换(if 块剩余部分会误把 modules 当 state 解析)
- reviewItems push 一条 manualReview 提示用户:
  ```
  [#15b vuex modules] 检测到 new Vuex.Store({modules: {app, user, settings, tags, permission, ...}, getters}) — modules 模式。
  Pinia 没有 modules 概念,需手动迁移: 每个 module 改成 export const useXxxStore = defineStore('xxx', {state, getters, actions})。
  原 getters/mutations 合并到对应 store。Vue 组件里的 this.$store.state.xxx 改成 store.xxx, dispatch 改成 store.action()。
  ```

### iter-034 state
| Metric | iter-033 | iter-034 |
|---|---|---|
| tsc errors | 0/12 | 0/12 |
| unit tests | 130/130 | 130/130 |
| totalReviewDelta | 544 | **546** (+2 modules reviews) |
| compileOk | 0.988 | 0.988 |
| astEquivalent | 0.649 | 0.649 |
| semanticDiff | 0.743 | 0.743 |
| runtimeSafe | 0.884 | 0.884 |

✅ 0 回归。ve-admin-test store/index.js 完整保留(不被错误转换)。

## iter-033 highlights: #15 render shortcut 标 review

### 新增功能
- **vue3-entry** 在 entry chain finder 之后,新增 `render: h => h(X)` 检测
- 4 个 main.js (vue2-aegis / permission / vue2-sample / ve-admin-test) 命中
- 输出 review 提示用户手动简化:`createApp(App).use(router).use(store).mount('#app')`
- 实际效果:baseline totalReviewDelta 540 → 544 (+4),其余数字一致

### 技术细节
- entry chain finder 找到 `createApp(defineComponent({...})).mount('#app')` 时,`optionsArg` 是 `createApp(arg)` 整体(不是 `arg`)
- 需要穿透两层:`optionsArg.arguments[0].arguments[0]` 才是真正的 options object
- 检测 `h => h(X)` 三要素:arrow function + 1 个 h 参数 + body 是 `h(X)` CallExpression

### iter-033 state
| Metric | iter-032 | iter-033 |
|---|---|---|
| tsc errors | 0/12 | 0/12 |
| unit tests | 130/130 | 130/130 |
| totalReviewDelta | 539 | **544** (+4 render shortcuts) |
| compileOk | 0.988 | 0.988 |
| astEquivalent | 0.649 | 0.649 |
| semanticDiff | 0.743 | 0.743 |
| runtimeSafe | 0.884 | 0.884 |

## iter-032 highlights: 拉 PanJiaChen/vue-element-admin (87k star, 131 .vue) 找 bug

### 拉真实复杂项目
- **新样本**: `examples/ve-admin-test/` (131 .vue + 176 js/ts, 87k star, 4.4.0)
  - 用 Node.js fetch + GH token 下载 zipball,Expand-Archive 解压,flattern inner folder
  - PowerShell `git clone` 网络 reset 失败,fallback 到 zipball API 路径

### 发现 + 修复 3 个 critical bug
- **B42** `vue2-compat/src/index.ts` `new Vue({...}).$mount()` 转 `createApp(...).mount()` 时,条件 `t.isCallExpression((parent as any).object)` 错（应该是 `isNewExpression`,因为 `parent.object` 是 NewExpression `new Vue({...})`,不是 CallExpression）。结果：`.mount('#app')` 永远丢失,Vue2 entry 文件转出来**没 mount**
- **B43** `new Vue({el: '#app'})` 简写模式没处理。修：检测 el property,如果是 string literal,移除 el 并加 `.mount(el)` chain；如果是非字面量,加 manual review
- **B44** `vue3-entry/src/index.ts` entry chain finder 只认 `.$mount(`,但 vue2-compat 修复后会输出 `.mount(`。修：同时接受两种 mount 调用

### 验证
- main.js 转换前:
  ```js
  new Vue({
    el: '#app', router, store,
    render: h => h(App)
  })
  Vue.config.productionTip = false
  Vue.use(ElementPlus, {...})
  Object.keys(filters).forEach(key => Vue.filter(key, filters[key]))
  ```
- main.js 转换后 (iter-032):
  ```js
  createApp(defineComponent({router, store, render: h => h(App)}))
    .use(ElementPlus, {...})
    .mount("#app")
  ```
  （`Vue.config.productionTip` 删除,`Vue.filter` forEach body 清空,`el` 移除,`Vue.use` chain 进 `.use()`）

### iter-032 state
| Metric | iter-031 | iter-032 |
|---|---|---|
| tsc errors | 0/12 | 0/12 |
| unit tests | 130/130 | 130/130 |
| review (ve-admin-test) | 226 | 225 |
| review (8 sample total) | 540 | **539** (-1) |
| compileOk | 0.988 | 0.988 |
| astEquivalent | 0.649 | 0.649 |
| semanticDiff | 0.742 | **0.743** (+0.001) |
| runtimeSafe | 0.884 | 0.884 |

✅ **0 回归,1 个 review 减少**(productionTip 删除),1 个 semantic 微提升。ve-admin-test review 226 → 225,说明 fix 帮了真实项目 1 个 review。

### 遗留 issue（不动,留给下个 iter）
- **#15** `render: h => h(App)` 在 `createApp()` 内不优雅：可简化为 `createApp(App).use(...).mount('#app')` (App 是组件,不需要 defineComponent 包装)
- **#15b** `new Vuex.Store({modules, getters})` modules 模式没被 vuex-pinia 转换 (store/index.js 仍 Vue2 写法)
- **#15c** `import Vue from 'vue'` 没被处理 (Vue 3 没 default export,但 vue3-entry 应该 chain `Vue.use(...)` 已经够用)

## iter-031 highlights: Open issue 清理

### 关闭 4 个 Open issues（实际是误报/已修/0 触发）
- **#11** `expandThisDollarWatch` 非字符串 key: 0 sample 触发（grep 全 examples 0 命中）
- **#12** elementui 解析 minified vendor JS 失败: 已修 (iter-024-final, A27)；iter-031 跑 20/20 vendor JS 全部 skip
- **#13** Vue.extend() 嵌套组件未转 setup: 已修 (vue2-compat:60-75 CallExpression visitor, A41 新归档)
- **#14** reactive reassignment 嵌套数组: 0 sample 触发（grep 0 命中）

### 剩 1 个 Open issue
- **#15** render function / 异步组件 (major, 4 个 main.js 触发)
  - entry 模式 `createApp(defineComponent({render: h => h(App)}))` 是合法但不优雅
  - 真正的 component render function `render(h) {...}` 0 触发
  - 修复方向: 简化 entry chain → `createApp(App).use(...).mount()`;component render → `setup() { return () => h(...) }`

### iter-031 state
| Metric | iter-030 | iter-031 |
|---|---|---|
| tsc errors | 0/12 | 0/12 |
| unit tests | 130/130 | 130/130 |
| Open issues | 5 | 1 |
| 文件改动 | — | KNOWN_ISSUES.md only |

无代码改动,纯文档清理。

## iter-030 highlights: vxe-table 3→4 插件

### 新插件 `@vue-migrate/plugin-vxe-table`
- **VT.1** `'vxe-table/lib/index.css'` → `'vxe-table/lib/style.css'` (script side, AST 改写 `node.source.value` + `extra.raw`)
- **VT.2** `<vxe-table-column>` → `<vxe-column>` (template side, open + close tag 同时改)
- 优先级 8（在 vue3-template 9 之后跑，template 规则先扫）
- 文件改动：
  - `packages/plugins/vxe-table/` 新建 (package.json + tsconfig + types-shim + index.ts + 2 rules + 13 测试)
  - `packages/cli/src/index.ts` 加 `import '@vue-migrate/plugin-vxe-table'`
  - `node_modules/@vue-migrate/plugin-vxe-table` symlink (root + cli 双重)
  - `pnpm-lock.yaml` 锁文件更新
  - `_dbg/check-all-tsc.mjs` + `_dbg/check-all-tests.mjs` 加入 vxe-table

### 故意不做
- 主包 `import 'vxe-table'` 同名 → 不强制改
- `VXETable` 默认导入名不强制改为 `VxeUITable`（v4 兼容）
- v3 config prop（`sort-config`, `column-config` 等）不自动改 v4 新名（向后兼容）

### 关键 bug 修复
- **VT-1**: `vxe-table/src/index.ts` 初始 import 深度 4 `..` → 改为 2 `..` (从 src/ 出发)
- **VT-2**: `vxe-table/src/rules/template.ts` 初始 import 深度 4 `..` → 改为 3 `..` (从 rules/ 出发)
- **VT-3**: 第一次实现的 `renameVxeTableColumn` 只改了 open tag, close tag 没改 → 加 `el.closeStart` + 2 + `OLD_TAG.length` 的 edit
- **VT-4**: 第一次实现的 newOpen 字符串里包含 attrs, 但 edits 范围只到 `tagNameEnd` → 改为只 replacement 只含 `<${NEW_TAG}`, attrs 保留
- **VT-5**: `test-vxe-table.ts` 缺 `relativePath/metadata/changed` 字段（FileNode 类型 contract）→ 补上
- **VT-6**: 单元测试输出用中文"通过", check-all-tests 正则 `pass N/fail N` 解析成 0 → 加 `tests N pass N fail N` 行

### iter-030 state
| Metric | iter-029 | iter-030 |
|---|---|---|
| compileOk | 0.988 | 0.988 |
| astEquivalent | 0.649 | 0.649 |
| semanticDiff | 0.742 | 0.742 |
| runtimeSafe | 0.884 | 0.884 |
| totalReviewDelta | 540 | 540 |
| totalFiles | 232 | 232 |
| tsc errors | 0/11 | **0/12** |
| unit tests | 94/94 | **130/130** (94+23 editor+13 vxe-table) |
| baseline diff vs iter-029-ref | 0 byte | 0 byte / 614 files identical |

注：vxe-table 插件不命中任何现有 sample（示例项目都没用 vxe-table），所以数字不变。

## iter-029 highlights: 中心化 template-editor API

### 新建 `packages/plugins/vue3-template/src/utils/template-editor.ts`
5 个 public function + 23 单元测试，single source of truth for "找 HTML 元素 + 应用转换 + splice 回原文"：
- `attrAbsStart(el, attr)` / `attrAbsEnd(el, attr)` — relative → absolute
- `replaceElement(source, el, replacement)` — 整个元素替换
- `removeElement(source, el)` — 删除元素
- `insertBeforeElement(source, el, content)` / `insertAfterElement(...)`
- `replaceAttribute(source, el, attr, newAttr)` — attribute splice（newAttr=null = 删除）
- `applyEdits(source, edits[])` — 多个 edit 一次性 right-to-left 应用
- `replaceMatchingElements<T>(source, predicate, build)` — high-level find-and-replace

### Refactored 4 个 rule 用 template-editor
- `inline-template.ts` — `replaceAttribute(out, el, attr, null)`
- `vbind-sync.ts` — 收集 TextEdits, `applyEdits` 处理
- `slot-rewriting.ts` — B33 修复后 + 改用 `applyEdits` 处理 `<template>` 原地改写和 element wrap
- `elementui/src/rules/icon.ts` — `applyEdits` + `replaceElement`, B39 修了"多次 edit 直接 splice 破坏多字节 UTF-8"bug

### 关键 bug 修复
- **B39**: `icon.ts` 的 `transformIcons` 在 `out` 上多次直接 `replaceElement` 用了**原 template 偏移**，第一次 splice 后偏移失效, 后续 splice 破坏多字节 UTF-8。修：收集 TextEdit, 走 `applyEdits` right-to-left
- **B40**: `elementui/tsconfig.json` 残留 `rootDir: "./src"`, 阻止跨包 import 别的 plugin 的 source。删除 rootDir

### iter-029 state
| Metric | iter-028 | iter-029 |
|---|---|---|
| compileOk | 0.988 | 0.988 |
| astEquivalent | 0.649 | 0.649 |
| semanticDiff | 0.742 | 0.742 |
| runtimeSafe | 0.884 | 0.884 |
| totalReviewDelta | 540 | 540 |
| totalFiles | 232 | 232 |
| tsc errors | 0/11 | 0/11 |
| unit tests | 94 + 8 slot + 4 vbind | **94 + 23 editor + 8 slot + 4 vbind** |

## iter-028 highlights

### vue3-entry rewrite (功能补完)
- Auto-chain `Vue.use/component/directive/mixin` to `createApp().use()...` chain
- Auto-fix `Vue.prototype.$x = val` → `app.config.globalProperties.$x = val` (inserted before `.mount()`)
- Auto-remove `Vue.config.productionTip/devtools/silent` (silent drop, no review)
- Auto-convert `Vue.config.ignoredElements = [...]` → `app.config.compilerOptions.isCustomElement = (tag) => [...].includes(tag)`
- Auto-remove `Vue.filter()` (Vue3 has no filter)
- Auto-remove `Vue.compile/nextTick/set/delete/version` (silently)

### vue3-template/slot-rewriting (B33 修复)
- `<template slot-scope="...">` 现在原地改写为 `<template #default="...">`，不再双层 wrap
- 保留其它属性（v-for, v-if 等）
- 新增 4 个测试用例覆盖各种 `<template>` 形式
- 8/8 slot 测试通过

### iter-028b state
| Metric | iter-027b | iter-028 |
|---|---|---|
| compileOk | 0.988 | 0.988 |
| astEquivalent | 0.649 | 0.649 |
| semanticDiff | 0.678 | 0.742 |
| runtimeSafe | 0.844 | 0.884 |
| totalReviewDelta | 486 | 540 |
| totalFiles | 232 | 232 |

## iter-027 final state

### Build verification (all PASS)
- **All 11 packages: 0 tsc errors** (core, cli, elementui, vue2-compat, vue3-directives, vue3-entry, vue3-template, vue3-types, vue-router-v4, vuex-pinia, composition)
- **All 94 unit tests pass** (21 metrics + 16 compare + 27 classify + 30 state-machine)
- **8 samples run end-to-end** (multi-sample-baseline)
- **@types/node: ^22.0.0** added to all 10 packages
- **types-shim.d.ts** created in all 11 packages (for `@babel/generator` and `@babel/traverse` which don't ship .d.ts)

### Metric truth (iter-027b — actual state with vue3-entry running)
| Metric | iter-026 | iter-027 (broken vue3-entry) | iter-027b (vue3-entry actually runs) |
|---|---|---|---|
| compileOk | 0.983 | 0.988 | 0.988 |
| astEquivalent | 0.705 | **0.888** ⚠️ | 0.649 |
| semanticDiff | 0.680 | **0.350** ⚠️ | 0.678 |
| runtimeSafe | 0.862 | 0.809 | 0.844 |
| reviewDelta | 342 | **0** ⚠️ | 486 |
| totalFiles | 171 | 232 | 232 |

⚠️ iter-027's "perfect" metrics were misleading: vue3-entry was failing to load due to missing `@babel/generator`, so its 486 review notes weren't being generated. With the fix (B27), the tool now produces correct output but the metric changes reflect the truth that vue3-entry is making more changes (some different from official tool).

## iter-037: TS fallback 改为 opt-in（默认不开）

**变更**：
- MigrationConfig / OrchestratorOptions 新增 allbackToTs?: boolean（默认 alse）
- parseFile(file, fallbackToTs) / parseProject(ctx) 读取 ctx.config.fallbackToTs
- CLI 	ransform 命令新增 --ts flag

**使用**：
`ash
# 默认：严格按 lang 解析（之前未加 lang="ts" 的 .vue 走 JS 解析，TS 语法会失败）
vue-migrate transform <src>

# 加 --ts：JS 解析失败时 fallback 试 TS（iter-035 的行为）
vue-migrate transform <src> --ts
`

**背景**：
- iter-035 默认开启 TS fallback，发现 26 个 .vue 文件用了 TS 语法但没加 lang="ts"
- 但默认开启会"静默修改解析路径"，可能让用户感到迷惑（"我明明写的是 JS，怎么就按 TS 解析了？"）
- 改为 opt-in：用户明确知道文件是 TS 时加 --ts，更可控

**影响**：
- 0 回归：130/130 测试通过、12/12 包 tsc 0 错
- 行为差异：默认模式（无 --ts）= 严格 lang 解析，TS 语法文件会 parse fail（用户必须加 lang="ts" 或 --ts）
- 旧 baseline 行为不变：所有 8 sample 走 default 模式，0 parse error


## iter-038: plugin-package-json 完整实现

**新增插件**：@vue-migrate/plugin-package-json（13/13 packages tsc-clean, 42/42 unit tests pass）

**功能**：把项目根目录的 package.json 从 Vue 2 时代转换到 Vue 3 时代。

**3 类转换**：
- **PJ.1** dependencies / devDependencies 映射（DEP_MAP）：
  - ue: ^2.x → ue: ^3.4.0
  - ue-router: ^3.x → ue-router: ^4.2.0
  - uex: ^3.x → pinia: ^2.1.0（删除 vuex）
  - element-ui: ^2.x → element-plus: ^2.4.0
  - ue-template-compiler / ue-cli-plugin-* / @vue/cli-plugin-* / @vue/cli-service → 删除
  - ue-loader: ^15 → ^17.4.0
  - @vue/compiler-sfc: ^3
- **PJ.2** scripts 转换：
  - serve → dev
  - ue-cli-service serve → ite
  - ue-cli-service build → ite build
  - ue-cli-service lint → eslint --ext .js,.vue,.ts src
  - ue-cli-service test:unit → itest run
- **PJ.3** devDependencies 注入 ite: ^5.0.0 + @vitejs/plugin-vue: ^5.0.0（如不存在）

**实现策略**：
- 用 nalyze 钩子（priority 100，最高）一次性处理 + 写盘
- 直接调 s.writeFile 不走 ctx.files（scanner 不扫 .json）
- 写到 ctx.config.outDir ?? ctx.root
- dry-run 时只打印不写

**典型输出**：
`json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint --ext .js,.vue,.ts src",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.4.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "vue-loader": "^17.4.0",
    "sass": "^1.69.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-vue": "^5.0.0"
  }
}
`

**端到端验证**：
- 输入：含 7 dependencies + 5 devDependencies + 4 scripts 的 Vue2 project
- 输出：15 项改动全部应用、文件正确写入 outDir/package.json
- dry-run：打印 15 项计划改动 + 不写盘 ✓

**Priority 100 设计原因**：
- 让 vue3-entry / vue-router-v4 / vuex-pinia / elementui 先完成所有代码侧转换
- 这样 package.json 里 vuex 已经被 pinia 替代时，代码侧 + 依赖侧同步
- 防止 vuex → pinia 的代码侧转换已发生但 package.json 仍写 vuex 的不一致状态

**0 回归**：
- tsc: 13/13 packages clean
- tests: 172/172 pass (130 + 42)
- baseline: 2 sample (vue2-sample + test-template, no package.json) 行为不变


## iter-039: #15c import Vue from 'vue' 自动清理

**问题**：vue3-entry 把 Vue.use/filter/config.*/new Vue() 全转成 Vue3 等价物后，import Vue from 'vue' 这行就成 unused import 了，但之前没清理。

**修复**：
- packages/plugins/vue3-entry/src/utils.ts 新增 
emoveVueDefaultImportIfUnused(file, markChanged)
- packages/plugins/vue3-entry/src/index.ts transform 用 try/finally 包 entry 流程，保证 finally 块**无论 early return 与否都跑**（包括 line 104 if (!isEntry) return）
- 扫描 AST 找 import Vue from 'vue' + 找 Vue 标识符的 ReferencedIdentifier 引用
- 0 引用时：
  - 整个 import 还有 named specifier → 只移除 default Vue specifier
  - 整个 import 只有 default → 整条 import 删

**典型输出**（PanJiaChen/vue-element-admin main.js）：

`diff
- import Vue, { defineComponent, createApp } from 'vue';
+ import { defineComponent, createApp } from 'vue';
`

**关键设计**：
- 必须在 entry 流程**之后**跑（finally 模式）：如果放在 transform 开头，Vue.use/filter 还在，检测会误判 Vue 还在用，import 留下
- 扫描走 ReferencedIdentifier（不是 Identifier），自动跳过 binding identifier（import 自己的 local）
- 防御性：walk up 检查 path 是否在 import 声明里（防止 binding 被误判为 reference）

**12 个单元测试**（test-remove-vue-import.ts）：
- import Vue + named imports + 无引用 → 移除 default specifier ✓
- import Vue (无 named) + 无引用 → 整条删 ✓
- import Vue + Vue.use() 还在 → 保留 ✓
- import Vue + new Vue() 还在 → 保留 ✓
- import Vue + Vue.config.productionTip 还在 → 保留 ✓
- import Vue + Vue.extend() 还在 → 保留 ✓
- import Vue + Vue.version 还在 → 保留 ✓
- import Vue + Vue.someUnknown() 还在 → 保留（保守策略） ✓
- 没有 import Vue → 无操作 ✓
- import Vue + Vue.someUnknown() 还在 → 保留 ✓

**0 回归**：
- tsc: 13/13 packages clean
- tests: 184/184 pass (172 + 12 new)
- baseline: 2 sample (vue2-sample + test-template) 行为不变

**已知限制**（标记 minor，不打算修）：
- 如果用户代码里有 import Vue from 'vue' + 用 Vue.someUnknownAPI() 我们没识别，会**保留** import（保守策略）
- 实际效果：不会有错误的 import 删除，最多保留一些真该删但没删的 import


## iter-040: composition 输出跟随源 lang (JS 源输出纯 JS)

**问题**（用户痛点）：源文件是 <script>（无 lang="ts"）时，composition plugin 输出还是加了 TS 泛型，例如：

`js
// 输入: data() { return { items: [] } }
// 输出 (iter-039 之前):
const items = reactive<any[]>([])
//                            ^^^^^ 用户明明写的是 JS, 不该加泛型
`

内部有 5 处都加了 TS 泛型：
ef<T> / 
eactive<T> / defineEmits<T>() / 
ef<any>(null) × 2。

**修复**：
- options-to-setup.ts 在函数顶部从 ile.sfc?.script?.lang + ile.metadata?.lang 推 isTs
- 5 处输出泛型的地方都加 isTs ? '<T>' : '' 切换
- JS 源时输出纯 JS 风格：() => reactive([])、() => ref(null)、() => defineEmits()

**典型输出对比**（vue2-sample WithSlot.vue，源是 <script> JS 风格）：

`diff
- const items = reactive<any[]>([])
+ const items = reactive([])
`

**保留 TS 行为**（<script lang="ts"> 时仍输出泛型）：
`	s
const items = reactive<any[]>([])
`

**4 个单元测试**（test-lang-output.ts）：
- <script lang="js"> → 输出无 
ef</
eactive</defineEmits< ✓
- <script> (无 lang) → 输出无泛型 ✓
- metadata.lang undefined → 输出无泛型 ✓
- <script lang="ts"> → 输出有泛型 ✓

**指标改善**：
- astEquivalent: 0.432 → **0.466** (+0.034)
- tsc: 13/13 packages clean
- tests: 188/188 pass (184 + 4 new)
- 其他指标: compileOk / semanticDiff / runtimeSafe 不变 (1.000 / 1.000 / 1.000)


## iter-043 highlights: �˵��� 0 ���� (vue2-manage-master / ve-admin-test / vue2-aegis / permission)

### �ջ�Ŀ��
�� 	ransform �� 4 ����ʵ Vue 2 ��Ŀ��**ȫ�� 0 ����**ͨ�� (�������� sample outputValid=true)��ǰ 42 �ֵ��������� 6 �� P0 + 4 �� P1 �� bug �����˵�����ͨ����һ�ְ� 4 ������ sample (vue2-manage-master��ve-admin-test��vue2-aegis��vue2-element-touzi-admin-dev-permission) ȫ���ܵ� ����: 0��

### �޸��� 9 �� bug

**composition plugin (P0/P1)**
- P0-3: reactive ����� 	his.x = {...} ��ת�� splice(0, x.length, ...) (����û�� splice). �޸�: �� isArray �ֶ�, ������ Object.assign, ������ splice.
- P0-2: Vuex ���ɱ��� const adminInfo = ref(null) ���Ƶ� watch/mounted ֮��, ���� TDZ. �޸�: �Ƶ� section 4.5, �� computed/watch ֮ǰ.
- P0-5: ...mapState(['x']) / ...mapActions(['y']) û��ʶ��, �� free variable fallback �� 
ef(null) ������ computed(() => store.x). �޸�: ʵ�� detectVuexUsage + collectMapXxxSpread ����ɨ export default ��� spread, ע�� useXxxStore import, �滻 	his.x �� x.value / 	his.y() �� y().
- P1-1: <el-form ref="X"> �� data �ֶ� X ͬ��, ģ�� ref ������Ϊ XRef �� __refsMap û��, ��̬ 	his.[formName] �õ� undefined. �޸�: ������ɨ <template> ���ռ� ref="x", ģ�� ref/data ��ͻʱ�� __refsMap �� ԭ��: ���� alias, �����ϵĶ�̬����.
- P1-4: 	his.<computed>.push(...) ת�� <computed>.push(...) (ComputedRef û�� push). �޸�: ��� 	his.x.<method>( ģʽ, �� method-call ��ʽ�� .value, ���� review ˵�� computed mutation ����仯.

**vuex-pinia plugin (P0)**
- P0-4: const state = {...} / const mutations = {...} / const actions = {...} ��������ûɾ, �������ɵ� defineStore �ظ�. �޸�: �ռ� stateMutationGetterActionPaths, ת�������� path.remove.
- iter-043 ����: 
ew Vuex.Store({modules: <identifier>}) ��ʽ (modules �� const ����) û��ʶ��Ϊ modules ģʽ, ���� codegen �� export ���� IIFE ���� "import/export may only appear at the top level". �޸�: �� uexStoreCall = null �ĳ� if (hasModules) return early return, ��ȫ�����Զ�ת�� + �� review.

**vue3-template plugin (P1)**
- P1-2: <el-dialog slot="footer"> �� wrap �� <template #footer> ��, �ڲ� <div slot="footer"> �� slot ����û����, Element Plus �ظ���Ⱦ. �޸�: �� slot-rewriting.ts �� uildTemplateOpenTag / 
ebuildElementParts ��, ���������� attr ʱֻ����ǰ���հ�, ������ slot �ı�. �� 2 ���ع����.

**vue-router-v4 plugin (P1)**
- P1-3: strict: process.env.NODE_ENV !== 'production' û��ɾ (Vue Router 4 û�� strict ѡ��), ������. �޸�: �� Pass C �� properties ѭ������ strict: ���� continue, ĩβ�� review. ͬʱ��ȷ����δ�õ� createWebHistory / createWebHashHistory import.

### iter-043 state

| Sample | �ļ��� | ������ | review �� |
|---|---|---|---|
| vue2-manage-master | 28 | **0** ? | 40 |
| ve-admin-test (87k star) | 195 | **0** ? | 198 |
| vue2-aegis | 92 | **0** ? | - |
| vue2-element-touzi-admin-dev-permission | - | **0** ? | - |

examples/222/ �������´������ܸ��� (�ɰ汾���ݵ� examples/222_legacy_20260810_212956/)��

### 0 ���� �� 0 review
��ֻͨ���� codegen �Լ�� + ��������ʱ�� ReferenceError / SyntaxError. Review �� (40 ��) �����:
- computed ��������仯
- Pinia store id ̫ͨ��
- el-icon �� class �÷�
- Ƕ�� callback ��� this

��Щ review �Ǹ��û����� hints, ���� bug.

### �� open �� minor (������)
- C1: Pinia store id �ƶϲ�׼ (һ���� "store" ̫ͨ��)
- C2: P1-1 ģ�� ref ������, �û�д�� 
ef="X" ������������ (�� alias �Ѽӵ� __refsMap, �����)
- #15 render shortcut: �� review ��ʾ, ���Զ���

## iter-046 highlights: **�˵��� build ͨ��** (vue2-manage-master �� Vite production build 0 ��)

### �ջ�Ŀ��
��ת���Ĵ���**��ʵ�� Vue 3 build**���������� plugin selfCheck ͨ��������һ�� _build_verify ������Ŀ��Vite 5 + Vue 3.4 + Pinia + Element Plus������ examples/vue2-manage-master/src/ ת���Ĵ��뿽��ȥ��**
pm run build 4.42s ��ɣ�0 errors**��

### �޵� 6 ���� bug��֮ǰ selfCheck ��©����

| ID | Bug | ���� | �޷� |
|---|---|---|---|
| P0-A | unction addFood(foodForm) {} �� import { addFood } ײ��, babel �ܾ� | Vue 2 method �� import ��ͬ scope, Ǩ�� setup �����ͻ | composition plugin �� importNames ���, ��ͻʱ method ����Ϊ __ |
| P0-B | main.js import useStoreStore �� store export useAppStore | vue3-entry �� vuex-pinia �����ƶ� store ��, ��һ�� | vue3-entry �� getMainStoreExportName fallback, �Ʋ���ʱǿ�� useAppStore |
| P0-C | 
outer/index.js �� Vue.use(Router) �� Router û import | vue-router-v4 û���� Vue 2 plugin ���� | �� Pass 0: ɨ Vue.use(X) ����, X �� import ��ɾ����, δ import ��� review |
| P0-D | main.js: createApp(defineComponent({template:'<App/>'})) Vue 3 ��֧�� | vue3-entry �� Vue 2 root options �հ� | ��� components: { App } 1 ��ʱ�� createApp(App) + import App from './App.vue' |
| iter-46 | <i v-else slot="icon"> ת�� <el-icon v-else slot="icon"> Ȼ�� wrap �� <template #icon>, ����ʧ�� | elementui icon ת��ʱ������ slot ����, �� v-else �ֵܽڵ��߼���ͻ | elementui icon.ts ���� slot / slot-scope ���� |
| P0-G | 	his.userCount = res[0].count �� .then(res => {...}) �հ���û�滻 | data field rename (userCount �� userCountData) ��, replaceThisInBody ֻ�� .name | ͬʱ�� .originalName, ��ԭ��Ҳ��һ���滻 |

### ��֤
- 	ransform examples/vue2-manage-master/src �� 28 �ļ�, 0 errors, 63 ���޸�, 45 �� review
- _build_verify/ �� 
pm run build �� **4.42s, 0 errors**, ���� dist/ �� 17 �� chunk
- examples/222 �������´��븲�ǣ��ɰ汾��ɾ��

### 0 build ���� �� 0 review
build ͨ��ֻ������ compile, ��������������. ������Щ review ����Ҫ�˿�:
- computed ��������仯 (5 ��)
- Pinia store id �ƶϲ�׼ (һ������� "app" ����, �� store ����Ҫ�ָ�)
- ���� el-form validate �ص���� (Element Plus 2 �� Promise)
- el-icon ͼ��ûע�� (Ҫ�� main.js ȫ�� app.component ע��)

### �� open �� minor (������)
- C1 / C2 / #15 (�� iter-043 һ��)
