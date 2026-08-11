# @vue-migrate/plugin-store-bridge

iter-046 新增 plugin — Vuex 风格 store 调用 (useStore() / store.state / store.dispatch / store.commit / store.getters) 桥接到 Pinia 风格 (useXxxStore())。

## 背景

vuex-pinia 已经在 iter-044 把 `new Vuex.Store({...})` 转成 `defineStore('xxx', ...)`, 生成 `useXxxStore` 函数 (例如 `useAppStore` / `useUserStore`)。

但**组件里的 Vuex 风格调用** (`useStore()`, `store.state.app.device`, `store.dispatch('user/login', p)`) 还在用 Vuex 写法, Vue 3 / Pinia 里不存在 `useStore()` (Pinia 是 `useXxxStore()`).

store-bridge 负责把这层桥接:
1. `useStore()` (无参) → `useAppStore()` (基于路径推断或 fallback)
2. `store.state.app.device` → `useAppStore().device` (state 字段直接拿)
3. `store.dispatch('user/login', p)` → `useUserStore().login(p)` (Vuex namespace 拆分)
4. `store.getters.token` → `useXxxStore().token` (getter 变 pinia state)
5. `store.commit('X/Y', p)` → `useXxxStore().Y(p)` (Vuex mutation 改用 action)
6. 自动 import `useXxxStore` + 删除 `import { useStore } from 'pinia'`

## 负责规则

| 编号 | 规则 | 自动化程度 |
|------|------|----------|
| B.1 | `useStore()` 无参 → `useXxxStore()` (Xxx 从路径推) | ✅ 自动 + review 提示 store 名字 |
| B.2 | `store.state.X.Y` → `useXxxStore().Y` | ✅ 自动 |
| B.3 | `store.dispatch("X/Y", p)` → `useXxxStore().Y(p)` (namespace 拆) | ✅ 自动 |
| B.4 | `store.getters.X` → `useXxxStore().X` (按 GETTER_TO_STORE 表) | ✅ 自动 + review |
| B.5 | `store.commit("X/Y", p)` → `useXxxStore().Y(p)` (mutation 改 action) | ✅ 自动 + review |
| B.6 | `commit("X", p)` / `dispatch("X", p)` (无 store. 前缀) | ✅ 自动 |
| B.7 | 自动加 `import { useXxxStore } from '@/store'` | ✅ 自动 |
| B.8 | 删除 `import { useStore } from 'pinia'` (Vuex 时代的导入) | ✅ 自动 |

## store name 推断策略

```typescript
// 1) 文件路径: src/views/dashboard/admin/index.vue → useAdminStore
// 2) 当前文件已有 import: import { useAppStore } → 优先复用
// 3) Fallback: useAppStore (默认)
```

## GETTER_TO_STORE 表

Pinia state 名字相同但在不同 store 的, plugin 维护一个映射表:
- `name` → user store (`name` 在 user store 里有,不在 app store)
- `avatar` → user store
- `roles` → user store
- `device` → app store
- `size` → app store
- ...

这是 heuristic, 用户可在 review 后手动改 store 名。

## 文件结构

```
src/
├── index.ts                # 插件入口
├── rules/                  # (内部 rules 模块)
└── __tests__/
    └── test-store-bridge.ts  # 67 个 unit test
```

## 关键实现

```typescript
// 1. 在 script AST 顶部 找 Vuex 风格调用
// 2. inferStoreNameFromPath()  推断 Xxx
// 3. 把 store.X.Y 表达式转成 useXxxStore().Y
// 4. 替换完成后扫 file.source 加 import
// 5. 删除 import { useStore } from 'pinia'
```

## 测试

`packages/plugins/store-bridge/src/__tests__/test-store-bridge.ts` — 67 个测试覆盖:
- useStore() 无参 / 嵌套 useStore() / chain
- state / dispatch / commit / getters 各种访问方式
- namespace 拆分 (`user/login` → `useUserStore().login`)
- GETTER_TO_STORE 表
- import 自动加 + 删除

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- **128 处 store-bridge 触发** (useAppStore / useUserStore 替换)
- 0 false positive

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-store-bridge'
```

priority: **-1** (在 composition 之后, import-cleaner 之前)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| vuex-pinia | `new Vuex.Store({...})` → `defineStore('xxx', {...})` + 生成 `useXxxStore` |
| **store-bridge** | **组件里的 Vuex 调用 → Pinia 调用** |
| this-replacer | `this.$store` 不在本 plugin 白名单, 让 store-bridge 处理 |
| composition | `this.$store.X.Y` → `useXxxStore().Y` (跟 store-bridge 协同) |
