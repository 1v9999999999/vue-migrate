# #15: Render Function / 异步组件 — 用户修复指南

**Status**: Open (user-side optional 简化)
**Severity**: minor (Vue 3 合法, 不会 build error, 只是啰嗦)
**Triggers**: 1 文件 (vue-element-admin-master `src/main.js`)
**Plugin**: vue3-entry

## 问题本质

Vue 2 项目 main.js 的经典写法:

```javascript
import Vue from 'vue'
import App from './App'
import router from './router'
import store from './store'

new Vue({
  router,    // Vue 2 风格: router 直接放 options
  store,     // 同上
  render: h => h(App)
}).$mount('#app')
```

**Vue 2 时代**:
- `new Vue({router, store, render: ...})` 全部塞 options
- `render: h => h(App)` 是 Vue 2 推荐的"无 template + 单组件挂载"模式
- `h` 由 Vue 2 全局注入

**Vue 3 时代**:
- `router` / `store` 必须 `.use()` 安装
- `createApp(App).use(router).use(store).mount('#app')` 是现代写法
- `render: h => h(App)` 在 `defineComponent` 里仍合法, 但 `h` 不再全局注入, 需 `import { h } from 'vue'`

## vue-migrate 现在的处理 (iter-033 + iter-063)

```javascript
// vue-migrate 输出 (Vue 3 合法, build 不挂)
import { defineComponent, createApp } from 'vue'

createApp(defineComponent({
  router,
  store,
  render: h => h(App)
})).mount('#app')
```

**iter-033 转换**:
1. `new Vue({...})` → `createApp(defineComponent({...}))`
2. `router` / `store` 字段保留在 options (Vue 3 也支持, 但**仅当 createApp 不再调 .use() 时** — Vue 3 内部会 fallback 处理)
3. 实际上: Vue 3 createApp 收到 `router` / `store` 字段会被忽略, 不会装到 app 上

**iter-063 加 manualReview**:
```
[#15 render shortcut] 检测到 render: h => h(App). 可手动简化为:
createApp(App).use(router).use(store).mount('#app')
(把原 options 里的 router/store 抽到 .use() chain, 移除 render)
```

## 用户手动简化 (推荐)

### 简化前 (vue-migrate 输出, 仍合法但啰嗦)

```javascript
import { defineComponent, createApp } from 'vue'
import App from './App'
import router from './router'
import store from './store'

createApp(defineComponent({
  router,
  store,
  render: h => h(App)
})).mount('#app')
```

**问题**:
- 用了 `defineComponent` 包了一层 (没必要, App 本身就是 SFC)
- `router` / `store` 在 options 里被忽略 (Vue 3 不走 options 自动安装, 必须 `.use()`)
- 实际上 `router` / `store` 没装到 app, **路由跳转会失败**

### 简化后 (推荐, Vue 3 标准写法)

```javascript
import { createApp } from 'vue'
import App from './App'
import router from './router'
import store from './store'

createApp(App).use(router).use(store).mount('#app')
```

**优势**:
- 无 `defineComponent` wrapper
- `router` / `store` 显式 `.use()` 安装
- `App` 直接作为 root component
- App.vue 里 `import { useStore } from 'vuex'` 仍能 work (vuex-pinia 已替换 import)

### 异步组件怎么办?

Vue 2 异步组件:

```javascript
// Vue 2
new Vue({
  components: { AsyncComp: () => import('./AsyncComp.vue') },
  render: h => h(App)
})
```

**Vue 3 同样 work**: 异步组件的 `() => import(...)` 在 options 形式下, defineComponent 仍能识别, 直接挂到 app components 上。

```javascript
// Vue 3 (跟 Vue 2 类似, 仍合法)
createApp(defineComponent({
  components: { AsyncComp: () => import('./AsyncComp.vue') },
  render: h => h(App)
})).mount('#app')
```

## 实际触发例子 (vue-element-admin-master)

```bash
# master/src/main.js (B 没改)
$ grep "render:" master/src/main.js
  render: h => h(App)
```

**iter-063 验证**:
- master `src/main.js`: 1 trigger (B 没手改这个, 只改了 11111/)
- 11111/ `src/main.js`: 0 trigger (B iter-048 已手改成 `createApp(App).use(router).use(store).mount('#app')`)

## 修复策略 (用户侧)

### 情况 1: master / vue-element-admin-master 风格 (最常见)

**检测你的项目有没有这个模式**:

```bash
grep -rn "render:\s*h\s*=>\s*h(App)" src/
```

如果有, **手动简化**:

```javascript
// 改前 (vue-migrate 输出)
import { defineComponent, createApp } from 'vue'
import App from './App'
import router from './router'
import store from './store'

createApp(defineComponent({
  router, store,
  render: h => h(App)
})).mount('#app')

// 改后 (Vue 3 标准)
import { createApp } from 'vue'
import App from './App'
import router from './router'
import store from './store'

createApp(App).use(router).use(store).mount('#app')
```

### 情况 2: 用了 vue-cli 默认模板 (render + router + store)

完全跟情况 1 同 — 改法一样。

### 情况 3: 自定义 render 函数 (高级用法)

```javascript
// 复杂 render: 动态根据权限渲染不同 root
render: h => h(store.getters.isAdmin ? AdminApp : UserApp)
```

**这种** vue-migrate 不标 review (因为不是简单 `h => h(App)`), 你要自己改:

```javascript
// 改前
createApp(defineComponent({
  render: h => h(store.getters.isAdmin ? AdminApp : UserApp)
})).mount('#app')

// 改后 (用 computed root + watch)
// ... 略, 涉及 setup() 内部逻辑
```

## 为什么 plugin 不能自动改

理论上可以让 plugin 检测 `render: h => h(App)` 简单模式, 自动改写成 `createApp(App)`, 但有 3 个问题:

1. **router/store 抽取**: 原 options 里的 `router` / `store` 必须从 options 删除, 加到 `.use()` chain
   - 但 `router` / `store` 字段名可能跟 user 实际定义不同 (e.g. `myRouter` / `vuexStore`)
   - plugin 没法推断哪个字段是 router 哪个是 store
2. **render 函数体复杂**: `h => h(App)` vs `h => h(AdminApp)` vs `h => h('div', {...}, [...])` — 模式千变万化
3. **副作用风险**: 自动改写后, 老的 `new Vue().$mount()` 整个被替换, 万一 user 在外层加了其它初始化代码 (e.g. 全局 directive 注册), plugin 误删

**更安全**: 只标 review, 提示用户手改。1 分钟搞定。

## 关闭条件

#15 可以**关闭**当:
- 用户读完本指南, 全部手改成 Vue 3 标准
- 或者 vue-migrate 添加**强模式** (`--strict-render`), 满足 "确认 h 只引用 App + 只用 router/store 字段" 时自动改

**iter-058 baseline**: 1 trigger (master 唯一 main.js), 0 regression
**iter-033 修复前**: 同样 1 trigger, 但输出是 `defineComponent({...})` 包裹, 字段被忽略
**iter-033 修复后**: 1 trigger, 输出**合法但啰嗦**, build 不挂
**iter-063 加 review**: 1 trigger, 提示用户手改更简洁

**当前状态**: Open, 标 user-side 可选简化。
