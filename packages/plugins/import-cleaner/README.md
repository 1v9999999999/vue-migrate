# @vue-migrate/plugin-import-cleaner

iter-042c/d/e 新增 plugin — 在所有 transform 完成后清理 unused import (Vue / vuex / element-ui 等老 import)。

## 背景

Vue 2 → Vue 3 转换后, 大量老 import 失去意义:

- composition 转完后, 原 `import Vue from 'vue'` / `import { mapState } from 'vuex'` 没人用了
- elementui 转完后, 原 `import { Button } from 'element-ui'` 没人用了
- vue-router-v4 转完后, 原 `import Router from 'vue-router'` (以及 Vue.use) 没人用了
- 3rd-party-imports 转完后, `import echarts from 'echarts'` 改成 `import * as echarts from 'echarts'`, 旧 default 名 `echarts` 不再被引用

**用户需人工 cleanup** → 浪费时间, 容易漏。import-cleaner 自动做这件事。

## 负责规则

| 编号 | 规则 | 自动化程度 | 处理对象 |
|------|------|----------|---------|
| IC.1 | `import X from 'pkg'` 中 `X` 在 script / template 都没引用 | ✅ 自动删除 | default specifier |
| IC.2 | `import { X, Y } from 'pkg'` 中 `X` / `Y` 任一未引用 | ✅ 自动删除 | 单独 named specifier (其他保留) |
| IC.3 | `import * as X from 'pkg'` 中 `X` 未引用 | ✅ 自动删除 | namespace specifier |
| IC.4 | 整条 import 都没 specifier | ✅ 自动删除整行 | 整个 ImportDeclaration (含 `;` + `\n`) |
| IC.5 | template 里的 `<my-comp>` / `{{ foo }}` / `v-if="x"` 引用 | ✅ 自动保留 | 防止误删 template 用的 binding |
| IC.6 | `import Vue from 'vue'` 在 `.vue` 但 Vue identifier 未在 script 引用 (vue-router-v4 Pass G 同类) | ✅ 自动删除 default specifier | 不动其它 specifier (避免误删 reactive/ref) |

## 关键实现

### iter-042d: 用 raw source 重新 parse, 不走 stale AST

```typescript
// 1. 用 file.sfc.script.loc 定位 <script>...</script> 块
//    不走 regex, 避免 <script> 出现在 template/comment 里误匹配
const sfcScript = file.sfc?.script
if (!sfcScript || sfcScript.loc == null) {
  // 非 .vue / 没 SFC 定位: 整段 source 当 script
  return cleanImportsInRange(source, 0, source.length, source.length, file, ctx)
}

// 2. composition 写回的 sfc.loc.start.offset 可能是错的 (指向 <script 开口而不是首字符)
//    必须用 regex 重 derive
const openTagMatch = source2.match(/<script\b[^>]*>/i)
const openTagEnd = openTagMatch.index + openTagMatch[0].length
const closeTagStart = source2.indexOf('</script>', openTagEnd)
sfcScript.loc.start.offset = openTagEnd  // 同步改 sfc.loc 让 codegen 看到
sfcScript.loc.end.offset = closeTagStart
sfcScript.content = source2.slice(openTagEnd, closeTagStart)
```

**为什么不用 file.scriptAst?** composition (priority 0) 改过 `file.source` 后, `file.scriptAst` 仍是原始 parse 结果 (composition 改的是字符串, AST 没同步)。用 stale AST 走 import 统计会漏掉:
- composition 引入的 `import { ref, computed } from 'vue'` (新加的)
- composition 删掉的 `import Vue from 'vue'` (旧有的)

re-parse file.source 后是当前真实状态。

### iter-042e: STRING-LEVEL replace, 不走 AST regenerate

```typescript
// 收集 edits FIRST (dedup by importPath)
const edits: Array<{ start: number; end: number; replacement: string }> = []
for (const ip of uniqueImportPaths) {
  const startInScriptInner = ip.node.start
  const absStart = scriptInnerAbsStart + startInScriptInner
  const absEnd = scriptInnerAbsStart + ip.node.end
  const remaining = ip.node.specifiers
  
  if (remaining.length === 0) {
    // 整条删 — 包含 trailing `;` 和 `\n`,避免留空行
    let dropEnd = absEnd
    if (newSource[dropEnd] === ';') dropEnd++
    if (newSource[dropEnd] === '\r') dropEnd++
    if (newSource[dropEnd] === '\n') dropEnd++
    edits.push({ start: dropStart, end: dropEnd, replacement: '' })
  } else {
    // 用 babel generate 单条 import, 但强制末尾加 `\n`
    const newImportText = generateFn(newImportNode, { comments: true }).code
    if (!newImportText.endsWith('\n')) newImportText += '\n'
    edits.push({ start: absStart, end: absEnd, replacement: newImportText })
  }
}
// 反向应用 (后 → 前, 避免 offset 失效)
edits.sort((a, b) => b.start - a.start)
for (const e of edits) {
  newSource = newSource.slice(0, e.start) + e.replacement + newSource.slice(e.end)
}
file.source = newSource
```

**为什么不用 AST regenerate 整文件?**
- composition 会在 `<script setup>` 输出 `const xxx = useXxx()` 之类的 free-variable 声明
- 这些声明跟原文件里同名 import 撞名, babel regenerate 会重复声明 / 报 Duplicate declaration
- STRING-LEVEL 只改 import 行, 其它代码原样保留, 0 重复声明风险

**为什么强制末尾加 `\n`?**
单条 import regenerate 不带 newline。原 `import A;\nimport B;`:
- 删 B (`;` + `\n`)
- 保留 A regenerate (无 `\n`)
- 边界: `A;\n` → `A;` (B 没了, A 后面直接接 A 自己的 regen)
- 若 A 改写后 regen `import A;` 也没 `\n`, 下一条是 `import C;` (原第三个), 那 A regen 后变成 `import A;import C;` — 没有换行

强制 `replacement.endsWith('\n')` 保证每条 import 后面都有换行, 不会跟下条粘在一起。

### iter-042d (3): template 引用识别

```typescript
function collectTemplateReferences(source, scriptOpenTagEnd, scriptCloseTagStart): Set<string> {
  const out = new Set<string>()
  // 1. tag names: <TagName ...> 或 </TagName>
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9-]*)/g
  while (m = tagRe.exec(tpl)) {
    out.add(kebabToCamel(m[1]))  // <head-top> → headTop
  }
  // 2. mustache: {{ foo }}
  const mustacheRe = /\{\{\s*([A-Za-z_$][\w$]*)/g
  while (m = mustacheRe.exec(tpl)) out.add(m[1])
  // 3. 指令表达式里的 ident: v-if="x" :foo="x" @click="x"
  const dirRe = /\b(?:v-[A-Za-z]+|:[A-Za-z][\w-]*|@[\w-]+)\s*=\s*"([^"]+)"/g
  while (m = dirRe.exec(tpl)) {
    // 提取表达式里所有 ident (排除 true/false/null/undefined)
  }
  return out
}
```

**Vue 3 auto-resolve**: template 里 `<head-top>` 自动找 import 里的 `headTop` 绑定。kebab-case ↔ camelCase 互转。

**保守策略**: 宁可多保留 (false positive, 留个 unused import), 不可误删 (false negative, 删了 runtime "unknown component")。

### babel parse 严格 mode 陷阱 (iter-042d)

```typescript
// 不要用 sourceType: 'module' — 跟 scope 一起会触发 Duplicate declaration
// 用 sourceType: 'unambiguous' + errorRecovery + noScope: true
ast = parseScript(scriptInner, {
  sourceType: 'unambiguous',
  allowImportExportEverywhere: true,
  errorRecovery: true,  // 错了继续 parse, 标记但不抛
  plugins: ['typescript', 'jsx'],
})

// traverse 时也加 noScope: true
traverse(ast, { noScope: true, ImportDeclaration(...) {...} })
```

**Why**: composition 改完会有 `function addFood()` 跟原 `import { addFood } from '@/api/getData'` 撞名, babel 在 module mode + scope tracking 时直接抛 `TypeError: Duplicate declaration` — 文件彻底跳过, 没机会清理。

### 同步 file.scriptAst (测试可见性)

```typescript
const scriptAst = file.scriptAst
if (scriptAst && t.isFile(scriptAst) && scriptAst !== ast) {  // 跳过 re-parsed ast
  for (const info of specs) {
    if (info.refs !== 0) continue
    // 在原 AST 找同源同名 specifier 也删 (key: source.value + localName + specKind)
    traverse(scriptAst, { noScope: true, ImportDeclaration(p) { ... } })
  }
}
```

**Why**: 测试用 `generate(file.scriptAst)` 验证 (不能只改 file.source)。真实 codegen 走 `file.scriptAst` 时也看到改动。

## 文件结构

```
src/
├── index.ts                                  # 入口 + 2 个 helper (cleanImportsInRange / findReferences / collectTemplateReferences)
└── __tests__/
    └── test-import-cleaner.ts                # 10 case
```

## 测试

跑 10 个 case, 覆盖:
- 单 named unused 删除 / 多 named 部分删除 / default unused 删除
- 整条 import 删除 (含 `;` + `\n`)
- template 引用保留 (`<my-comp>` 不删 `import MyComp from ...`)
- kebab ↔ camel (`<head-top>` 保留 `import headTop from ...`)
- composition 撞名情况 (function + import 同名, 不能抛)
- useRawSource=true 路径 (file.source 已被 composition 改过)

`packages/plugins/import-cleaner/src/__tests__/test-import-cleaner.ts`

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- IC.1~3: 数以百计 (composition 把 `import Vue / mapState / mapGetters / ...` 全干掉)
- IC.4: ~50 触发 (整条 import 删)
- IC.5: 关键! 防止 template 引用的 component 被误删 (实测 0 误删)
- 0 false negative (跟 iter-054 baseline 一致 — 0 regression)

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-import-cleaner'
```

priority: **-1** (最低, 最后跑 — 让所有其它 plugin 先完成所有 import 形式改写, import-cleaner 看到的就是最终状态)。

## 跟其他 plugin 的关系

| Plugin | 关系 |
|--------|------|
| composition | 先跑, 改 `import Vue` / `mapState` / 改写 `<script setup>`, 把 `import { ref, computed } from 'vue'` 加进来;import-cleaner 后跑删 stale |
| elementui | 先跑, 把 `import { Button } from 'element-ui'` 改成 named, 老 default 名 `Button` 不再引用 → import-cleaner 删 |
| vue-router-v4 | 先跑, 删 `Vue.use(Router)` / `import Router from 'vue-router'` → import-cleaner 不再需要处理 |
| this-replacer | 先跑, 把 `this.$http` 改成 `axios`; 原 `Vue.prototype.$http = axios` 这条无引用 → import-cleaner 同步清理相关 import |
| 3rd-party-imports | 先跑, 把 default import 改 namespace; 旧 default 名未引用 → import-cleaner 删 (但 namespace 是新加的, 不会删) |

## 边界 / 已知限制

- **dynamic import** `import('@/api/' + name)`: 不在 import-cleaner 范围 (运行时路径, 没法静态分析)
- **CSS / SCSS import** `import 'styles.scss'`: 整段没 specifier, 但有 side-effect (加载 CSS), **不删**。本 plugin 只删 specifier, 不删 side-effect-only imports
- **template 解析保守**: kebab ↔ camel 仅基本映射, 不处理 `<mycomp>` (lowercase) ↔ `MyComp` (PascalCase) 跨大小写, 用户自己确认
- **side-effect import 检测**: 当前未实现 (比如 `import 'core-js/stable'` 这种全局 polyfill, 删了会破坏功能)。如需支持, 加 `importKind: 'value'` 检测
- **BOM 字符**: 当前未处理, 极少见
- **多次调用**: 跑一次即可, 第二次跑 0 effect (再扫不到 unused)
