/**
 * vue3-entry plugin
 *
 * Migrate Vue2 entry / global config to Vue3 createApp chain.
 *
 * Handles:
 *  - Vue.observable(x) → reactive(x)
 *  - new Vue({...}).$mount('#app') → createApp(defineComponent({...})).mount('#app')
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
import * as t from '@babel/types'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import type { TransformPlugin, TransformContext } from '@vue-migrate/core'
import { isVueStaticMember, getVueChainAssignment, ensureVueImport } from './utils.js'

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
    const isEntryByContent =
      /\bnew\s+Vue\s*\(/.test(file.source) ||
      /\bcreateApp\s*\(/.test(file.source) ||
      /\.\$mount\s*\(/.test(file.source)
    const isEntry = isEntryByName || isEntryByContent

    if (!isEntry) return

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
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.property, { name: '$mount' }) &&
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
            inner.arguments[0] &&
            (t.isObjectExpression(inner.arguments[0]) ||
              t.isCallExpression(inner.arguments[0]))
          ) {
            // createApp(...) may already be there if vue2-compat ran
            entryChainRef.v = {
              mountCall: path,
              optionsArg: inner,
              optionsObj: t.isObjectExpression(inner.arguments[0]) ? inner.arguments[0] as t.ObjectExpression : null,
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
  },
}

import { registerPlugin } from '@vue-migrate/core'
registerPlugin(plugin)
export default plugin
