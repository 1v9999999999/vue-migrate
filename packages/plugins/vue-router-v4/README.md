# @vue-migrate/plugin-vue-router-v4

vue-router 2/3 → vue-router 4 转换 plugin (iter-035 + iter-044a Bug A1 修复 + iter-046 sync 修复)。

## 背景

vue-router 4 是 breaking change 大版本:

1. 不再走 `Vue.use(plugin)` 安装
2. `new Router({...})` → `createRouter({...})`
3. `mode: 'hash' | 'history' | 'abstract'` → `history: createWebHashHistory() | createWebHistory() | createMemoryHistory()` factory 模式
4. 默认 export 不再是 `Router` class, 改 named `createRouter`
5. 移除了 `strict` 配置项 (默认就是严格模式)
6. `router.matcher` 移除 (resetRouter 模式失效)
7. `require.ensure` 改 `import()`
8. `import VueRouter from 'vue-router'` 这种 Vue 2 默认形式 (与 `import Router from` 同义) 也需要支持

Vue 2 项目里的 `router/index.js` 几乎是必改文件, 影响 `main.js` 的 import chain, 必须放在 vue3-entry 处理之前。

## 负责规则

| 编号 | 规则 | 自动化程度 | 改写形式 |
|------|------|----------|---------|
| R.1 | `import Router from 'vue-router'` | ✅ 自动 | `{ createRouter, createWebHashHistory, createWebHistory }` 按需 named import |
| R.2 | `Vue.use(Router)` / `Vue.use(VueRouter)` | ✅ 自动 | 删除整行 (vue-router 4 不需要 install) |
| R.3 | `new Router({...})` / `new VueRouter({...})` | ✅ 自动 | `createRouter({...})` |
| R.4 | `mode: 'hash'` / 不指定 mode | ✅ 自动 | `history: createWebHashHistory()` + only createWebHashHistory in import |
| R.5 | `mode: 'history'` | ✅ 自动 | `history: createWebHistory()` + only createWebHistory in import |
| R.6 | `require.ensure([], cb, chunkName)` | ✅ 自动 | `() => import(/* webpackChunkName: "xxx" */ 'spec')` |
| R.7 | `this.$router / this.$route` | ⚠️ 不在本 plugin | 由 composition plugin 处理 (本 plugin 文件名匹配 vue-router 也跳过) |
| R.8 | `import VueRouter from 'vue-router'` | ✅ 自动 | 跟 R.1 同处理 (Vue 2 默认形式) |
| R.9 | `mode: 'abstract'` (已废弃) | ⚠️ review | 默认改 hash + 提示用户改 memory history (Node/SSR 用) |
| R.10 | `strict: <expr>` (已移除) | ✅ 自动 + review | 自动删除 + 通知用户 |
| R.11 | `VueRouter.prototype.push/replace/back/forward/go` 防重入 hack | ✅ 自动 | 整段删除 (vue-router 4 没有 prototype 实例方法) |
| R.12 | `const createRouter = () => new Router({...})` 撞名 wrapper (iter-044a Bug A1) | ✅ 自动 + review | 就地展开: 删 wrapper + 把下游 `const router = createRouter()` 改成 `const router = createRouter({...})` |
| R.13 | `const x = () => new Router({...})` 非撞名 wrapper | ✅ 自动 | 改名为 `__routerInstance__` 中转, 让用户后续重命名 |
| R.14 | `resetRouter()` 用 `router.matcher = newRouter.matcher` | ⚠️ review | 标 manualReview (需手动改 removeRoute + addRoute 重建) |
| R.15 | `import Vue from 'vue'` 但 Vue identifier 未引用 | ✅ 自动 | 删 default specifier (避免留下 `import Vue` 死引用) |

## 关键实现

### Pass 顺序 (互不冲突)

```
Pass -1    清理 VueRouter.prototype.push/replace/... hack (旧防重入代码)
Pass -0.5  清理 ConditionalExpression 里的 Vue.use(Router) (e.g. NODE_ENV 三元)
Pass  0    清理顶层 Vue.use(Router/VueRouter) (在改 import 之前用 scope.getBinding 判断)
Pass  A    require.ensure → import() with webpackChunkName
Pass  B    import 改造: 标记 isUsedAsRouter, 重置 specifiers
Pass  C    new Router → createRouter, mode → history factory, 精确计算需要的 import
Pass  D    删 import { Router } 和 default specifier
Pass  E    按需追加 import { createRouter, createWebHashHistory?, createWebHistory? }
Pass  F    移除空 import 'vue-router' 声明
Pass  G    Vue identifier 未引用时移除 import Vue
```

### iter-044a Bug A1: wrapper 撞名展开

```javascript
// BEFORE
const createRouter = () => new Router({ routes: constantRoutes })
const router = createRouter()

export function resetRouter() {
  router.matcher = newRouter.matcher
}

// AFTER (本 plugin 自动)
const router = createRouter({ routes: constantRoutes })

export function resetRouter() {
  // review: 用了 .matcher, vue-router 4 没有, 需手动重写
}
```

**为什么不能用 `__routerInstance__` 中转?**
原 Bug 计划用 `const __routerInstance__ = createRouter({...})` 替换 wrapper, 但下游 `const router = createRouter()` 调的是 `import createRouter`, 无参调用, routes undefined, app 启动即崩。

修复: 检测到 wrapper 名 === `'createRouter'` 时:
1. 删 `const createRouter = () => new Router({...})` 整行
2. 在 Program 顶层找 `const router = createRouter()` (无参) 调用, 把 init 替换成 `createRouter({...options})`
3. 标 review 通知用户

### iter-046 sync 修复

```javascript
if (changed) {
  if (ctx.file.kind === 'vue') {
    ctx.utils.syncScriptAstToSource()  // .vue 走 .sfc.script 替换
  } else {
    const generated = _gen(ctx.file.scriptAst, { ... })
    ctx.file.source = generated
    ctx.file.useRawSource = true  // 告诉 codegen 直接走 file.source
  }
}
```

**为什么需要?**
本 plugin 改 AST 后, 后续 store-bridge / this-replacer 可能会让 composition (priority 0) 设 `useRawSource = true`。如果本 plugin 没把 AST 改回 file.source, codegen 会从旧 AST 重新生成, 把已删的 Vue 2 残留 (`VueRouter.prototype.push`) 原样写回输出。

### R.4/R.5 精确 import 计算

```javascript
// 根据实际 mode 决定 import 哪个 factory, 避免未用 import
if (mode === 'history') {
  needsCreateWebHistory = true
} else {  // 'hash' | 'abstract' (abstract 已废弃 → 兜底为 hash)
  needsCreateWebHashHistory = true
}
// 收集完后在 Pass E 一次性追加到 import 声明
```

## 文件结构

```
src/
├── index.ts                                  # 7 个 pass + 入口
├── types-shim.d.ts
└── __tests__/
    └── test-wrapper-rename.ts                # 21 case (iter-044a Bug A1)
```

## 测试

跑 21 个 case, 重点覆盖:
- `const createRouter = () => new Router({...})` 撞名展开
- 撞名 + 下游 `const router = createRouter()` 同步展开
- `router.matcher = newRouter.matcher` 触发 review
- 撞名 + 没用到 `.matcher` 时不应触发 spurious review
- 普通 `new Router({...})` (无 wrapper) 正常替换
- vue-element-admin 完整 `router/index.js` 模板 (含 `import store` 等干扰)

`packages/plugins/vue-router-v4/src/__tests__/test-wrapper-rename.ts`

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- **196 个文件含 vue-router 相关代码** (`router/index.js` + 1 modules + `main.js` 链)
- `require.ensure` 0 触发 (master 用 `() => import()` 已经是新写法)
- `Vue.use(Router)` 0 触发 (B-hand-fixed)
- `new Router({...})` 主入口触发 1 次
- `mode: 'hash'` → `createWebHashHistory()` 1 次
- iter-044a wrapper 撞名 0 触发 (master 用 `() => new Router({...})` 形式)

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-vue-router-v4'
```

priority: **9** (在 vue2-compat(10) 之后, vue3-entry(9) 同级, import-cleaner(-1) 之前)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| composition | `this.$router / this.$route / useRoute() / useRouter()` |
| store-bridge | `this.$store` (跟 vue-router 无关, 不冲突) |
| this-replacer | `this.$http/$axios/...`, 不动 `this.$router` (白名单排除) |
| vue3-entry | `new Vue().$mount()` 入口 (跟 `new Router()` 无关, 不冲突) |
| import-cleaner | 在本 plugin 之后跑, 清理 `import VueRouter from 'vue-router'` 等 dead import |
| vue2-compat | priority 10 先跑, 把 `Vue.use(Router)` 等标记成需要 review (本 plugin 进一步删除) |

## 边界 / 已知限制

- **`@ts-ignore` / `@ts-expect-error` 不保留**: R.1 改写 import 形式后, 旧注释可能不再需要, 暂不清理
- **`router-link` / `router-view` template 标签**: 不在本 plugin, 由 vue3-template 处理
- **嵌套 `new Router({...})`** (e.g. 在 if/for 里): Pass C 处理
- **dynamic import 不在 require.ensure 范围**: R.6 仅处理 webpack 1/2 时代的 `require.ensure`
- **wrapper 函数体不是 `() => new Router()` 而是 `function foo() { return new Router(...) }`**: 不在 R.12/R.13 范围, 标 review 让用户手动改
- **未支持的 history mode**: `createMemoryHistory()` (Node/SSR) 不在默认改写路径, 需用户在 review 后手动加
