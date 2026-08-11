/**
 * @vue-migrate/plugin-vue2-compat
 *
 * 处理 Vue2 兼容性转换（最基础的一组规则）：
 *   1.1  new Vue({...}) → createApp(...).mount('#app') [注意：交给 entry 串行化]
 *   1.2  Vue.extend(x) → defineComponent(x)
 *   1.4  beforeDestroy → beforeUnmount
 *   1.5  destroyed → unmounted
 *   2.3  filters: {...} 选项 → 移除 + review（filter 函数已经在 vue3-directives 处理）
 *   2.7  this.$scopedSlots → this.$slots (部分场景) [已经在 vue3-template 处理]
 *   2.10 $on / $off / $once 事件总线 → review
 *   5.2  functional: true → 函数式组件（标 review，复杂）
 *   6.1  自定义指令 bind/inserted/unbind 改 beforeMount/mounted/unmount [在 vue3-directives]
 *   6.2  自定义指令 update/componentUpdated → updated [在 vue3-directives]
 *   6.4  Vue.compile / Vue.observable / Vue.set / Vue.delete 等 → review 或自动
 *
 * 注意：以下规则**不在**本插件里：
 *   - 入口链 Vue.use/Component/Directive/prototype/config → vue3-entry
 *   - 模板 slot/slot-scope/v-bind.sync → vue3-template
 *   - 模板 filter/keycode/v-model/keep-alive → vue3-directives
 *   - 指令生命周期 → vue3-directives
 *   - TS 类型补全 → vue3-types
 *   - ElementUI → elementui
 *
 * 本插件专注：
 *   - 全局范围内的 Vue.xxx() 静态调用识别（除了 entry 的）
 *   - this.$set / this.$delete 标记
 *   - filters 选项识别
 *   - functional: true 标记
 *   - 自定义事件总线 this.$on/$off 标记
 *   - beforeDestroy/destroyed（这里处理，entry 不重复处理）
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

const plugin: TransformPlugin = {
  name: 'vue2-compat',
  description:
    'Convert Vue.extend / new Vue / lifecycle hooks / filters option / functional component / this.$set / this.$delete / this.$on/$off / Vue.compile to Vue3 idioms',
  priority: 10,

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    if (!file.scriptAst)
    return

    let needsDefineComponent = false
    let needsCreateApp = false

    traverse(file.scriptAst, {
      // ========== 1.2 Vue.extend(x) → defineComponent(x) ==========
      CallExpression(path: any) {
        const node = path.node
        if (
          t.isMemberExpression(node.callee) &&
          t.isIdentifier(node.callee.object, { name: 'Vue' }) &&
          t.isIdentifier(node.callee.property)
        ) {
          const propName = node.callee.property.name

          // Vue.extend(...)
if (propName === 'extend') { node.callee = t.identifier('defineComponent')
            needsDefineComponent = true
            utils.markChanged('Vue.extend → defineComponent')
            return
          }

          // Vue.compile (...) → 移除（Vue3 不再全局可访问）
if (propName === 'compile') { utils.manualReview(
              'Vue.compile() 已移除（Vue3 编译只在构建时进行）。如需运行时模板编译，使用 @vue/compiler-dom 自行处理。',
            )
            return
          }

          // Vue.set / Vue.delete → 仍可用但建议用 reactive
          if (propName === 'set' || propName === 'delete') {
            utils.manualReview(
              `Vue.${propName}() 在 Vue3 已废弃。setup 外的响应式数据用 reactive()/ref()，setup 内直接赋值。`,
            )
            return
          }

          // Vue.observable(o) → reactive(o) [entry 里也有，这里也加一层防御]
          if (propName === 'observable') {
            // 用一个 IIFE 包 reactive？
            // 注意 reactive 是从 'vue' import
            if (node.arguments.length > 0) {
              node.callee = t.identifier('reactive')
              needsDefineComponent = false // 不需要 defineComponent，但下面 ensureImport 会处理
              utils.markChanged('Vue.observable → reactive')
              ;(ctx.utils as any)['__needsReactive'] = true
            }
            return
          }

          // Vue.version / Vue.config / Vue.nextTick / Vue.use / Vue.component / Vue.directive
          // 这些由 entry 处理，本插件不重复
        }
      },
      NewExpression(path: any) {
        const node = path.node
        if (
          t.isIdentifier(node.callee, { name: 'Vue' }) &&
          node.arguments.length === 1 &&
          t.isObjectExpression(node.arguments[0])
        ) {
          const optionsArg = node.arguments[0] as t.ObjectExpression
          const createAppCall = t.callExpression(t.identifier('createApp'), [
            t.callExpression(t.identifier('defineComponent'), [optionsArg]),
          ])
          // .mount('#app') 在父级有则保留
          // parent 是 MemberExpression (new Vue({...}).$mount),其 object 是 NewExpression (new Vue({...}))
          const parent = path.parent
          // 检测 el 选项 (iter-032) — 用于 new Vue({el: '#app'}) 简写模式
          const elPropIdx = optionsArg.properties.findIndex(
            (p: any) =>
              t.isObjectProperty(p) && t.isIdentifier((p as t.ObjectProperty).key, { name: 'el' }),
          )
          let elMountArg: t.StringLiteral | null = null
          let elRemoveIdx = -1
          if (elPropIdx >= 0) {
            const elNode = optionsArg.properties[elPropIdx] as t.ObjectProperty
            if (t.isStringLiteral(elNode.value)) {
              elMountArg = elNode.value
              elRemoveIdx = elPropIdx
            } else if (
              t.isTemplateLiteral(elNode.value) &&
              elNode.value.expressions.length === 0 &&
              elNode.value.quasis.length === 1
            ) {
              elMountArg = t.stringLiteral(elNode.value.quasis[0].value.cooked || '')
              elRemoveIdx = elPropIdx
            } else {
              // el 不是字符串字面量,加 review
              utils.manualReview(
                'new Vue({el: ...}) — el 不是字符串,无法自动转 .mount(),需手动处理',
              )
            }
          }

          if (
            t.isMemberExpression(parent) &&
            t.isNewExpression((parent as any).object) &&
            t.isIdentifier((parent as any).property, { name: '$mount' }) &&
            (parent as any).arguments &&
            (parent as any).arguments[0] &&
            t.isStringLiteral((parent as any).arguments[0])
          ) {
            // 整段替换为 createApp(...).mount('#app')
            // 如果同时有 el 选项,移除它(因为 $mount 会覆盖 el)
            if (elRemoveIdx >= 0) {
              optionsArg.properties.splice(elRemoveIdx, 1)
            }
            const mountCall = t.callExpression(
              t.memberExpression(createAppCall, t.identifier('mount')),
              [(parent as any).arguments[0]],
            )
            // 替换外层的 $mount 调用
            path.parentPath.replaceWith(mountCall)
            utils.markChanged('new Vue({...}).$mount() → createApp(...).mount()')
          } else if (elMountArg) {
            // iter-032: `new Vue({el: '#app'})` 简写模式
            // 移除 el,加 .mount('#app') chain
            optionsArg.properties.splice(elRemoveIdx, 1)
            const mountCall = t.callExpression(
              t.memberExpression(createAppCall, t.identifier('mount')),
              [elMountArg],
            )
            path.replaceWith(mountCall)
            utils.markChanged('new Vue({el}) → createApp().mount(el)')
          } else {
            // 仅替换 new Vue 部分
            path.replaceWith(createAppCall)
          }
          needsDefineComponent = true
          needsCreateApp = true
          utils.markChanged('new Vue → createApp')
        }
      },

      // ========== 1.4 / 1.5 beforeDestroy/destroyed → beforeUnmount/unmounted ==========
      // ========== 5.2 functional: true ==========
      ObjectMethod(path: any) {
        handleLifecycleHookRename(path.node, utils)
      },
      ObjectProperty(path: any) {
        // 1.4 / 1.5 兜底
        handleLifecycleHookRename(path.node, utils)
        // 5.2 functional: true
        const node = path.node
        if (
          t.isIdentifier(node.key, { name: 'functional' }) &&
          node.value &&
          (t.isBooleanLiteral(node.value, { value: true }) ||
            t.isIdentifier(node.value, { name: 'true' }))
        ) {
          utils.manualReview(
            'Vue2 functional 组件 → Vue3 函数式组件需重写为 () => h(...) 形式，组件 props/children 通过参数获取。请手动改写。',
          )
        }
      },

      // ========== 2.10 this.$on / this.$off / this.$once 事件总线 ==========
      MemberExpression(path: any) {
        const node = path.node
        if (
          t.isThisExpression(node.object) &&
          t.isIdentifier(node.property)
        ) {
          const propName = node.property.name
          if (propName === '$on' || propName === '$off' || propName === '$once') {
            // 只标记一次（CallExpression 是 $on(...) 调用）
            if (t.isCallExpression(path.parent) && path.parent.callee === node) {
              utils.manualReview(
                `this.${propName}() 事件总线 API 在 Vue3 中已移除。请使用 mitt / tiny-emitter 等第三方库。`,
              )
            }
          }
        }
      },
    })

    // 补 reactive import（如果需要）
    if ((ctx.utils as any)['__needsReactive']) {
      ensureVueImport(file, ['reactive'])
    }

    // 补 createApp / defineComponent
    if (needsDefineComponent || needsCreateApp) {
      const toAdd: string[] = []
      if (needsDefineComponent) toAdd.push('defineComponent')
      if (needsCreateApp) toAdd.push('createApp')
      ensureVueImport(file, toAdd)
    }

    // iter-110: sync AST → file.source (避免 useRawSource 模式下 AST 改动丢失)
    //   vue2-compat 改 beforeDestroy/destroyed hook, ensureVueImport 加 createApp import 等,
    //   这些都是 AST 改动. 后续 store-bridge / vue-router-v4 设 useRawSource=true 时会丢.
    if (file.scriptAst && file.changed) {
      try { (ctx as any).utils.syncScriptAstToSource() } catch (e: any) {
        ctx.log(`[vue2-compat] syncScriptAstToSource failed: ${e.message}`)
      }
    }
  },
}

function handleLifecycleHookRename(node: any, utils: any): void {
  if (!t.isObjectMethod(node) && !t.isObjectProperty(node))
  return
  if (!t.isIdentifier(node.key))
  return
  const name = node.key.name
  if (name === 'beforeDestroy') {
    node.key = t.identifier('beforeUnmount')
    utils.markChanged('beforeDestroy → beforeUnmount')
  } else if (name === 'destroyed') {
    node.key = t.identifier('unmounted')
    utils.markChanged('destroyed → unmounted')
  }
}

function ensureVueImport(file: any, names: string[]): void {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast))
  return
  if (names.length === 0)
  return

  let vueImport = ast.program.body.find(
    (n: any) =>
      t.isImportDeclaration(n) &&
      t.isStringLiteral(n.source, { value: 'vue' }),
  ) as t.ImportDeclaration | undefined

  if (vueImport) {
    const existing = new Set(
      vueImport.specifiers
        .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
        .map((s) => (s.imported as t.Identifier).name),
    )
    for (const name of names) {
      if (!existing.has(name)) {
        vueImport.specifiers.push(
          t.importSpecifier(t.identifier(name), t.identifier(name)),
        )
      }
    }
  } else {
    const newImport = t.importDeclaration(
      names.map((n) => t.importSpecifier(t.identifier(n), t.identifier(n))),
      t.stringLiteral('vue'),
    )
    ast.program.body.unshift(newImport)
  }
}

registerPlugin(plugin)
export default plugin
