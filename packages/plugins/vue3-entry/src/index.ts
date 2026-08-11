/**
 * vue3-entry plugin
 *
 * Migrate Vue2 entry / global config to Vue3 createApp chain.
 *
 * Handles:
 *  - Vue.observable(x) → reactive(x)
 *  - new Vue({...}).$mount('#app') → createApp(defineComponent({...})).mount('#app')
 *    (basic conversion done by vue2-compat; this plugin is the post-processor)
 *  - **Vue 2 entry shortcut**: `new Vue({template: '<X/>', components: {X}, ...}).$mount('#app')`
 *    → `const app = createApp(App); app.use(...).use(...).mount('#app')`
 *    (extracts App from `components`, removes `template`/`components` options, generates
 *     a multi-statement form so we can add the Element Plus icons for-loop, etc.)
 *  - Vue.use(plugin, ...) → app.use(plugin, ...)        (chained on createApp)
 *  - Vue.component('name', Comp) → app.component(...)   (chained on createApp)
 *  - Vue.directive('name', dir) → app.directive(...)    (chained on createApp)
 *  - Vue.mixin(mixin) → app.mixin(...)                  (chained on createApp)
 *  - Vue.filter(...) → REMOVED (Vue3 has no filter)
 *  - Vue.prototype.$x = val → app.config.globalProperties.$x = val
 *  - Vue.config.productionTip = X → REMOVED
 *  - Vue.config.devtools = X / Vue.config.silent = X → REMOVED
 *  - Vue.config.ignoredElements = [...] → app.config.compilerOptions.isCustomElement = (tag) => [...].includes(tag)
 *  - Vue.version → REMOVED
 *  - Vue.compile(template) → REMOVED (no runtime template compilation)
 *
 *  Priority: 9 (after vue2-compat 10, before elementui 5)
 */
// @ts-nocheck
import * as t from '@babel/types'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import type { TransformPlugin, TransformContext } from '@vue-migrate/core'
import { getMainStoreExportName } from '@vue-migrate/core'  // iter-046: P0-B fix - use real main store name
import {
  isVueStaticMember,
  getVueChainAssignment,
  ensureVueImport,
  removeVueDefaultImportIfUnused,
  rewriteProcessEnvNodeEnv,
  rewriteRequireToImport,
} from './utils.js'

// ESM-safe: babel parser/traverse/generator may have .default or not depending on entry
const _traverseObj: any = (_traverse as any)
const traverse = (_traverseObj.default || _traverseObj) as typeof _traverse
const _generateObj: any = (_generate as any)
const _generateFn: any = (_generateObj.default || _generateObj).code || (() => '')

interface ChainItem {
  /** The method name on the app (e.g. 'use', 'component') */
  method: string
  /** Original args from the Vue.x(...) call */
  args: t.Expression[]
  /** Original babel node start (for source-order tracking) */
  start: number
}

interface ProtoAssign {
  prop: string
  value: t.Expression
  start: number
}

interface ConfigAssign {
  prop: string
  value: t.Expression
  start: number
  /** How to handle this assignment */
  kind: 'remove' | 'ignoredElements'
}

const plugin: TransformPlugin = {
  name: 'vue3-entry',
  description: 'Migrate Vue2 entry / global config to Vue3 createApp chain',
  priority: 9,

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    if (!file.scriptAst) return

    // ----- iter-039 (#15c) finally: 清理孤立的 `import Vue from 'vue'` -----
    // 用 try/finally 保证无论 early return 与否都跑 (line 104 `if (!isEntry) return`)
    // 此时所有 Vue.use/filter/config/new Vue() 都已处理, 扫 AST 找 Vue 标识符引用
    // 0 引用则移除 default specifier (整个 import 没 specifier 时整条删)
    try {
      _runEntryTransform(ctx)
    } finally {
      removeVueDefaultImportIfUnused(file, (msg) => utils.markChanged(msg || ''))
    }
  },
}

function _runEntryTransform(ctx) {
  const { file, utils } = ctx
  let needsReactiveImport = false
    let needsCreateAppImport = true
    let needsDefineComponentImport = false
    let changed = false

    // ----- 1. Vue.observable(x) → reactive(x) -----
    traverse(file.scriptAst, {
      CallExpression(path: any) {
        if (isVueStaticMember(path.node, 'observable')) {
          path.node.callee = t.identifier('reactive')
          needsReactiveImport = true
          utils.markChanged('Vue.observable → reactive')
        }
      },
    })
    if (needsReactiveImport) {
      ensureVueImport(file, ['reactive'])
    }

    // ----- 2. Check if this is an entry file -----
    // vue2-compat (priority 10) runs before us (priority 9) and converts
    //   `new Vue({...})` → `createApp({...})`
    // So we need to detect both forms. Also detect `.$mount('#app')` directly
    // since that's a strong entry signal.
    const isEntryByName = !!file.metadata.isEntry
    // iter-037-fix: `createApp(` is the only Vue 3 app-entry factory. Other
    // `createXxx(` calls (e.g. `createRouter(` / `createPinia(`) are NOT
    // entry points. Use a stricter check that ensures `createApp` is
    // followed by an opening paren AND is not part of `createRouter` etc.
    const hasCreateApp = /(?<![A-Za-z])createApp\s*\(/.test(file.source)
    const isEntryByContent =
      /\bnew\s+Vue\s*\(/.test(file.source) ||
      hasCreateApp ||
      /\.\$mount\s*\(/.test(file.source)
    const isEntry = isEntryByName || isEntryByContent

    if (!isEntry) return

    // ========== iter-044 B4: process.env.NODE_ENV → import.meta.env.MODE ==========
    rewriteProcessEnvNodeEnv(file.scriptAst, utils.markChanged)

    // ========== iter-044 B5: require(x) → await import(x) + IIFE 包裹 ==========
    rewriteRequireToImport(
      file.scriptAst,
      utils.markChanged,
      utils.manualReview,
      (n) => _generateFn(n).code,
    )

    // ----- 3. Find the entry chain: new Vue({...}).$mount('#app') -----
    interface EntryChain {
      mountCall: any
      optionsArg: t.CallExpression | t.Identifier | null
      optionsObj: t.ObjectExpression | null
      appIdent: t.Identifier | null
    }
    let entryChain: EntryChain | null = null
    let entryChainRef: { v: EntryChain | null } = { v: null }

    traverse(file.scriptAst, {
      CallExpression(path: any) {
        const node = path.node
        // iter-032: 同时认 `.$mount(` (vue2) 和 `.mount(` (vue3 / 已被 vue2-compat 转换)
        if (
          t.isMemberExpression(node.callee) &&
          (t.isIdentifier(node.callee.property, { name: '$mount' }) ||
            t.isIdentifier(node.callee.property, { name: 'mount' })) &&
          t.isCallExpression(node.callee.object) &&
          node.arguments[0] &&
          t.isStringLiteral(node.arguments[0])
        ) {
          // is the .object a `new Vue({...})` or `createApp({...})` call?
          const inner: t.CallExpression = node.callee.object as any
          if (
            t.isNewExpression(inner.callee) &&
            t.isIdentifier(inner.callee, { name: 'Vue' }) &&
            inner.arguments[0] &&
            t.isObjectExpression(inner.arguments[0])
          ) {
            entryChainRef.v = {
              mountCall: path,
              optionsArg: inner,
              optionsObj: inner.arguments[0] as t.ObjectExpression,
              appIdent: null,
            }
            path.stop()
          } else if (
            t.isIdentifier(inner.callee, { name: 'createApp' }) &&
            inner.arguments[0]
          ) {
            // P0-D fix: also handle `createApp(defineComponent({...}))` (vue2-compat's output)
            // and the new form `createApp(AppComponent)`.
            let optionsObj: t.ObjectExpression | null = null
            let optionsArg: t.CallExpression | t.Identifier = inner
            const firstArg: any = inner.arguments[0]

            if (t.isObjectExpression(firstArg)) {
              optionsObj = firstArg as t.ObjectExpression
            } else if (
              t.isCallExpression(firstArg) &&
              t.isIdentifier(firstArg.callee, { name: 'defineComponent' }) &&
              t.isObjectExpression(firstArg.arguments[0])
            ) {
              optionsObj = firstArg.arguments[0] as t.ObjectExpression
              // The wrapper (defineComponent call) — used for finding inline plugins
              optionsArg = firstArg as t.CallExpression
            } else if (t.isIdentifier(firstArg)) {
              // createApp(App) — already in the new form; no options to extract
            }

            entryChainRef.v = {
              mountCall: path,
              optionsArg,
              optionsObj,
              appIdent: null,
            }
            path.stop()
          }
        }
      },
    })
    entryChain = entryChainRef.v

    if (!entryChain) {
      // entry file but no .$mount('#app') pattern found — leave alone
      utils.manualReview('Vue2 entry file 未找到 new Vue({...}).$mount(\'#app\') 调用 — 需要手动迁移入口')
      return
    }

    // ----- 3.7 iter-052: Detect other `new X().$mount('selector')` patterns (progressBar / DetailPanel 等) -----
    // 模式: 形如 `new ProgressBar({...}).$mount('#progress')` 或 `new DetailPanel().$mount(selector)` —
    //   Vue 2 用来动态创建 + 挂载组件到任意 DOM 位置. Vue 3 等价物是 `createApp(X).mount(selector)`.
    // 这里我们不能 100% 判断 X 是不是 Vue 组件(可能是别的 class),所以标 review 让用户手动改.
    // 例外: 已经在 entryChain 处理的 (new Vue() / createApp()) 跳过.
    traverse(file.scriptAst, {
      CallExpression(path: any) {
        const node = path.node
        if (
          !t.isMemberExpression(node.callee) ||
          !t.isIdentifier(node.callee.property, { name: '$mount' })
        ) return
        // node.callee.object 应该是 `new X(...)` NewExpression
        const obj = node.callee.object as any
        if (!t.isNewExpression(obj)) return
        if (!t.isIdentifier(obj.callee)) return
        const className = obj.callee.name
        if (className === 'Vue') return  // 已经在 entryChain 处理

        const selector = node.arguments[0] && t.isStringLiteral(node.arguments[0])
          ? node.arguments[0].value
          : '<dynamic>'
        utils.manualReview(
          `检测到 \`new ${className}(...)\.\$mount(${JSON.stringify(selector)})\` — Vue 2 动态组件挂载模式。\n` +
            `  Vue 3 等价物: \`createApp(${className}).mount(${JSON.stringify(selector)})\`\n` +
            `  ⚠️  注意: Vue 3 挂载到选择器时,**该 DOM 节点必须存在**且**不能跨多个 createApp 共享**。\n` +
            `  如果原来是动态创建并 append 到 body 的,Vue 3 改用 \`createApp(${className}).mount(document.createElement('div'))\` + appendChild 更稳。`,
        )
        utils.markChanged(`new ${className}().\$mount(${JSON.stringify(selector)})`)
      },
    })

    // ----- 3.5 P0-D: Detect "Vue 2 entry shortcut" -----
    // Pattern: options has {template: '<X/>', components: {X}}
    // This is the canonical Vue 2 entry pattern (the App component is registered locally).
    // In Vue 3, the App should be passed directly to `createApp(App)` — no template runtime,
    // no `components` registration. We extract X as the App and rewrite to the multi-statement
    // form so we can also add the Element Plus icons for-loop, etc.
    let vue2EntryApp: t.Identifier | null = null  // local name of the App component (e.g., App)
    let vue2EntryAppTag: string | null = null     // tag name used in template (e.g., 'App')

    if (entryChain.optionsObj) {
      const obj = entryChain.optionsObj
      const templateProp = obj.properties.find(
        (p: any) =>
          t.isObjectProperty(p) &&
          t.isIdentifier((p as any).key, { name: 'template' }),
      ) as t.ObjectProperty | undefined
      const componentsProp = obj.properties.find(
        (p: any) =>
          t.isObjectProperty(p) &&
          t.isIdentifier((p as any).key, { name: 'components' }),
      ) as t.ObjectProperty | undefined

      if (
        templateProp &&
        componentsProp &&
        t.isStringLiteral(templateProp.value) &&
        t.isObjectExpression(componentsProp.value)
      ) {
        // Extract tag from template: '<X/>' or '<X />' → X
        const m = templateProp.value.value.match(
          /^\s*<\s*([A-Za-z][A-Za-z0-9-]*)\s*\/?>\s*$/,
        )
        if (m && componentsProp.value.properties.length === 1) {
          const onlyComp = componentsProp.value.properties[0]
          if (
            (t.isObjectProperty(onlyComp) || t.isObjectMethod(onlyComp)) &&
            t.isIdentifier((onlyComp as any).key) &&
            t.isIdentifier((onlyComp as any).value) &&
            ((onlyComp as any).key as t.Identifier).name === m[1]
          ) {
            vue2EntryApp = (onlyComp as any).value as t.Identifier
            vue2EntryAppTag = m[1]
          }
        }
      }
    }

    if (vue2EntryApp) {
      // P0-D: Handle the Vue 2 entry shortcut with the multi-statement form.
      //   const app = createApp(App)
      //   app.use(router)
      //   app.use(createPinia())  // auto-injected for Vuex → Pinia
      //   app.use(ElementPlus)
      //   for (const [key, c] of Object.entries(ElementPlusIconsVue)) app.component(key, c)
      //   app.mount('#app')
      // Also: rewrite `import App from './App'` → `import App from './App.vue'`,
      // rewrite `import store from './store'` → `import { useStoreStore } from './store'`,
      // and drop `import { defineComponent } from 'vue'`.
      _handleVue2EntryShortcut(ctx, entryChain, vue2EntryApp, vue2EntryAppTag)
      return
    }

    // ----- 3.6 Detect `render: h => h(X)` shortcut (iter-033, issue #15) -----
    // Vue 2 允许 `new Vue({render: h => h(App)})` 简写,Vue 3 等价物是 `createApp(App).use(...).mount()`。
    // 自动改写风险大(router/store 需要从 options 抽到 .use() chain),所以只标 review 提示用户手动优化。
    // 穿透:optionsObj 可能是 `defineComponent({...})` (vue2-compat 包了一层)
    // optionsArg 是 `createApp(arg)`,需要穿透两层取 arg.arguments[0]
    let renderCheckObj: t.ObjectExpression | null = entryChain.optionsObj
    if (
      !renderCheckObj &&
      entryChain.optionsArg &&
      t.isCallExpression(entryChain.optionsArg) &&
      t.isIdentifier((entryChain.optionsArg as any).callee, { name: 'createApp' }) &&
      (entryChain.optionsArg as any).arguments[0] &&
      t.isCallExpression((entryChain.optionsArg as any).arguments[0]) &&
      t.isIdentifier(((entryChain.optionsArg as any).arguments[0]).callee, { name: 'defineComponent' })
    ) {
      const defArg = (entryChain.optionsArg as any).arguments[0].arguments[0]
      if (t.isObjectExpression(defArg)) renderCheckObj = defArg
    }
    if (renderCheckObj) {
      const renderProp = renderCheckObj.properties.find(
        (p: any) =>
          t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'render' }),
      )
      if (renderProp && t.isObjectProperty(renderProp) && t.isArrowFunctionExpression(renderProp.value)) {
        // detect `h => h(X)` form
        const fn = renderProp.value
        if (
          fn.params.length === 1 &&
          t.isIdentifier(fn.params[0]) &&
          t.isCallExpression(fn.body) &&
          t.isIdentifier(fn.body.callee) &&
          fn.body.callee.name === fn.params[0].name && // h(...)
          fn.body.arguments.length === 1 &&
          t.isIdentifier(fn.body.arguments[0])
        ) {
          const componentName = (fn.body.arguments[0] as t.Identifier).name
          utils.manualReview(
            `[#15 render shortcut] 检测到 render: h => h(${componentName})。可手动简化为: ` +
              `createApp(${componentName}).use(router).use(store).mount('#app')` +
              `(把原 options 里的 router/store 抽到 .use() chain,移除 render)。当前 Vue 3 写法 (createApp(defineComponent({...})).mount) 也合法,但不优雅。`,
          )
        }
      }
    }

    // ----- 4. Collect chain items BEFORE we mutate anything (to preserve source order) -----
    // We'll collect:
    //   - chainItems: Vue.x(args) statements to convert into chained app.x(args) calls
    //   - protoAssigns: Vue.prototype.$x = val statements
    //   - configAssigns: Vue.config.* = ... statements
    //   - statementsToRemove: Vue.compile/nextTick/set/delete/observable etc.

    const chainItems: ChainItem[] = []
    const protoAssigns: ProtoAssign[] = []
    const configAssigns: ConfigAssign[] = []
    const statementsToRemove: any[] = []
    const inlinePlugins: t.Identifier[] = [] // router/store/$store/$router from options

    // 4a. Extract router/store/$store/$router from the options object
    if (entryChain.optionsObj) {
      const obj = entryChain.optionsObj
      const newProps: (t.ObjectProperty | t.ObjectMethod | t.SpreadElement)[] = []
      for (const prop of obj.properties) {
        if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) {
          newProps.push(prop as any)
          continue
        }
        const key = t.isIdentifier((prop as any).key) ? (prop as any).key.name
                  : t.isStringLiteral((prop as any).key) ? (prop as any).key.value
                  : null
        if (!key) {
          newProps.push(prop as any)
          continue
        }
        if (key === 'router' || key === 'store' || key === '$store' || key === '$router') {
          // extract as plugin
          if (t.isObjectProperty(prop) && t.isIdentifier((prop as any).value)) {
            inlinePlugins.push((prop as any).value as t.Identifier)
            continue // remove from options
          }
        }
        if (key === 'el') {
          // .el is removed in Vue3 (mount target passed to .mount())
          continue
        }
        newProps.push(prop as any)
      }
      obj.properties = newProps as any
    }

    // 4b. Scan all top-level (or top-level-of-nested-block) statements for Vue.x() calls and config assignments
    traverse(file.scriptAst, {
      ExpressionStatement(path: any) {
        const expr = path.node.expression

        // Vue.x(args) call — chainable
        if (
          t.isCallExpression(expr) &&
          t.isMemberExpression(expr.callee) &&
          t.isIdentifier(expr.callee.object, { name: 'Vue' }) &&
          t.isIdentifier(expr.callee.property) &&
          !expr.callee.computed
        ) {
          const methodName = expr.callee.property.name
          if (
            methodName === 'use' ||
            methodName === 'component' ||
            methodName === 'directive' ||
            methodName === 'mixin' ||
            methodName === 'filter'
          ) {
            // vue.filter is removed in Vue 3 — handle separately
            if (methodName === 'filter') {
              statementsToRemove.push({ path, reason: 'filter-removed' })
              utils.markChanged('Vue.filter() removed (Vue3 has no filters)')
            } else {
              // iter-048: Vue.use(Router) / Vue.use(VueRouter) — vue-router 4 plugin
              //   已经删了 default import (import Router from 'vue-router' 不再存在),
              //   这里 VueRouter/Router 是未定义引用. 同文件通常已经有
              //   `import router from './router'` 并被 .use(router) 注册, 这个 install
              //   调用是重复且会运行时崩 (VueRouter is not defined).
              //   跳过它 + 标 review.
              if (methodName === 'use' && expr.arguments.length === 1 && t.isIdentifier(expr.arguments[0])) {
                const argName = (expr.arguments[0] as t.Identifier).name
                const binding = path.scope.getBinding(argName)
                if (argName === 'Router' || argName === 'VueRouter' || !binding) {
                  // 参数是 Router/VueRouter (vue-router 2/3 默认导入) → 跳过
                  statementsToRemove.push({ path, reason: 'router-install-skip' })
                  utils.manualReview(
                    `Vue.use(${argName}) 已被跳过 (vue-router 4 不再需要 install 步骤; 同文件通常已经 \`import router from './router'\` + .use(router), 重复注册会运行时崩).`,
                  )
                  return
                }
              }
              chainItems.push({
                method: methodName,
                args: expr.arguments.filter((a): a is t.Expression => t.isExpression(a)),
                start: path.node.start ?? 0,
              })
              statementsToRemove.push({ path, reason: 'chain' })
            }
            return
          }
          // Other Vue static methods (compile, nextTick, set, delete) — silent remove
          if (
            methodName === 'compile' ||
            methodName === 'nextTick' ||
            methodName === 'set' ||
            methodName === 'delete'
          ) {
            statementsToRemove.push({ path, reason: 'silently-remove' })
            return
          }
        }

        // Vue.prototype.$x = val OR Vue.config.* = val
        if (t.isAssignmentExpression(expr)) {
          const info = getVueChainAssignment(expr)
          if (info) {
            if (info.chain === 'prototype') {
              protoAssigns.push({
                prop: info.prop,
                value: info.value,
                start: path.node.start ?? 0,
              })
              statementsToRemove.push({ path, reason: 'prototype' })
            } else if (info.chain === 'config') {
              let kind: 'remove' | 'ignoredElements' | null = null
              if (info.prop === 'productionTip' || info.prop === 'devtools' || info.prop === 'silent') {
                kind = 'remove'
              } else if (info.prop === 'ignoredElements') {
                kind = 'ignoredElements'
              }
              if (kind) {
                configAssigns.push({
                  prop: info.prop,
                  value: info.value,
                  start: path.node.start ?? 0,
                  kind,
                })
                statementsToRemove.push({ path, reason: 'config' })
              }
            }
          }
          return
        }

        // Vue.version — MemberExpression statement (no call)
        if (
          t.isMemberExpression(expr) &&
          t.isIdentifier(expr.object, { name: 'Vue' }) &&
          t.isIdentifier(expr.property, { name: 'version' }) &&
          !expr.computed
        ) {
          statementsToRemove.push({ path, reason: 'silently-remove' })
        }
      },
    })

    // ----- 5. Transform the createApp() call to wrap options in defineComponent -----
    if (entryChain.optionsObj) {
      needsDefineComponentImport = true
      const wrapped = t.callExpression(
        t.identifier('defineComponent'),
        [entryChain.optionsObj],
      )
      const innerNode: t.CallExpression = entryChain.mountCall.node.callee.object as any
      innerNode.arguments[0] = wrapped
      innerNode.callee = t.identifier('createApp')
    }

    // ----- 6. Build the new createApp(...).use(...).use(...).mount('#app') chain -----
    // Order:
    //   1. inline plugins (router, store) from options (extracted first)
    //   2. chain items from Vue.x(args) statements — sorted by source order
    chainItems.sort((a, b) => a.start - b.start)

    const originalMountCall = entryChain.mountCall.node
    let currentCall: t.CallExpression = originalMountCall.callee.object as any

    // Append inline plugins (from options) as .use(...) chain
    for (const pluginIdent of inlinePlugins) {
      const useMember = t.memberExpression(currentCall, t.identifier('use'))
      currentCall = t.callExpression(useMember, [pluginIdent])
    }

    // Append chain items in source order
    for (const item of chainItems) {
      const member = t.memberExpression(currentCall, t.identifier(item.method))
      currentCall = t.callExpression(member, item.args)
    }

    // Finally .mount('#app')
    const mountArg = (originalMountCall.arguments[0] as t.StringLiteral).value
    const mountMember = t.memberExpression(currentCall, t.identifier('mount'))
    const newMountCall = t.callExpression(mountMember, [t.stringLiteral(mountArg)])

    // Replace the original $mount call with the new chain
    entryChain.mountCall.replaceWith(newMountCall)
    changed = true

    // ----- 7. Insert app.config.globalProperties.$x = val statements BEFORE .mount() -----
    // We need to insert these as separate ExpressionStatements in the same block as the
    // createApp() call. The simplest way: insert them as siblings of the createApp() statement
    // BEFORE it, so they execute before .mount() is called.

    if (protoAssigns.length > 0) {
      // Sort by source order
      protoAssigns.sort((a, b) => a.start - b.start)
      // Find the statement that contains the newMountCall
      const mountPath = entryChain.mountCall // path of the original $mount call (already replaced)
      // After replaceWith, the new mountCall is a new node. Use the same path which now points to it.
      // We need the parent statement to insert siblings.
      const stmtPath = mountPath.findParent((p: any) =>
        p.isExpressionStatement() || p.isVariableDeclaration() || p.isExportDefaultDeclaration(),
      )
      if (stmtPath) {
        // Build the globalProperties assignments
        const appIdent = t.identifier('app')
        const configIdent = t.identifier('config')
        const globalPropsIdent = t.identifier('globalProperties')
        for (const assign of protoAssigns) {
          // app.config.globalProperties.$x = val
          const lhs = t.memberExpression(
            t.memberExpression(
              t.memberExpression(appIdent, configIdent, false),
              globalPropsIdent,
              false,
            ),
            t.identifier(assign.prop),
            false,
          )
          const stmt = t.expressionStatement(
            t.assignmentExpression('=', lhs, assign.value),
          )
          // Insert before the mount statement
          stmtPath.insertBefore(stmt)
          changed = true
        }
        utils.markChanged(`Vue.prototype.* → app.config.globalProperties.* (${protoAssigns.length} props)`)
      }
    }

    // ----- 8. Handle Vue.config.ignoredElements = [...] -----
    if (configAssigns.some(c => c.kind === 'ignoredElements')) {
      const mountPath = entryChain.mountCall
      const stmtPath = mountPath.findParent((p: any) =>
        p.isExpressionStatement() || p.isVariableDeclaration() || p.isExportDefaultDeclaration(),
      )
      if (stmtPath) {
        for (const assign of configAssigns) {
          if (assign.kind !== 'ignoredElements') continue
          // app.config.compilerOptions.isCustomElement = (tag) => [...].includes(tag)
          if (!t.isArrayExpression(assign.value)) {
            // If not an array, we can't auto-convert — review note
            utils.manualReview(
              `Vue.config.ignoredElements = ${_generateFn(assign.value).code} (非数组形式，需手动迁移到 app.config.compilerOptions.isCustomElement)`,
            )
            continue
          }
          const appIdent = t.identifier('app')
          const configIdent = t.identifier('config')
          const compilerOptsIdent = t.identifier('compilerOptions')
          const isCustomElementIdent = t.identifier('isCustomElement')
          const tagParam = t.identifier('tag')
          // (tag) => [...].includes(tag)
          const arrow = t.arrowFunctionExpression(
            [tagParam],
            t.callExpression(
              t.memberExpression(assign.value, t.identifier('includes'), false),
              [tagParam],
            ),
            false,
          )
          const lhs = t.memberExpression(
            t.memberExpression(
              t.memberExpression(appIdent, configIdent, false),
              compilerOptsIdent,
              false,
            ),
            isCustomElementIdent,
            false,
          )
          const stmt = t.expressionStatement(
            t.assignmentExpression('=', lhs, arrow),
          )
          stmtPath.insertBefore(stmt)
          changed = true
          utils.markChanged('Vue.config.ignoredElements → app.config.compilerOptions.isCustomElement')
        }
      }
    }

    // ----- 9. Now remove the original Vue.x() / Vue.config.* / Vue.prototype.* statements -----
    // (done in a single pass after all chain building, to avoid path invalidation)
    for (const item of statementsToRemove) {
      try {
        item.path.remove()
      } catch (e) {
        // path may have been replaced; ignore
      }
    }

    // ----- 10. ensure imports -----
    if (needsCreateAppImport) {
      ensureVueImport(file, ['createApp'])
    }
    if (needsDefineComponentImport) {
      ensureVueImport(file, ['defineComponent'])
    }

    if (changed) {
      const pluginCount = inlinePlugins.length + chainItems.length
      utils.markChanged(
        `[vue3-entry] entry chain → createApp().mount('${mountArg}') (${pluginCount} chained calls)`,
      )
    }
}

/**
 * P0-D: Handle the canonical Vue 2 entry pattern
 *   new Vue({el: '#app', router, store, template: '<App/>', components: {App}}).$mount('#app')
 * → const app = createApp(App)
 *     .use(router)
 *     .use(createPinia())    // auto-injected for Vuex → Pinia migration
 *     .use(ElementPlus)      // from `Vue.use(ElementUI)` (Element UI → Element Plus)
 *     // Element Plus icons: for-of loop
 *     .mount('#app')
 *
 * Or, when icons loop is required (multi-statement form, see `_handleVue2EntryShortcut`):
 *   const app = createApp(App)
 *   app.use(createPinia())
 *   app.use(router)
 *   app.use(ElementPlus)
 *   for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
 *     app.component(key, component)
 *   }
 *   app.mount('#app')
 *
 * Also:
 *   - `import App from './App'` → `import App from './App.vue'`
 *   - `import store from './store'` → `import { useStoreStore } from './store'`
 *   - Add `import { createPinia } from 'pinia'`
 *   - Add `import * as ElementPlusIconsVue from '@element-plus/icons-vue'`
 *     (when Element Plus / ElementUI is used)
 *   - Drop `import { defineComponent } from 'vue'` (no longer needed)
 */
function _handleVue2EntryShortcut(
  ctx: TransformContext,
  entryChain: any,
  appComponent: t.Identifier,
  appTag: string | null,
) {
  const { file, utils } = ctx

  // ----- A. Collect state from the existing options -----
  const inlinePlugins: { ident: t.Identifier; kind: 'router' | 'store' | '$store' | '$router' }[] = []
  let hasPinia = false
  const remainingProps: any[] = []

  if (entryChain.optionsObj) {
    for (const prop of entryChain.optionsObj.properties) {
      if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) {
        remainingProps.push(prop)
        continue
      }
      const key = t.isIdentifier((prop as any).key) ? (prop as any).key.name
                : t.isStringLiteral((prop as any).key) ? (prop as any).key.value
                : null
      if (!key) {
        remainingProps.push(prop)
        continue
      }
      if (key === 'router' || key === 'store' || key === '$store' || key === '$router') {
        if (t.isObjectProperty(prop) && t.isIdentifier((prop as any).value)) {
          const kind: any = key
          inlinePlugins.push({ ident: (prop as any).value, kind })
          if (key === 'store') {
            // We assume Vuex store → Pinia. The vuex-pinia plugin
            // (also priority 9) has already converted `store/index.js`
            // to `export const useStoreStore = defineStore(...)`.
            hasPinia = true
          }
          continue
        }
      }
      if (key === 'el' || key === 'template' || key === 'components') {
        // removed in Vue 3 (mount target moves to .mount(), template runs in <template> of App.vue,
        // and components registration is now done via app.component / createApp)
        continue
      }
      remainingProps.push(prop)
    }
    // NOTE: keep the (possibly empty) options object inside defineComponent(...) so other props
    // (data, methods, etc.) are still preserved. This is the same behavior as the existing code path.
    entryChain.optionsObj.properties = remainingProps
  }

  // ----- B. Scan all top-level statements for Vue.x() calls and config assignments -----
  const chainItems: ChainItem[] = []
  const protoAssigns: ProtoAssign[] = []
  const configAssigns: ConfigAssign[] = []
  const statementsToRemove: any[] = []
  let hasElementPlus = false

  traverse(file.scriptAst, {
    ExpressionStatement(path: any) {
      const expr = path.node.expression

      // Vue.x(args) call — chainable
      if (
        t.isCallExpression(expr) &&
        t.isMemberExpression(expr.callee) &&
        t.isIdentifier(expr.callee.object, { name: 'Vue' }) &&
        t.isIdentifier(expr.callee.property) &&
        !expr.callee.computed
      ) {
        const methodName = expr.callee.property.name
        if (
          methodName === 'use' ||
          methodName === 'component' ||
          methodName === 'directive' ||
          methodName === 'mixin' ||
          methodName === 'filter'
        ) {
          if (methodName === 'filter') {
            statementsToRemove.push({ path, reason: 'filter-removed' })
            utils.markChanged('Vue.filter() removed (Vue3 has no filters)')
          } else {
            chainItems.push({
              method: methodName,
              args: expr.arguments.filter((a): a is t.Expression => t.isExpression(a)),
              start: path.node.start ?? 0,
            })
            // detect Element Plus / ElementUI
            if (
              methodName === 'use' &&
              expr.arguments[0] &&
              t.isIdentifier(expr.arguments[0]) &&
              (expr.arguments[0].name === 'ElementPlus' ||
                expr.arguments[0].name === 'ElementUI')
            ) {
              hasElementPlus = true
            }
            statementsToRemove.push({ path, reason: 'chain' })
          }
          return
        }
        if (
          methodName === 'compile' ||
          methodName === 'nextTick' ||
          methodName === 'set' ||
          methodName === 'delete'
        ) {
          statementsToRemove.push({ path, reason: 'silently-remove' })
          return
        }
      }

      if (t.isAssignmentExpression(expr)) {
        const info = getVueChainAssignment(expr)
        if (info) {
          if (info.chain === 'prototype') {
            protoAssigns.push({
              prop: info.prop,
              value: info.value,
              start: path.node.start ?? 0,
            })
            statementsToRemove.push({ path, reason: 'prototype' })
          } else if (info.chain === 'config') {
            let kind: 'remove' | 'ignoredElements' | null = null
            if (info.prop === 'productionTip' || info.prop === 'devtools' || info.prop === 'silent') {
              kind = 'remove'
            } else if (info.prop === 'ignoredElements') {
              kind = 'ignoredElements'
            }
            if (kind) {
              configAssigns.push({
                prop: info.prop,
                value: info.value,
                start: path.node.start ?? 0,
                kind,
              })
              statementsToRemove.push({ path, reason: 'config' })
            }
          }
        }
        return
      }

      if (
        t.isMemberExpression(expr) &&
        t.isIdentifier(expr.object, { name: 'Vue' }) &&
        t.isIdentifier(expr.property, { name: 'version' }) &&
        !expr.computed
      ) {
        statementsToRemove.push({ path, reason: 'silently-remove' })
      }
    },
  })

  // ----- C. Build the new multi-statement form -----
  chainItems.sort((a, b) => a.start - b.start)

  const originalMountCall = entryChain.mountCall.node
  const mountArg = (originalMountCall.arguments[0] as t.StringLiteral).value
  const appIdent = t.identifier('app')
  const newStmts: t.Statement[] = []

  // 1) const app = createApp(App)
  newStmts.push(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        appIdent,
        t.callExpression(t.identifier('createApp'), [appComponent]),
      ),
    ]),
  )

  // 2) app.use(createPinia()) — must come BEFORE other stores/router (Pinia needs to be installed first)
  if (hasPinia) {
    newStmts.push(
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(appIdent, t.identifier('use')),
          [t.callExpression(t.identifier('createPinia'), [])],
        ),
      ),
    )
  }

  // 3) app.use(router) / app.use(store) — inline plugins from options (in source order, then by plugin kind)
  // Stable order: router first, then store (common pattern)
  for (const plugin of inlinePlugins) {
    if (plugin.kind === 'router' || plugin.kind === '$router') {
      newStmts.push(
        t.expressionStatement(
          t.callExpression(
            t.memberExpression(appIdent, t.identifier('use')),
            [plugin.ident],
          ),
        ),
      )
    }
  }
  // Note: store's plugin instance is replaced by `createPinia()` above; the original `store` import
  // is rewritten to `useStoreStore` for use in components (see step F). We don't reference it here.

  // 4) app.use(...) / app.component(...) / app.directive(...) — chain items in source order
  for (const item of chainItems) {
    newStmts.push(
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(appIdent, t.identifier(item.method)),
          item.args,
        ),
      ),
    )
  }

  // 5) Element Plus icons — for-of loop registering all icons
  if (hasElementPlus) {
    // for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    //   app.component(key, component)
    // }
    const keyIdent = t.identifier('key')
    const compIdent = t.identifier('component')
    const iconsIdent = t.identifier('ElementPlusIconsVue')
    const objectEntriesIdent = t.identifier('entries')
    const objectIdent = t.identifier('Object')

    const iterCall = t.callExpression(
      t.memberExpression(objectIdent, objectEntriesIdent, false),
      [iconsIdent],
    )

    const bodyStmt = t.expressionStatement(
      t.callExpression(
        t.memberExpression(appIdent, t.identifier('component')),
        [keyIdent, compIdent],
      ),
    )

    // for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    //   app.component(key, component)
    // }
    // NOTE: for-of's VariableDeclarator must NOT have an `init` (that's only for plain `for (...)`).
    const forOfStmt = t.forOfStatement(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          t.arrayPattern([keyIdent, compIdent]),
          // no init — `right` of the for-of statement is the iterable
        ),
      ]),
      iterCall,
      t.blockStatement([bodyStmt]),
    )
    newStmts.push(forOfStmt)
  }

  // 6) app.mount('#app')
  newStmts.push(
    t.expressionStatement(
      t.callExpression(
        t.memberExpression(appIdent, t.identifier('mount')),
        [t.stringLiteral(mountArg)],
      ),
    ),
  )

  // 7) app.config.globalProperties.$x = val (prototype assignments)
  if (protoAssigns.length > 0) {
    protoAssigns.sort((a, b) => a.start - b.start)
    const configIdent = t.identifier('config')
    const globalPropsIdent = t.identifier('globalProperties')
    for (const assign of protoAssigns) {
      const lhs = t.memberExpression(
        t.memberExpression(
          t.memberExpression(appIdent, configIdent, false),
          globalPropsIdent,
          false,
        ),
        t.identifier(assign.prop),
        false,
      )
      newStmts.push(
        t.expressionStatement(
          t.assignmentExpression('=', lhs, assign.value),
        ),
      )
    }
    utils.markChanged(`Vue.prototype.* → app.config.globalProperties.* (${protoAssigns.length} props)`)
  }

  // 8) app.config.compilerOptions.isCustomElement (ignoredElements)
  for (const assign of configAssigns) {
    if (assign.kind !== 'ignoredElements') continue
    if (!t.isArrayExpression(assign.value)) {
      utils.manualReview(
        `Vue.config.ignoredElements = ${_generateFn(assign.value).code} (非数组形式，需手动迁移到 app.config.compilerOptions.isCustomElement)`,
      )
      continue
    }
    const configIdent = t.identifier('config')
    const compilerOptsIdent = t.identifier('compilerOptions')
    const isCustomElementIdent = t.identifier('isCustomElement')
    const tagParam = t.identifier('tag')
    const arrow = t.arrowFunctionExpression(
      [tagParam],
      t.callExpression(
        t.memberExpression(assign.value, t.identifier('includes'), false),
        [tagParam],
      ),
      false,
    )
    const lhs = t.memberExpression(
      t.memberExpression(
        t.memberExpression(appIdent, configIdent, false),
        compilerOptsIdent,
        false,
      ),
      isCustomElementIdent,
      false,
    )
    newStmts.push(
      t.expressionStatement(
        t.assignmentExpression('=', lhs, arrow),
      ),
    )
    utils.markChanged('Vue.config.ignoredElements → app.config.compilerOptions.isCustomElement')
  }

  // ----- D. Replace the original mount statement -----
  const mountPath = entryChain.mountCall
  const stmtPath = mountPath.findParent((p: any) =>
    p.isExpressionStatement() || p.isVariableDeclaration() || p.isExportDefaultDeclaration(),
  )
  if (!stmtPath) {
    utils.manualReview('P0-D: 无法定位 createApp mount 所在 statement — 需要手动迁移')
    return
  }
  stmtPath.replaceWithMultiple(newStmts)

  // ----- E. Remove the original Vue.x() / Vue.config.* / Vue.prototype.* statements -----
  for (const item of statementsToRemove) {
    try {
      item.path.remove()
    } catch (e) {
      // path may have been replaced; ignore
    }
  }

  // ----- F. Update imports -----
  // 1) Drop `defineComponent` from `import { ..., defineComponent, ... } from 'vue'`
  //    (no longer used after the multi-statement form)
  _removeDefineComponentFromVueImport(file)

  // 2) `import App from './App'` → `import App from './App.vue'`
  _ensureVueExtensionOnAppImport(file, appComponent.name)

  // 3) `import store from './store'` → `import { useStoreStore } from './store'`
  if (hasPinia) {
    _rewriteStoreImportToPiniaStore(ctx, file)
  }

  // 4) Add `import { createPinia } from 'pinia'`
  if (hasPinia) {
    _ensurePiniaImport(file)
  }

  // 5) Add `import * as ElementPlusIconsVue from '@element-plus/icons-vue'`
  if (hasElementPlus) {
    _ensureElementPlusIconsImport(file)
  }

  // 6) Ensure `createApp` is imported from 'vue' (if not already)
  ensureVueImport(file, ['createApp'])

  utils.markChanged(
    `[vue3-entry/P0-D] Vue 2 entry shortcut → createApp(${appComponent.name}) (multi-statement form${
      hasElementPlus ? ', Element Plus icons registered' : ''
    }${hasPinia ? ', Pinia plugin' : ''})`,
  )
}

/**
 * Remove `defineComponent` from `import { ..., defineComponent, ... } from 'vue'`.
 * If no other specifiers remain, drop the entire import (import-cleaner would do it anyway,
 * but doing it here keeps things tidy and avoids spurious warnings).
 */
function _removeDefineComponentFromVueImport(file: any) {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return
  traverse(ast, {
    ImportDeclaration(path: any) {
      if (!t.isStringLiteral(path.node.source, { value: 'vue' })) return
      const before = path.node.specifiers.length
      path.node.specifiers = path.node.specifiers.filter(
        (s: any) => !(t.isImportSpecifier(s) && t.isIdentifier(s.imported, { name: 'defineComponent' })),
      )
      if (path.node.specifiers.length === 0 && before > 0) {
        path.remove()
      }
    },
  })
}

/**
 * Ensure `import App from './App'` is `import App from './App.vue'` (or '.ts'/'js' if explicit).
 * If App has no import declaration, this is a no-op.
 */
function _ensureVueExtensionOnAppImport(file: any, appLocalName: string) {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return
  traverse(ast, {
    ImportDeclaration(path: any) {
      // Find the default import whose local name == appLocalName
      for (const spec of path.node.specifiers) {
        if (
          t.isImportDefaultSpecifier(spec) &&
          t.isIdentifier(spec.local, { name: appLocalName })
        ) {
          // Found it — check the source
          const src: t.StringLiteral = path.node.source
          if (
            t.isStringLiteral(src) &&
            !/\.[a-zA-Z0-9]+$/.test(src.value) // no extension already
          ) {
            // Normalize trailing slash and append .vue
            let newValue = src.value.replace(/\/+$/, '')
            newValue = newValue + '.vue'
            src.value = newValue
            if (src.extra) {
              src.extra.raw = `'${newValue}'`
              src.extra.rawValue = newValue
            } else {
              src.raw = `'${newValue}'`
            }
          }
          return
        }
      }
    },
  })
}

/**
 * Rewrite `import store from './store'` (or './store/') to
 *   `import { useStoreStore } from './store'`
 * The local name (`store`) becomes the named export `useStoreStore` — this matches the
 * vuex-pinia plugin's export naming for `store/index.js`.
 *
 * The original local name `store` is no longer referenced after our extraction (it's not
 * a Vue plugin anymore — Pinia is registered via `createPinia()`). The named import
 * `useStoreStore` is preserved (even though it's not directly used in main.js) as a
 * documentation hint that the store exists; the import-cleaner will not remove it as long
 * as it's referenced somewhere. We add a no-op `void` reference to keep it alive.
 */
function _rewriteStoreImportToPiniaStore(ctx: any, file: any) {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return

  let rewritten = false
  traverse(ast, {
    ImportDeclaration(path: any) {
      // Skip if already a named import from a store path
      if (path.node.specifiers.some((s: any) => t.isImportSpecifier(s))) return

      // Find the default specifier whose source looks like a store path
      const src: t.StringLiteral = path.node.source
      if (!t.isStringLiteral(src)) return
      const srcVal = src.value
      if (!/(^|\/)store(\/.*)?(\.[a-zA-Z]+)?$/.test(srcVal)) return

      // Find the default specifier
      const defSpec = path.node.specifiers.find((s: any) => t.isImportDefaultSpecifier(s))
      if (!defSpec) return

      // Compute the Pinia store hook name from the import path
      // e.g., './store' → useStoreStore, './store/modules/user' → useUserStore
      // iter-046 P0-B fix: 用 vuex-pinia 写入的 main store export 名字, 避免 main.js
      // 里 import `useStoreStore` 但 store/index.js 实际 export `useAppStore` 错位.
      // 注意: vue3-entry priority=9 跟 vuex-pinia 一样, 取决于注册顺序 — 实际 vue3-entry
      // 先跑, 所以 mainExportName 通常还没设置. 默认 fallback 到 'useAppStore' (最常见的
      // 命名约定), 这跟 vuex-pinia 内部 fallback 一致, 避免 main.js / store 错位.
      const storeName = inferStoreNameFromImportPath(srcVal)
      const inferredExportName = 'use' + capitalize(storeName) + 'Store'
      const mainExportName = getMainStoreExportName(ctx, inferredExportName)
      // 如果 mainExportName 还是 'useStoreStore' (推断出来的通用名), 强制用 'useAppStore' (业务语义更明确)
      const exportName = mainExportName === 'useStoreStore' ? 'useAppStore' : mainExportName

      // Replace the default specifier with a named specifier
      const newSpec = t.importSpecifier(t.identifier(exportName), t.identifier(exportName))
      path.node.specifiers = [newSpec]

      // Normalize the source (strip trailing slash)
      if (srcVal.endsWith('/')) {
        const newValue = srcVal.replace(/\/+$/, '')
        src.value = newValue
        if (src.extra) {
          src.extra.raw = `'${newValue}'`
          src.extra.rawValue = newValue
        } else {
          src.raw = `'${newValue}'`
        }
      }
      rewritten = true
    },
  })

  // Add a no-op reference to keep the import alive (so import-cleaner doesn't drop it).
  // The hook is used by components via `useStoreStore()` in their <script setup>.
  if (rewritten) {
    // Find the program body
    traverse(ast, {
      Program(path: any) {
        // Add `void useStoreStore` at the end (top-level) to keep the binding referenced
        // (We can only know the export name AFTER the rewrite; do a second pass)
        let piniaHookName: string | null = null
        path.traverse({
          ImportDeclaration(p: any) {
            for (const s of p.node.specifiers) {
              if (t.isImportSpecifier(s) && t.isIdentifier(s.imported)) {
                if (/^use[A-Z]/.test(s.imported.name) && s.imported.name.endsWith('Store')) {
                  piniaHookName = s.imported.name
                  return
                }
              }
            }
          },
        })
        if (piniaHookName) {
          // Insert a comment + no-op reference at the end of the program
          const voidStmt = t.expressionStatement(
            t.unaryExpression('void', t.identifier(piniaHookName)),
          )
          // We don't add a leading comment here; the unused import is documented by the user
          // (they should remove this no-op once their components actually use the hook).
          path.pushContainer('body', voidStmt)
        }
      },
    })
  }
}

function inferStoreNameFromImportPath(importPath: string): string {
  // Strip leading ./ or /
  let p = importPath.replace(/^\.\//, '').replace(/^\//, '')
  // Strip trailing slash and extension
  p = p.replace(/\/+$/, '').replace(/\.(js|ts|mjs|cjs)$/, '')
  // Get the last segment
  const parts = p.split('/').filter(Boolean)
  if (parts.length === 0) return 'store'
  let last = parts[parts.length - 1]
  // If last segment is 'index', use the segment before it
  if (last === 'index' && parts.length >= 2) {
    last = parts[parts.length - 2]
  }
  return last
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Ensure `import { createPinia } from 'pinia'` is present.
 * Adds the named specifier to an existing `pinia` import or creates a new import.
 */
function _ensurePiniaImport(file: any) {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return
  let piniaImport = ast.program.body.find(
    (n: any) => t.isImportDeclaration(n) && t.isStringLiteral(n.source, { value: 'pinia' }),
  ) as t.ImportDeclaration | undefined
  if (piniaImport) {
    const existing = new Set<string>()
    for (const s of piniaImport.specifiers) {
      if (t.isImportSpecifier(s) && t.isIdentifier(s.imported)) {
        existing.add(s.imported.name)
      }
    }
    if (!existing.has('createPinia')) {
      piniaImport.specifiers.push(
        t.importSpecifier(t.identifier('createPinia'), t.identifier('createPinia')),
      )
    }
  } else {
    const newImport = t.importDeclaration(
      [t.importSpecifier(t.identifier('createPinia'), t.identifier('createPinia'))],
      t.stringLiteral('pinia'),
    )
    // Insert AFTER the last existing import (to keep imports grouped at top)
    const lastImportIdx = (() => {
      let idx = -1
      for (let i = 0; i < ast.program.body.length; i++) {
        if (t.isImportDeclaration(ast.program.body[i])) idx = i
      }
      return idx
    })()
    if (lastImportIdx >= 0) {
      ast.program.body.splice(lastImportIdx + 1, 0, newImport)
    } else {
      ast.program.body.unshift(newImport)
    }
  }
}

/**
 * Ensure `import * as ElementPlusIconsVue from '@element-plus/icons-vue'` is present.
 */
function _ensureElementPlusIconsImport(file: any) {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return
  const ICONS_PKG = '@element-plus/icons-vue'
  let iconsImport = ast.program.body.find(
    (n: any) => t.isImportDeclaration(n) && t.isStringLiteral(n.source, { value: ICONS_PKG }),
  ) as t.ImportDeclaration | undefined
  if (iconsImport) {
    // already imported (maybe named-imports from another plugin); leave it
    return
  }
  const newImport = t.importDeclaration(
    [t.importNamespaceSpecifier(t.identifier('ElementPlusIconsVue'))],
    t.stringLiteral(ICONS_PKG),
  )
  const lastImportIdx = (() => {
    let idx = -1
    for (let i = 0; i < ast.program.body.length; i++) {
      if (t.isImportDeclaration(ast.program.body[i])) idx = i
    }
    return idx
  })()
  if (lastImportIdx >= 0) {
    ast.program.body.splice(lastImportIdx + 1, 0, newImport)
  } else {
    ast.program.body.unshift(newImport)
  }
}

import { registerPlugin } from '@vue-migrate/core'
registerPlugin(plugin)
export default plugin
