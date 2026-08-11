# @vue-migrate/plugin-this-replacer

iter-051 新增 plugin — Vue 2 `this.$X` prototype 注入属性批量替换 + review。

## 背景

Vue 2 项目里非常常见的一类模式: 把工具方法 / http 客户端 / eventBus / 全局 store 挂到 `Vue.prototype` 上, 然后在组件里通过 `this.$http` / `this.$axios` / `this.$api` / `this.$util` / `this.$bus` 等形式调用。

Vue 3 移除了 `Vue.prototype` 注入,所有这类属性需要在 `<script setup>` 顶部显式 import 或通过 `inject()` 拿。

本 plugin 负责:
1. 字符串级扫描 `this.$X` 使用
2. 已有同名 import 时 **自动替换** (`this.$http` → `axios`)
3. 找不到对应 import 时 **标 manualReview** 让用户加 import

## 负责规则

| 编号 | 规则 | 自动化程度 |
|------|------|----------|
| TR.1 | `this.$http` 已有 `import axios from 'axios'` | ✅ 自动 → `axios` |
| TR.2 | `this.$http` 已有 `import request from '@/utils/request'` | ✅ 自动 → `request` |
| TR.3 | `this.$axios` 已有 axios import | ✅ 自动 → `axios` |
| TR.4 | `this.$api` 已有 `import request` import | ✅ 自动 → `request` |
| TR.5 | `this.$http/$axios/$api/$fetch/$util/$utils/$bus/...` 没找到 import | ⚠️ manual review (建议加 import 或 inject) |
| TR.6 | named import 形式: `import { request as http } from '@/utils/request'` | ✅ 自动 → `http` |

## 白名单

```typescript
BUILTIN_THIS_DOLLAR = {
  // 网络层
  'http', 'axios', 'fetch', 'api', 'request', 'service', 'httpClient',
  // 工具
  'util', 'utils', 'common', 'helper', 'helpers',
  // 事件总线
  'bus', 'eventBus', 'emitter', 'event',
  // (低优) 路由相关 — 容易误判
  'route',
}
```

不在白名单的属性 (例如 `this.$store`, `this.$route`, `this.$router`, `this.$refs`, `this.$emit`) 由其他 plugin 处理 (store-bridge / composition / vue-router-v4), 不在本 plugin 范围内。

## 文件结构

```
src/
├── index.ts                # 插件入口, 注册 + 调用 _testable_applyThisReplacer
└── __tests__/
    └── test-this-replacer.ts  # 25 个 unit test
```

## 关键实现

```typescript
function findImportAliasFor(source: string, _hint: string): string | null {
  // 1) 默认 import: import <alias> from 'axios' / '@/utils/request' / '@/api/xxx'
  const defaultRe = /\bimport\s+(\w+)\s+from\s+['"](?:axios|@?\/utils\/request|@?\/api(?:\/[\w-]+)?|@?\/services?(?:\/[\w-]+)?|@?\/http|@?\/request)['"]/
  // 2) named import: import { request as alias } from '...'
  const namedRe = /\bimport\s*\{([^}]+)\}\s*from\s+['"](?:axios|@?\/utils\/request|...)['"]/
  // ... 返回 import 语句里的 alias
}

function applyThisReplacer(file, utils) {
  // 1) regex 扫 this.$X 出现 (X in BUILTIN_THIS_DOLLAR)
  // 2) 对每个 X 调 findImportAliasFor 找对应 import
  // 3) alias === 'axios' / 'request' / 'http' / 'service' / 'api' 时
  //    自动字符串级 replace (this.$X → alias)
  // 4) 其他情况标 manualReview
}
```

**关键设计**: 字符串级处理 (不是 AST), 这样在 composition plugin (priority 0) 设 `file.useRawSource = true` 之后也能正确工作 — 因为 codegen 直接输出 `file.source` 不走 AST。

## 测试

`_testable_applyThisReplacer` 暴露用于测试。

跑 25 个 case:
- 自动替换 (default import / named import / 多处 / useRawSource 模式)
- 标 review (无 import / lodash 模式 / dynamic import)
- 边界 case (同名 / 嵌套 / 字符串内容)

`packages/plugins/this-replacer/src/__tests__/test-this-replacer.ts`

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- **10 处 this-replacer review 触发** (this.$route 5 次 + 其他)
- 0 false positive (跟 iter-054 完全一致 — 0 regression)

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-this-replacer'
```

priority: **5** (在 composition(0) 之后, import-cleaner(-1) 之前)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| composition | `this.$parent / $children / $root / $vnode / $isServer / $isDestroyed / $options.componentName / mixins` |
| store-bridge | `this.$store / useStore()` 替换 |
| vue-router-v4 | `this.$route / $router` (本 plugin 'route' 白名单是低优 fallback) |
| this-replacer | **`this.$http / $axios / $api / $fetch / $util / $utils / $bus / $request / $service / $eventBus` 等** |
| vite-compat | `this.$el` (Node API 转换) |
| vue3-template | `this.$listeners / $scopedSlots / $on / $off / $once` |
| elementui | `this.$message / $notify / $msgbox / $alert / $confirm / $loading` |
