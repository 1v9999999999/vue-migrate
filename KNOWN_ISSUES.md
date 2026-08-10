# Known Issues

每个 issue 跟踪一个**有具体例子**的转换缺陷。新发现的 bug 立即加一条，已经修掉的归档到下方"已修"区。

## Open

### 11. `expandThisDollarWatch` 不支持非字符串 key

- **Type**: limitation
- **Severity**: minor
- **Files**: `packages/plugins/composition/src/options-to-setup.ts` `expandThisDollarWatch`
- **现状**: `this.$watch(myVar, fn)` (第一个参数是变量) 会被替换为 `/* manual: ... */ watch(() => /* TODO */, ...)`. 加了 review 但代码 TODO 待补
- **修复计划**: 加表达式分析, 推断 myVar 是 ref/reactive, 自动生成正确 getter

### 12. elementui 解析 minified vendor JS 失败

- **Type**: pre-existing
- **Severity**: minor
- **Files**: `examples/vue2-manage-master/manage/static/js/*.js`
- **现状**: `manage/static/js/0.dea7087f7a00b4016329.js` 等 webpack 打包的 minified JS 被 elementui plugin 解析, 抛 "Property name expected type of string but got function"
- **影响**: 主样本 vue2-manage-master 跑出来有 3 errors (3 个 vendor JS 文件), 不是 composition 引起的
- **修复计划**: elementui plugin 加 `.min.js` / `vendor*.js` / 路径 `static/js/` 跳过规则

### 13. Vue.extend() 嵌套组件未转 setup

- **Type**: limitation
- **Severity**: minor
- **Files**: `examples/compo-test/StressTest.vue` (BaseWidget), `examples/222/...`
- **现状**: 文件里用 `const BaseWidget = Vue.extend({...})` 嵌套定义组件, composition 跳过 (export default 是 Vue.extend, 不是 ObjectExpression)
- **修复计划**: convertOptionsToSetup 加 Vue.extend 检测, 转 defineComponent({...}) 或保留 Vue.extend 注释

### 14. reactive reassignment 嵌套数组

- **Type**: edge case
- **Severity**: minor
- **Files**: 任何用 `this.list = [[1,2]]` 的
- **现状**: 用 `list.splice(0, list.length, ...expr)` 处理大多数情况 OK, 但如果 expr 是嵌套数组可能浅拷贝
- **修复计划**: 检测深层级, 单独的 review 提示 + 用户决策

### 15. render function / 异步组件

- **Type**: not implemented
- **Severity**: major
- **Files**: 任何用 `render(h) {...}` 或 `() => import('./Async.vue')` 的
- **现状**: composition 不处理, Vue2 的 `render` 选项直接保留, 转换后会编译报错 (Vue3 的 render 函数签名变了)
- **修复计划**: 加 render function 检测, 转换为 `setup() { return () => h(...) }` 或保留原文 + 强 review

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

### 6. ECharts 自由变量 `myChart` TODO 注释误导

- **Type**: cosmetic
- **Severity**: minor
- **Files**: examples/222/components/headTop.vue
- **现状**: 注释 `// TODO: type unknown` 但代码已经声明 `let myChart: any`，TODO 不准确
- **修复计划**: 修注释模板

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
