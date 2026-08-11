# vue-migrate Plugin 总览指南

vue-migrate 由 **18 个 plugin** 组成, 每个 plugin 负责 Vue 2 → Vue 3 转换的特定切面。本文档是高层次导览 — 哪个 plugin 处理什么, 怎么协同, 怎么选 priority。

详细规则请看每个 plugin 自己的 `README.md`。

---

## 18 Plugin 速查表 (按 priority 排序)

| Priority | Plugin | 负责 | README |
|----------|--------|------|--------|
| **-1**  | import-cleaner | 所有 transform 后清 unused import | [→](../packages/plugins/import-cleaner/README.md) |
| **0**   | composition | Options → `<script setup>` (核心) | [→](../packages/plugins/composition/README.md) |
| **3**   | this-replacer | `this.$http/$axios/$api/...` 字符串级替换 | [→](../packages/plugins/this-replacer/README.md) |
| **5**   | vite-compat | Node 内置 / Vuex-style store / echarts review | [→](../packages/plugins/vite-compat/README.md) |
| **5**   | store-bridge | `this.$store` / `useStore()` 兼容 | [→](../packages/plugins/store-bridge/README.md) |
| **7**   | 3rd-party-imports | echarts v5 / vuedraggable v4 / xlsx namespace | [→](../packages/plugins/3rd-party-imports/README.md) |
| **7**   | resource-copier | 非代码资源 (svg / public / styles) 复制 | [→](../packages/plugins/resource-copier/README.md) |
| **8**   | vxe-table | `<vxe-table-column>` → `<vxe-column>` | [→](../packages/plugins/vxe-table/README.md) |
| **8**   | vue3-template | template slot / v-bind.sync / keep-alive | [→](../packages/plugins/vue3-template/README.md) |
| **9**   | vue-router-v4 | `new Router` → `createRouter` + import 改写 | [→](../packages/plugins/vue-router-v4/README.md) |
| **9**   | vue3-entry | `Vue.use` / `Vue.component` / `Vue.prototype` 入口链 | [→](../packages/plugins/vue3-entry/README.md) |
| **9**   | vue3-directives | 指令生命周期 / filter 函数 / auto-register | [→](../packages/plugins/vue3-directives/README.md) |
| **10**  | vue2-compat | `Vue.extend` / `new Vue()` / 生命周期 rename | [→](../packages/plugins/vue2-compat/README.md) |
| **10**  | vue3-types | TS 类型补全 / `defineProps` / `defineEmits` | [→](../packages/plugins/vue3-types/README.md) |
| **12**  | elementui | `<el-*>` 标签 / `this.$message` / el-icon 映射 | [→](../packages/plugins/elementui/README.md) |
| **50**  | vuex-pinia | vuex store → pinia defineStore | [→](../packages/plugins/vuex-pinia/README.md) |
| **80**  | vite-scaffold | 生成 `vite.config.js` / `index.html` | [→](../packages/plugins/vite-scaffold/README.md) |
| **100** | package-json | 升级 deps / scripts / 复制 styles | [→](../packages/plugins/package-json/README.md) |

> priority 数字越小越先跑。Composition (0) 是核心, 在它之前都是"准备数据", 在它之后是"清理 + 项目级"。

---

## 按 Vue 2 → Vue 3 转换切面分组

### 第 1 组: 基础 (priority 10, 先跑)

最基础的 API 改写, 给后面所有 plugin 准备干净的 AST。

| Plugin | 处理 |
|--------|------|
| vue2-compat | `new Vue({...}).$mount('#app')` / `Vue.extend(x)` / 生命周期 / filters / functional |
| vue3-types | TypeScript 类型补全, 把 data 字段推成 ref/reactive 类型 |

### 第 2 组: 模板 + 入口 (priority 9)

Vue 2 的 template 语法改 Vue 3, 以及入口链 (Vue.use / Vue.component) 改 Vue 3.

| Plugin | 处理 |
|--------|------|
| vue-router-v4 | router 升级 |
| vue3-entry | `Vue.use` / `Vue.component` / `Vue.prototype` 入口链 |
| vue3-directives | 指令生命周期 / filter 函数 |
| vue3-template | template 语法 (slot / v-bind.sync / keep-alive) |

### 第 3 组: UI 库 + 子组件 (priority 8)

| Plugin | 处理 |
|--------|------|
| elementui | element-ui → element-plus 全部 |
| vxe-table | vxe-table 3 → 4 |

### 第 4 组: 资源 + 3rd-party (priority 7)

| Plugin | 处理 |
|--------|------|
| resource-copier | svg / public / styles 复制到 outDir |
| 3rd-party-imports | echarts / vuedraggable / xlsx / file-saver import 形式 |

### 第 5 组: store + 兼容 (priority 5)

| Plugin | 处理 |
|--------|------|
| vite-compat | Node 内置 / Vuex-style store / echarts review |
| store-bridge | `this.$store` 兼容 (跟 pinia/vuex 协同) |

### 第 6 组: 核心 (priority 0)

| Plugin | 处理 |
|--------|------|
| composition | **核心**: Options → `<script setup>` |

> priority 0 不是 "0 = 重要", 是 "0 = 最先跑" (composition 在 import-cleaner 之后才跑, 但在所有其他 plugin 之前)

### 第 7 组: this-replacer (priority 3)

| Plugin | 处理 |
|--------|------|
| this-replacer | `this.$http/$axios/$api/$util/...` 字符串级替换 |

### 第 8 组: 项目级 (priority 50~100)

最后跑, 处理 package.json / scaffold 级别的东西。

| Plugin | 处理 |
|--------|------|
| vuex-pinia | vuex store → pinia |
| vite-scaffold | 生成 vite.config.js / index.html |
| package-json | 升级 deps + 复制 styles |

### 第 9 组: 收尾 (priority -1)

| Plugin | 处理 |
|--------|------|
| import-cleaner | 清 unused import (所有 transform 完成后最后跑) |

---

## 按"用户最常见问题"分组

### Q: 我有 element-ui 项目, 会自动转吗?

✅ **elementui** plugin 跑 (priority 12) — 改 `<el-*>` 标签, 改 `this.$message` 等全局 API, 加 `@element-plus/icons-vue` 依赖。
**注意**: CSS 路径 (`import 'element-ui/lib/theme-chalk/index.css'`) 由 **elementui** 内部处理, 不用配 3rd-party-imports。

### Q: 我有 vuex, 怎么处理?

✅ **vuex-pinia** (priority 50) — 改 `import { mapState } from 'vuex'` → `import { useAppStore } from '@/store/app'`, 把 store options 转 `defineStore`。

### Q: 我有 vue-router 3, 怎么处理?

✅ **vue-router-v4** (priority 9) — 改 `new Router({...})` → `createRouter({...})`, mode → history factory。

### Q: 我想 Options API 转 Composition API (`<script setup>`)

✅ **composition** (priority 0) — 核心 plugin, 把 data/computed/methods/watch 全部转 ref/reactive/computed/watch 形式。
**注意**: composition 用字符串级处理 + `file.useRawSource = true`, 跟 AST 级 plugin 不冲突。

### Q: 我想清理转换后的 stale import (`import Vue from 'vue'` 等)

✅ **import-cleaner** (priority -1, 最后跑) — 删 unused default/named/namespace specifier, 删整条 import。
**注意**: import-cleaner 也会扫 template 引用 (kebab ↔ camel), 防止误删 template 用的 component。

### Q: 我有 `this.$http` 这种全局属性, 怎么处理?

✅ **this-replacer** (priority 3) — 字符串级, 自动替换为 import 来的 alias。
**示例**: `this.$http.post('/login')` + `import axios from 'axios'` → `axios.post('/login')`。

### Q: 我有 `this.$on / $off` 事件总线, 怎么处理?

⚠️ **vue2-compat** (priority 10) 只标 review, 不自动改。
→ 用户改用 mitt / tiny-emitter 等第三方库。

### Q: 我有 ECharts 4.x 升级到 5.x?

✅ **3rd-party-imports** (priority 7) — `import echarts from 'echarts'` → `import * as echarts from 'echarts'` (Vite 5 ESM 严格模式需要)。
⚠️ **vite-compat** (priority 5) 同时标 review 让用户确认版本。

### Q: 我有 vxe-table 3 (Vue 2) 升级到 4 (Vue 3)?

✅ **vxe-table** (priority 8) — `<vxe-table-column>` → `<vxe-column>` + CSS 路径改写。

### Q: 我的项目用 webpack, 会自动转 vite 吗?

✅ **vite-scaffold** (priority 80) 生成 `vite.config.js` + `index.html`。
⚠️ 但**不**自动删 `vue.config.js` / `webpack.config.js`, 留 user 处理。

### Q: 我有 mixins, 会自动转吗?

⚠️ **composition** (priority 0) 只标 review, 不自动改。
→ 用户手动转 composables 形式 (mixins 转 composables 是大重构, plugin 不替你做)。

---

## 怎么改 Plugin 的执行顺序?

Plugin priority 在每个 plugin 自己的 `src/index.ts` 定义, 例如:

```typescript
const plugin: TransformPlugin = {
  name: 'import-cleaner',
  priority: -1,  // 最后跑
  // ...
}
```

改 priority 风险:
- 把 composition 改到 > 0 → 跟 AST plugin 冲突
- 把 import-cleaner 改到 > 0 → 删了老 import, 后续 plugin 找不到 binding
- 把 vite-scaffold 改到 < 80 → 在 package.json 升级前就生成 vite.config.js, 缺 vite 依赖

**建议**: 不改 priority, 改 plugin 内部逻辑 (例如改 import-cleaner 的 helper 函数)。

---

## Plugin 不做的事 (本工具不自动改)

| 模式 | 状态 | 用户该怎么办 |
|------|------|------------|
| `mixins: [...]` | ⚠️ review only | 手动转 composables |
| functional 组件 (`functional: true`) | ⚠️ review only | 手动重写为 `() => h(...)` 形式 |
| 异步组件 (`() => import(...)`) | ✅ 不动 | Vue 3 兼容 |
| `@Component` decorator | ⚠️ 不动 | 手动转 `defineComponent` |
| 复杂 render function | ⚠️ 部分 review | 见 [15-render-function-fix.md](./known-issues/15-render-function-fix.md) |
| template ref 与 data 字段同名 | ✅ 自动改名 + review | 见 [C2-template-ref-fix.md](./known-issues/C2-template-ref-fix.md) |
| `this.$on/$off` 事件总线 | ⚠️ review | 改 mitt / tiny-emitter |
| `Vue.compile` 运行时编译 | ⚠️ review | 用 `@vue/compiler-dom` |

---

## 怎么加新 Plugin?

1. 复制 `packages/plugins/<existing>/` 作为模板
2. 改 `src/index.ts` 的 `name` / `description` / `priority` / `transform(ctx)` 逻辑
3. 加单元测试到 `src/__tests__/`
4. 在 `packages/cli/src/index.ts` 加 `import '@vue-migrate/plugin-<name>'`
5. 跑 `pnpm install --filter` 加依赖
6. 跑 `pnpm tsx _dbg/check-all-tsc.mjs` 验证 0 errors
7. 跑 `pnpm tsx _dbg/check-all-tests.mjs` 验证 tests pass
8. 写 `README.md` (参照其他 plugin 的格式)
9. 在 cli 注册 + symlink (参考 `packages/cli/node_modules/@vue-migrate/`)

---

## 关联文档

- [README.md](../README.md) — 项目总览
- [EXAMPLES.md](../docs/EXAMPLES.md) — 9 个真实 before/after 例子
- [SELF_EVOLVING_ARCHITECTURE.md](../docs/SELF_EVOLVING_ARCHITECTURE.md) — 自演化系统架构
- [ElementUI_ElementPlus_Catalog.md](../docs/ElementUI_ElementPlus_Catalog.md) — 148 个 el-icon 映射
- [Router_V4_Catalog.md](../docs/Router_V4_Catalog.md) — 196 个路由迁移
- [Vuex_Pinia_Catalog.md](../docs/Vuex_Pinia_Catalog.md) — 4 个 vuex module 转 pinia
- [iter-051-054-bench.md](../docs/iter-051-054-bench.md) — iter-051~054 4 轮 review 规则沉淀
- [iter-058-regression.md](../docs/iter-058-regression.md) — 0 regression 验证
