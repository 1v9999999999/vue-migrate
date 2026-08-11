# @vue-migrate/plugin-vite-compat

Vue 2 → Vue 3 + Vite 浏览器环境兼容性 review plugin — 标 review, 不自动改写 (保守策略)。

## 背景

Vue 2 → Vue 3 升级到 Vite 之后, 部分代码即使语法正确, 在浏览器/Vite 环境下也会跑不起来:

1. **Node 内置模块**: `import path from 'path'` / `import fs from 'fs'` 在 Vite 浏览器里直接报错 (Vite 不打包 Node 内置)
2. **Vuex 风格 store 调用**: `store.dispatch('xxx/yyy', payload)` / `store.getters.xxx` — pinia 没有 dispatch/getters/state 概念, 必须改 `useXxxStore().yyy(payload)`
3. **echarts 4.x CJS**: `import echarts from 'echarts'` + `echarts@4` 在 Vite ESM 严格模式下会报 "default is not exported"
4. **Vue 2 时代老依赖**: `vuedraggable@<2 / vue-count-to@1.x / screenfull@4` 等跟 Vue 3 / Vite 不兼容

**策略**: 本 plugin **只做识别 + 标 manualReview**, 不自动改写。原因:
- 改写风险大 (如 `store.getters` 在 vuex 4 + useStore() 里其实是合法的)
- 用户需根据 store 实际是 vuex 还是 pinia 决定怎么改
- 跟其他 plugin 协同: store-bridge 已处理 `this.$store` 形式, vuex-pinia 已处理 import 形式;本 plugin 补全"已经转 setup 之后"剩余的 Vuex 风格调用

## 负责规则

| 编号 | 规则 | 自动化程度 | 触发条件 |
|------|------|----------|---------|
| VC.1 | `import ... from "<Node-builtin>"` | ⚠️ review | 14 个常见 Node 内置 (path / fs / os / http / https / ...) |
| VC.2 | `store.dispatch("xxx/yyy", ...)` Vuex namespace 风格 | ⚠️ review | 第一个参数是 string literal 且含 `/` |
| VC.3 | `store.getters.xxx` / `store.state.xxx` | ⚠️ review | MemberExpression, prop 是 `getters` / `state` |
| VC.4 | `store.commit("xxx/yyy", ...)` Vuex namespace 风格 | ⚠️ review | CallExpression, 第一个 string literal 含 `/` |
| VC.5 | `import echarts from 'echarts'` 无版本约束 | ⚠️ review | echarts 4.x CJS 在 Vite ESM 失败 |
| VC.6 | `require('echarts')` CJS 形式 | ⚠️ review | 浏览器不支持 require |
| VC.7 | `package.json`: `vuedraggable / vue-count-to / vue-splitpane / tui-editor / driver.js` | ⚠️ review | 这些包的 Vue 2 时代版本跟 Vue 3 不兼容 |
| VC.8 | `package.json`: `echarts@4.x` | ⚠️ review | CJS-only |
| VC.9 | `package.json`: `screenfull@4.x` | ⚠️ review | CJS-only |

## 关键实现

### 4 段 review, 独立函数

```typescript
function applyNodeBuiltinReview(file, utils)   // VC.1
function applyStoreContextReview(file, utils) // VC.2 VC.3 VC.4
function applyEchartsReview(file, utils)       // VC.5 VC.6
function applyPackageJsonReview(file, utils)   // VC.7 VC.8 VC.9
```

每段都遍历 AST, 命中规则就 `utils.manualReview(...)` 标提示, 同时 `utils.markChanged(...)` 标记文件已变更 (仅供 reporter 计数)。

### VC.2 / VC.4 字符串字面量 namespace 检查

```typescript
if (
  t.isStringLiteral(node.arguments[0]) &&
  node.arguments[0].value.includes('/')  // namespace 模式: 'user/login' / 'app/xxx'
) {
  utils.manualReview(`store.dispatch("${node.arguments[0].value}", ...) 是 Vuex 风格...`)
}
```

**为什么只标 namespace 模式?** `store.dispatch('login', payload)` 这种简单 action 名, pinia 也可以有 `useStore().login(payload)`, 改写不必要。只有 `'user/login'` 这种 Vuex module namespace, pinia 必须拆成 `useUserStore().login()`。

### VC.3 保守策略 (false positive 容忍)

```typescript
if (prop === 'getters') {
  utils.manualReview(
    `store.getters.xxx 可能是 Vuex getter (pinia 改为 useXxxStore().xxx)。
     如果 store 是 vuex 4 + useStore(), 保持原样。`
  )
}
```

**为什么不用 AST 推断 store 类型?** 静态推断 `store` 是 Vuex 还是 Pinia 不可能 (用户可能用了 vuex 4 + useStore 风格)。宁可误报, 不可漏报 — 用户看到 review 自己判断。

### VC.7~9 package.json 处理

```typescript
if (file.path && file.path.endsWith('package.json')) {
  applyPackageJsonReview(file, utils)
}
```

**独立判断路径**: 仅对 `package.json` 文件调, 因为 vue 时代 package.json 跟代码不在同一个 file 对象里。`JSON.parse(file.source)` 解析, 检查 `dependencies` / `devDependencies` 合并, 命中老版本号 (`^4.x` / `~1.x`) 标 review。

**跟 package-json plugin 协同**: package-json plugin 已把 Vue 2 时代依赖升到 Vue 3 版本, 但只升已知项。vite-compat 的 review 是补充 — 标出 package-json 没识别的 3rd-party 老包, 让用户手动处理。

## 文件结构

```
src/
├── index.ts                                  # 4 段 review, 4 个独立函数 + plugin 入口
├── types-shim.d.ts
└── __tests__/
    └── test-vite-compat.ts                   # 13 case
```

## 测试

跑 13 个 case, 覆盖:
- VC.1: 14 个 Node 内置分别命中
- VC.2: `store.dispatch('user/login', payload)` 标 review / `store.dispatch('login', payload)` 不标
- VC.3: `store.getters.xxx` / `store.state.xxx` 各标一次
- VC.4: `store.commit('user/setName', name)` 标 review / 简单 action 不标
- VC.5 / VC.6: echarts import / require 各标一次
- VC.7~9: package.json 5 个老包 + echarts@4 + screenfull@4 全部命中

`packages/plugins/vite-compat/src/__tests__/test-vite-compat.ts`

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- VC.1 (Node builtin): 0 触发 (master 不直接 import Node 模块, 走 webpack alias)
- VC.2 (Vuex dispatch namespace): 0 触发 (master 用 Pinia store, 没 namespace)
- VC.3 (store.getters / state): 0 触发 (master 已用 store-bridge 改写)
- VC.5/6 (echarts): 0 触发 (master 不直接 import echarts, 走 wrapper)
- VC.7 (Vue 2 时代老包): 0 触发 (package-json plugin 已升级 vuedraggable 等)
- **0 误报** — 本 plugin 在 master 0 触发, 但对其它项目 (e.g. 有 store.dispatch 残留) 仍有价值

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-vite-compat'
```

priority: **5** (在 composition(0) 之后, store-bridge 之后, this-replacer 之前, 看到 setup 后的代码)

## 跟其他 plugin 的关系

| Plugin | 关系 |
|--------|------|
| composition | 先跑, 把 `this.$store.dispatch` 改成 `userStore.dispatch`, vite-compat 标 review 让用户决定是否改 `userStore.xxx` 形式 |
| store-bridge | 先跑, 处理 `this.$store` / `useStore()` 注入; vite-compat 处理 `store.dispatch` 这种显式 vuex-style 调用 |
| vuex-pinia | 先跑, 把 vuex 改成 pinia; vite-compat 标 review 标 store 残留的 dispatch / getters / state 模式 |
| this-replacer | 后跑, 不动 store.* 形式 (this-replacer 只动 `this.$X`) |
| 3rd-party-imports | 先跑, 把 echarts default 改 namespace; vite-compat 标 review 让用户确认版本 |
| package-json | 先跑, 升级老包; vite-compat 标 review 标 package-json 没识别的 3rd-party 老包 |

## 边界 / 已知限制

- **不自动改写**: 全部 manualReview 标, 不动 AST (跟 iter-051 this-replacer 的 "auto when import found, review otherwise" 策略不同 — vite-compat 更保守)
- **`process.env` 浏览器兼容**: 不在本 plugin 范围, Vite 通过 `import.meta.env` 替代, 需用户自己 grep
- **`require()` 检测**: 仅检测 `require('echarts')` 模式, 其它 require 调用 (e.g. `require('path')`) 在 webpack 时代是合法的, 不动
- **`globalThis` / `Buffer` / `__dirname`**: 不在本 plugin 范围, Vite 不支持
- **dynamic require**: `require(<expression>)` 不检测 (静态分析无法处理)
- **file.path 是 package.json**: 仅当 scanner 把 package.json 标为 file.path 时触发, vue-element-admin-master 这种项目 package.json 在 root, scanner 偶尔会扫到
- **echarts wrapper import**: `import * as echarts from 'echarts/core'` 这种 tree-shake 形式不影响本 plugin 判定 (本 plugin 只看 `echarts` 主包)
