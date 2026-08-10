# Vue Router 3 → Vue Router 4 规则目录

**12 条规则**。plugin: `packages/plugins/vue-router-v4/`, priority 9。

## 入口构造

| # | 规则 | Vue Router 3 | Vue Router 4 |
|---|---|---|---|
| 1 | Router 构造 | `new Router({...})` | `createRouter({...})` |
| 2 | mode 转换 | `mode: 'history'` | `history: createWebHistory()` |
| 3 | mode 转换 | `mode: 'hash'` | `history: createWebHashHistory()` |
| 4 | mode 转换 | `mode: 'abstract'` | review note（v4 不支持 abstract） |
| 5 | base 保留 | `base: '/app/'` | `base: '/app/'` |

## 路由配置

| # | 规则 | Vue Router 3 | Vue Router 4 |
|---|---|---|---|
| 6 | 嵌套 children 保留 | `children: [...]` | 相同 |
| 7 | 动态路由 `*` 改 `:pathMatch(.*)*` | `path: '*'` | `path: '/:pathMatch(.*)*'` |
| 8 | 命名视图保留 | `components: { default: X, sidebar: Y }` | 相同 |
| 9 | 路由 meta 保留 | `meta: { requiresAuth: true }` | 相同 |

## 异步加载

| # | 规则 | Vue Router 3 | Vue Router 4 |
|---|---|---|---|
| 10 | `require.ensure` 改 `import()` | `component: resolve => require.ensure([], () => resolve(require('@/page/login')))` | `component: () => import('@/page/login')` |
| 11 | webpackChunkName 注释保留 | `require.ensure([], require => require('@/page/login'), 'login')` | `() => import(/* webpackChunkName: "login" */ '@/page/login')` |
| 12 | 动态 import 保留 | `() => import('@/page/x')` | 相同 |

## 编程式导航

| # | 规则 | Vue Router 3 | Vue Router 4 |
|---|---|---|---|
| (注) | `router.push/pop/go/back` | 行为相同 | 行为相同，无需转换 |
| (注) | `router.replace` | 行为相同 | 行为相同 |
| (注) | `router.currentRoute` | 行为相同 | 行为相同 |

> 编程式 API 名称未变，无需转换。但 `route.matched` 改成 `route.matched`，用法兼容。

## Navigation Guards

| (注) | `beforeEach` | 行为相同 | 行为相同 |
| (注) | `beforeResolve` | 行为相同 | 行为相同 |
| (注) | `afterEach` | 行为相同 | 行为相同 |
| (注) | 路由独享 `beforeEnter` | 行为相同 | 行为相同 |

> guards 不变。

## Import 改造

```js
// 之前
import Router from 'vue-router'
Vue.use(Router)

// 之后
import { createRouter, createWebHashHistory } from 'vue-router'
// createApp(App).use(router)
```

## 关键实现

### `require.ensure` 解析

**输入**:
```js
component: resolve => require.ensure(
  [],
  require => require('@/page/login').default,
  'login'
)
```

**输出**:
```js
component: () => import(/* webpackChunkName: "login" */ '@/page/login')
```

策略：
- 检测 `require.ensure(` 起止位置
- 第三个参数是 chunkName（字符串字面量）
- 第二个参数是 `require => require('path')`，提取路径
- 移除第一个参数（依赖列表）
- 重组为 `() => import(...)`

### history 模式判断

| Vue 2 mode | Vue 3 history |
|---|---|
| `history` | `createWebHistory(base)` |
| `hash` | `createWebHashHistory()` |
| `abstract` | review note |

## 已知 issue

- `mode: 'abstract'` 只能 hash fallback（见 `KNOWN_ISSUES.md #3`）
- `*` 通配符必须显式改 `/:pathMatch(.*)*`
- `scrollBehavior` 签名变化（未在当前规则里处理）

## 测试

样本 `examples/vue2-manage-master/src/router/index.js` 转换验证：
- 0 errors
- `new Router({mode: 'hash', routes})` → `createRouter({history: createWebHashHistory(), routes})`
- `require.ensure(..., 'login')` → `() => import(/* webpackChunkName: "login" */ '@/page/login')`
