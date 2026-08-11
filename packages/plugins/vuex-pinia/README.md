# @vue-migrate/plugin-vuex-pinia

iter-044 新增 plugin — Vuex 3 → Pinia 转换。生成 `useXxxStore = defineStore(...)`。

## 背景

Vuex 3 (Vue 2 默认状态管理) → Pinia (Vue 3 推荐)。

转换不是 1:1 映射:
- Vuex 的 `mutations` / `actions` / `state` / `getters` 4 个独立 section
- Pinia 的 `state` (factory function) / `getters` / `actions` 3 个 (无独立 mutations)
- Vuex 通过 `commit("X", p)` 调 mutation, `dispatch("X", p)` 调 action
- Pinia 直接 `store.X(p)` (action) 或 `store.x = p` (state)

vuex-pinia 负责:
1. `new Vuex.Store({...})` → `export const useXxxStore = defineStore('xxx', {...})`
2. state / getters / mutations / actions 4 个 section 合并到 Pinia 的 state / getters / actions 3 个
3. mutations 合并到 actions (state 改写 = this.xxx = p)
4. import 替换 (vuex → pinia)

store-bridge (iter-046) **接力** 处理组件里的 Vuex 风格调用 (`useStore()`, `store.dispatch`, `store.commit`)。

## 负责规则

| 编号 | 规则 | 自动化程度 |
|------|------|----------|
| P.1 | `import Vuex from 'vuex'` → `import { defineStore } from 'pinia'` | ✅ 自动 |
| P.2 | `new Vuex.Store({state, getters, mutations, actions})` → `export const useXxxStore = defineStore('xxx', {...})` | ✅ 自动 |
| P.3 | `state: { a: 1 }` → `state: () => ({ a: 1 })` (Pinia 要 factory function) | ✅ 自动 |
| P.4 | `mutations: { foo(state, p) { state.x = p } }` 合并到 actions | ✅ 自动 |
| P.5 | `commit("X", p)` (组件侧) 不在本 plugin, **store-bridge 处理** | (外部) |
| P.6 | `actions: { foo({commit}) {...} }` → `actions: { foo() {...} }` (移除 destructure) | ✅ 自动 |
| P.7 | Vuex **modules 模式** (`modules: { user, app }`) | ✅ 自动: 每个 module 一个 `useXxxStore` + index.js 创建 `createPinia()` 聚合 |
| P.8 | Vuex `getters: { ... }` → Pinia `getters: { ... }` (注意 signature: state => value) | ✅ 自动 |

## 关键实现

```typescript
// 1. babel parse new Vuex.Store({...})
// 2. 提取 state / getters / mutations / actions 4 个 section
// 3. 生成 Pinia defineStore body:
//    - state: () => ({ ... })
//    - getters: { foo: (state) => state.xxx }
//    - actions: {
//        oldMutation: (payload) { this.xxx = payload },  // mutations 合并
//        oldAction: (payload) { ... }                     // 保留
//      }
// 4. modules 模式: 每个 module 一个 defineStore + index.js createPinia() 聚合
```

## modules 模式 (iter-044 A2)

```javascript
// Before (master store/index.js)
const store = new Vuex.Store({
  modules: { app, user, permission, tagsView },
  getters
})

// After (11111/ store/index.js)
import { createPinia } from 'pinia'
import { useAppStore } from './modules/app'
import { useUserStore } from './modules/user'
// ...

export const piniaInstance = createPinia()
// 用户代码: const app = useAppStore()  (Pinia 自动 use 同一个 instance)
```

每个 `store/modules/app.js` 转成:
```javascript
// Before
const app = {
  state: () => ({ device: 'desktop' }),
  mutations: { TOGGLE_DEVICE: (state, device) => { state.device = device } },
  actions: { ToggleSideBar: ({ commit }, device) => commit('TOGGLE_DEVICE', device) }
}

// After
export const useAppStore = defineStore('app', {
  state: () => ({ device: 'desktop' }),
  actions: {
    TOGGLE_DEVICE(device) { this.device = device },  // 合并 mutation
    ToggleSideBar(device) { this.TOGGLE_DEVICE(device) }  // 调 action
  }
})
```

## 命名规则

- `useXxxStore` 名字 = 文件路径 PascalCase
  - `src/store/modules/app.js` → `useAppStore`
  - `src/store/modules/user.js` → `useUserStore`
- Vuex `id` 推断: file basename (e.g. `app.js` → `'app'`)

## 文件结构

```
src/
├── index.ts                # 插件入口
├── rules/
│   └── (内部 modules 拆分 / 合并 mutation 等)
└── __tests__/
    ├── test-vuex-modules.mjs    # 30 个 modules 测试
    └── (其他 store 测试)
```

## 测试

- `packages/plugins/vuex-pinia/src/__tests__/test-vuex-modules.mjs` — 30 个 modules 测试
- 实测: iter-058 跑 vue-element-admin-master 195 源文件, vuex-pinia 处理 4 个 store modules, 0 错误

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-vuex-pinia'
```

priority: **9** (跟 vue-router-v4 / vue3-entry 一致)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| **vuex-pinia** | **`new Vuex.Store({...})` → `defineStore('xxx', {...})` + 生成 `useXxxStore`** |
| **store-bridge** (iter-046) | 组件侧 `useStore()` / `store.state` / `store.dispatch` → `useXxxStore()` |
| import-cleaner | 清理 `import Vuex from 'vuex'` (vuex-pinia 替换后) |
| composition | `this.$store` 引用 → `useXxxStore()` 替换 |
