# @vue-migrate/plugin-vue2-compat

Vue 2 → Vue 3 兼容性转换的"基础规则组" — 处理 Vue 2 API 改写但又跟具体 UI 库 / 路由 / store 无关的部分。

## 背景

vue2-compat 是早期 plugin,负责最基础、最通用的 Vue 2 → Vue 3 转换,跟具体 UI 库 / 路由 / 状态库都解耦。

**专门处理**:

| 类别 | 内容 |
|------|------|
| 1.1 入口 | `new Vue({...}).$mount('#app')` → `createApp(...).mount('#app')` |
| 1.2 类组件 | `Vue.extend(x)` → `defineComponent(x)` |
| 1.4 生命周期 | `beforeDestroy` → `beforeUnmount` |
| 1.5 生命周期 | `destroyed` → `unmounted` |
| 2.3 options | `filters: {...}` 选项移除 + review (filter 函数由 vue3-directives 处理) |
| 2.7 instance API | `this.$scopedSlots` → `this.$slots` (部分, 主要在 vue3-template) |
| 2.10 事件总线 | `this.$on / $off / $once` review (Vue 3 移除) |
| 5.2 functional | `functional: true` review (需手动改写为函数式) |
| 6.4 静态调用 | `Vue.compile / Vue.observable / Vue.set / Vue.delete` 改写或 review |

**不在本 plugin** (各有所属):

| Plugin | 处理 |
|--------|------|
| vue3-entry | `Vue.use / Vue.component / Vue.directive / Vue.prototype / Vue.config` 入口链 |
| vue3-template | template slot/slot-scope/v-bind.sync/keep-alive |
| vue3-directives | 指令生命周期 (bind/inserted/unbind → beforeMount/mounted/unmount) + filter 函数 |
| vue3-types | TS 类型补全 |
| elementui | `<el-*>` 标签改写 |

## 负责规则

| 编号 | 规则 | 自动化程度 | 改写形式 |
|------|------|----------|---------|
| VC.1 | `new Vue({...}).$mount('#app')` | ✅ 自动 | `createApp(defineComponent({...})).mount('#app')` |
| VC.2 | `new Vue({el: '#app'})` 简写模式 (iter-032) | ✅ 自动 | `createApp(defineComponent({...})).mount('#app')` |
| VC.3 | `new Vue({...})` (无 $mount, 无 el) | ✅ 自动 | `createApp(defineComponent({...}))` (assign 模式) |
| VC.4 | `Vue.extend(x)` | ✅ 自动 | `defineComponent(x)` |
| VC.5 | `Vue.observable(o)` | ✅ 自动 | `reactive(o)` + 自动 import reactive |
| VC.6 | `beforeDestroy: ...` (ObjectMethod / ObjectProperty) | ✅ 自动 | `beforeUnmount: ...` |
| VC.7 | `destroyed: ...` | ✅ 自动 | `unmounted: ...` |
| VC.8 | `Vue.compile(...)` | ⚠️ review | Vue 3 不再全局可访问, 需用 `@vue/compiler-dom` 手动处理 |
| VC.9 | `Vue.set(o, k, v)` / `Vue.delete(o, k)` | ⚠️ review | Vue 3 已废弃, 用 reactive()/ref() 或直接赋值 |
| VC.10 | `filters: {...}` 选项 | ⚠️ review | Vue 3 移除, filter 函数由 vue3-directives 处理; options 字段直接删除 |
| VC.11 | `functional: true` | ⚠️ review | 需重写为 `() => h(...)` 形式 |
| VC.12 | `this.$on / $off / $once` 事件总线 | ⚠️ review | Vue 3 移除, 用 mitt / tiny-emitter 等第三方库 |
| VC.13 | `this.$scopedSlots` | (delegated) | 由 vue3-template 处理 |

## 关键实现

### VC.1: new Vue({...}).$mount('#app') 整段替换

```typescript
// parent 是 MemberExpression (new Vue({...}).$mount),
// 其 object 是 NewExpression (new Vue({...}))
if (
  t.isMemberExpression(parent) &&
  t.isNewExpression(parent.object) &&
  t.isIdentifier(parent.property, { name: '$mount' }) &&
  t.isStringLiteral(parent.arguments[0])
) {
  // 整段替换为 createApp(...).mount('#app')
  // 如果同时有 el 选项,移除它($mount 会覆盖 el)
  if (elRemoveIdx >= 0) optionsArg.properties.splice(elRemoveIdx, 1)
  const mountCall = t.callExpression(
    t.memberExpression(createAppCall, t.identifier('mount')),
    [parent.arguments[0]],
  )
  path.parentPath.replaceWith(mountCall)  // 整个 new Vue().$mount() 链替换
}
```

**关键**: 用 `path.parentPath.replaceWith(mountCall)` 替换的是外层的 `$mount` MemberExpression,而不是内部的 NewExpression — 这样 chain 上的所有节点一起被新节点替换,避免 `new Vue()` 单独被换后 `$mount` 留个孤儿调用。

### VC.2: new Vue({el: '#app'}) 简写模式 (iter-032)

Vue 2 常见模式: 不调 `$mount()`,而是用 `el: '#app'` 选项自动挂载:

```javascript
// BEFORE
new Vue({
  el: '#app',
  router,
  render: h => h(App)
})

// AFTER
createApp(defineComponent({
  router,
  render: h => h(App)
})).mount('#app')
```

实现: 检测 `optionsArg.properties` 里 `el: <string-literal>`, 移除该 prop, 用其值作为 `.mount()` 的入参。

### VC.4: Vue.extend(x) → defineComponent(x)

简单 Identifier 替换:

```typescript
if (propName === 'extend') {
  node.callee = t.identifier('defineComponent')  // 直接换 callee name
  needsDefineComponent = true
}
```

**为什么用 defineComponent 不是 createApp?** `Vue.extend(x)` 是创建组件定义,不是创建 app。Vue 3 对应 API 是 `defineComponent`, 真正的 app 创建在调用处(通常是 `new Vue(extend(x))` → `createApp(defineComponent(x))`)。

### VC.5: Vue.observable(o) → reactive(o)

```typescript
if (propName === 'observable') {
  node.callee = t.identifier('reactive')
  ctx.utils.__needsReactive = true  // 标记需要补 import
}
```

之后在 transform 末尾检查这个 flag, 调 `ensureVueImport(file, ['reactive'])` 把 `reactive` 加到 `import { ... } from 'vue'` 里。

### VC.6 / VC.7: 生命周期 hook 重命名

```typescript
function handleLifecycleHookRename(node, utils) {
  if (name === 'beforeDestroy') {
    node.key = t.identifier('beforeUnmount')  // ObjectMethod 和 ObjectProperty 都用同一逻辑
    utils.markChanged('beforeDestroy → beforeUnmount')
  } else if (name === 'destroyed') {
    node.key = t.identifier('unmounted')
  }
}
```

**关键**: 同时处理 `ObjectMethod` (方法形式: `beforeDestroy() { ... }`) 和 `ObjectProperty` (函数引用形式: `beforeDestroy: someFn`), 不能只匹配一种。

### ensureVueImport (import 补全)

```typescript
function ensureVueImport(file, names: string[]) {
  const ast = file.scriptAst
  let vueImport = ast.program.body.find(n => 
    t.isImportDeclaration(n) && t.isStringLiteral(n.source, { value: 'vue' }))
  if (vueImport) {
    // 已存在 import { ... } from 'vue', 追加 specifier (去重)
    const existing = new Set(vueImport.specifiers
      .filter(s => t.isImportSpecifier(s))
      .map(s => s.imported.name))
    for (const name of names) {
      if (!existing.has(name)) vueImport.specifiers.push(...)
    }
  } else {
    // 没 import 'vue', 新建 (插到 program.body 最前)
    const newImport = t.importDeclaration(
      names.map(n => t.importSpecifier(t.identifier(n), t.identifier(n))),
      t.stringLiteral('vue'),
    )
    ast.program.body.unshift(newImport)
  }
}
```

`createApp` / `defineComponent` / `reactive` 按需补到 `import { ... } from 'vue'`, 已存在则去重。

## 文件结构

```
src/
├── index.ts                                  # 4 大段: CallExpression / NewExpression / ObjectMethod/ObjectProperty / MemberExpression
└── types-shim.d.ts
```

无 `__tests__/` 目录 (早期 plugin, 通过 tsc + 真实项目回归验证)。

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- VC.1 (`new Vue({...}).$mount`): 1 触发 (master main.js) — iter-046 B 修复, 11111/ 已 hand-fix
- VC.4 (`Vue.extend`): 0 触发 (master 不直接用, 走 Vue.component 间接)
- VC.6 / VC.7 (lifecycle rename): 多触发 (各种 .vue 的 beforeDestroy/destroyed)
- VC.5 (`Vue.observable`): 0 触发 (master 用 Vuex + Pinia)
- VC.8/9/10/11/12 review: 偶尔触发,需用户手动改

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-vue2-compat'
```

priority: **10** (priority 最高之一, 先跑 — 给后面 vue3-entry / vue3-template / vue3-directives 准备干净的 AST)。

## 跟其他 plugin 的关系

| Plugin | 处理 (互补) |
|--------|------|
| vue3-entry | `Vue.use` / `Vue.component` / `Vue.prototype` / `Vue.config` (本 plugin 不碰) |
| vue3-template | template slot / v-bind.sync / keep-alive (本 plugin 不碰) |
| vue3-directives | 指令生命周期 + filter 函数 (本 plugin 仅标记 filters option 字段) |
| vue3-types | TS 类型补全 (本 plugin 不动) |
| composition | 进一步把 `defineComponent({...})` 拆成 `<script setup>` |
| import-cleaner | 在本 plugin 之后跑, 清理已 unused 的 import |

## 边界 / 已知限制

- **`this.$on` review 是 best-effort**: 出现在 JSX / template event binding 等形式可能漏检, 需用户自己 grep
- **`new Vue({el: <expression>})`**: el 不是 string-literal / template-literal 时, 标 review 不自动处理
- **自定义指令的 `bind / inserted / unbind` 钩子**: 不在本 plugin, 由 vue3-directives 处理
- **`Vue.mixin`**: 不在本 plugin (跟 entry 一起处理, 见 vue3-entry)
- **Vue 2.7 兼容层**: 不考虑 (Vue 2.7 跟 Vue 3 已经是过渡, 假设用户升 Vue 3 4.x)
- **TypeScript 的 `Component` decorator** (`@Component` class): 不在本 plugin, 需用户自己用 `defineComponent` 重写
