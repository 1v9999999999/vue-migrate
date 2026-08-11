# @vue-migrate/plugin-3rd-party-imports

iter-045b + iter-048a 新增 plugin — Vue 3 升级后,3rd-party 库的 import 形式适配。

## 背景

Vue 2 → Vue 3 升级时,光改 `vue` / `vuex` / `vue-router` 不够 — 很多 3rd-party 库 (echarts / vuedraggable / xlsx / file-saver / driver.js / element-plus v1 sub-path) 也跟着升了 ESM / 改了 export 形式,导致原来的 `import X from 'pkg'` 在 Vite 5 + 严格 ESM 模式下报 "default is not exported" 或运行时空值。

本 plugin 负责:
1. AST 级扫描每个 `import ... from 'pkg'` 节点
2. 按 `DEFAULT_TO_NAMESPACE_RULES` / `CJS_DEFAULT_TO_NAMED_RULES` / `ESM_DEFAULT_TO_NAMED_RULES` 匹配
3. 命中规则的 import 改写 specifier / source, 调用方代码 (`X.yyy()`) 保持不变

## 负责规则

| 编号 | 规则 | 自动化程度 | 改写形式 |
|------|------|----------|---------|
| PI.1 | `import echarts from 'echarts'` | ✅ 自动 | `import * as echarts from 'echarts'` |
| PI.2 | `import draggable from 'vuedraggable'` (v2) | ✅ 自动 | `import { draggable } from 'vuedraggable'` (v4) |
| PI.3 | `import X from 'xlsx'` / `'jszip'` (CJS) | ✅ 自动 | `import * as X from 'xlsx'` (namespace) |
| PI.4 | `import X from 'file-saver'` (CJS) | ✅ 自动 | `import { saveAs as X } from 'file-saver'` (named) |
| PI.5 | `import Driver from 'driver.js'` (v1.8 已无 default) | ✅ 自动 | `import { driver as Driver } from 'driver.js'` (named) |
| PI.6 | `import enLang from 'element-plus/lib/locale/lang/en'` (v1 path) | ✅ 自动 | `import { en as enLang } from 'element-plus/es/locale/lang/en'` (path 改写 + named) |

## 规则表

```typescript
// DEFAULT_TO_NAMESPACE_RULES: default import → namespace import
// 当前为空: screenfull v6 default export 保留 (Vite interop 正常)

// CJS_DEFAULT_TO_NAMED_RULES: CJS 库 default 转换
[
  { name: 'xlsx',      type: 'namespace', reason: 'CJS, Vite 5 + strict ESM 下 default 不可用' },
  { name: 'jszip',     type: 'namespace', reason: 'CJS, Vite 5 + strict ESM 下 default 不可用' },
  { name: 'file-saver', type: 'named',
    namedImports: { default: 'saveAs' },
    reason: 'Vite 5 下有 named `saveAs`, 改 named' },
]

// ESM_DEFAULT_TO_NAMED_RULES: ESM 库已无 default
[
  { name: 'driver.js', type: 'named',
    namedImports: { default: 'driver' },
    reason: 'driver.js v1.8 已无 default, 只有 named `driver`' },
]
```

## 命名规则 (PI.6)

`element-plus/lib/...` → `element-plus/es/...` 改写时,需要把 default import 转 named, named 名字取 path 最后一段的 camelCase:

| 旧 path | 新 path + named |
|---------|----------------|
| `element-plus/lib/locale/lang/en` | `import { en as enLang } from 'element-plus/es/locale/lang/en'` |
| `element-plus/lib/locale/lang/zh-cn` | `import { zhCn as zhCnLang } from 'element-plus/es/locale/lang/zh-cn'` |
| `element-plus/lib/locale/lang/zh-CN` | `import { zhCn as xxx } from 'element-plus/es/locale/lang/zh-CN'` (大小写不敏感) |

camelCase 规则: `fileBase.split('-')` → 第 1 段保持, 后续段首字母大写。

## 文件结构

```
src/
├── index.ts                                  # 插件入口, 注册 + 调用 6 个 fix 函数
├── types-shim.d.ts
└── rules/
    ├── echarts.ts                            # PI.1
    ├── vuedraggable.ts                       # PI.2
    ├── import-default-to-namespace.ts        # PI.x (通用 namespace 改写)
    ├── import-cjs-default-to-named.ts        # PI.3 PI.4 PI.5 (通用 CJS/ESM 改写)
    └── element-plus-lib-to-es.ts             # PI.6
└── __tests__/
    ├── test-3rd-party-imports.ts             # 10 case
    └── test-3rd-party-iter048a.ts            # 10 case
```

## 关键实现

```typescript
// PI.1 核心: 把 default specifier 改成 namespace specifier
const defaultSpec = node.specifiers.find(s => t.isImportDefaultSpecifier(s))
const localName = defaultSpec.local.name ?? 'echarts'
node.specifiers = [t.importNamespaceSpecifier(t.identifier(localName))]
// 调用方 echarts.init(...) 代码不变

// PI.6 核心: path 改写 + default → named
const newSrc = 'element-plus/es/' + src.substring('element-plus/lib/'.length)
path.node.source = t.stringLiteral(newSrc)
const fileName = newSrc.split('/').pop().replace(/\.js$/, '')
const exportName = fileBaseToExportName(fileName)  // 'zh-cn' → 'zhCn'
path.node.specifiers = [
  t.importSpecifier(t.identifier(exportName), t.identifier(localName))
]
```

**关键设计**: AST 级处理 (不是字符串), 利用 babel traverse 精确替换 `node.specifiers`, 不影响其它 import 也不污染 `file.source` 字符串。

**为何 priority = 7**: 在 composition (0) 之后跑, 这样 import-cleaner (priority -1) 在后面统计 unused import 时, namespace / named 形式已经被本 plugin 改成正确的形式,统计才准确。

## 测试

跑 20 个 case (test-3rd-party-imports.ts 10 + test-3rd-party-iter048a.ts 10):
- echarts: default → namespace / 已 namespace 不动 / 已 named 不动
- vuedraggable: default → named { draggable } / 已 named 不动
- xlsx/jszip: default → namespace
- file-saver: default → named { saveAs }
- driver.js: default → named { driver }
- element-plus/lib → element-plus/es: path 改写 + named 转换
- 边界 case: 不匹配 / mixed default+named / 不以 `'pkg'` 结尾的 sub-path

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- element-plus/lib 改写 0 触发 (master 用 `element-plus/icons-vue`, 不直接 import lib)
- xlsx/jszip/file-saver/driver.js 0 触发 (master 没用)
- vuedraggable 0 触发 (master 用 Sortable.js, 不直接 import vuedraggable)
- 改写命中主要集中在 `element-ui/lib/...` → `element-plus/es/...` 这条路径 (master 部分旧版残留)

**本 plugin 触发数小, 但价值大** — 改一个 import 形式错误就会导致整个文件 build 失败。

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-3rd-party-imports'
```

priority: **7** (在 composition(0) / store-bridge / this-replacer 之后, import-cleaner(-1) 之前)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| this-replacer | `this.$http/$axios/$api/...` 字符串级替换 — 本 plugin 不动 `this.X` 形式 |
| import-cleaner | 在本 plugin 之后跑, 负责清理转换后 unused 的 import (PI.1 把 default 改成 namespace, 旧 default 名变成 unused) |
| elementui | 改 component tag / directive, 不动 import path; element-plus 路径改写由本 plugin PI.6 负责 |
| package-json | 加 `echarts` / `xlsx` / `jszip` 等依赖到 dependencies |

## 边界 / 已知限制

- **dynamic import 不处理**: `import('echarts')` 走运行时, AST traverse 抓不到 — Vue 2 项目里 dynamic import 少见, 暂不覆盖
- **混合 named + default**: 已支持 (PI.4 把 default 替换为 named, 保留其它 specifier)
- **element-plus v2 路径**: 仅 `lib/` → `es/` 改写, v2 也支持 `theme-chalk/...` CSS 路径, 不在范围内
- **新加规则**: 编辑 `CJS_DEFAULT_TO_NAMED_RULES` / `ESM_DEFAULT_TO_NAMED_RULES` 数组, 跑 `pnpm tsx _dbg/check-all-tests.mjs` 验证
