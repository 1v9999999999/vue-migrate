/**
 * 规则：自定义指令 install 函数重写 + window.Vue 守卫清理
 *
 * Vue2 → Vue3 指令 install 形式变化：
 *
 *   Vue2:
 *     const install = function(Vue) {
 *       Vue.directive('name', { ... })
 *     }
 *     // 或
 *     vueSticky.install = Vue => {
 *       Vue.directive('sticky', { ... })
 *     }
 *     if (window.Vue) {
 *       window.Vue.use(install)
 *     }
 *     if (window.Vue) {
 *       window.xxx = xxx
 *       Vue.use(install)
 *     }
 *
 *   Vue3:
 *     export default {
 *       install(app) {
 *         app.directive('name', { ... })
 *       }
 *     }
 *     // main.js: app.use(plugin)
 *
 * 实现策略（保守）：
 *   1. 检测 `const install = function(Vue) { Vue.directive(...) }` 或箭头形式
 *      → 把参数 Vue 改名为 app，函数体内 Vue.directive → app.directive
 *   2. 检测 `xxx.install = Vue => { Vue.directive(...) }` 赋值属性形式
 *      → 同上
 *   3. 检测 `if (window.Vue) { ... Vue.use(install) ... }` 守卫：整段删
 *   4. 顶层独立的 `Vue.use(install)` 调用：删（因为 export default 已有 install）
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse

/**
 * 判断一个函数是否"看起来像"Vue2 install：参数 Vue + 函数体里有 Vue.xxx() 调用。
 * 命中方法：directive / component / filter / mixin / use 之一即可。
 */
function isVue2InstallLike(fn: t.Function): boolean {
  if (fn.params.length !== 1) return false
  const param = fn.params[0]
  if (!t.isIdentifier(param)) return false
  if (!t.isBlockStatement(fn.body)) return false
  // 在函数体里找 Vue.xxx 调用
  const vueCalls: t.CallExpression[] = []
  collectCalls(fn.body, vueCalls)
  return vueCalls.some((c) => {
    if (
      t.isMemberExpression(c.callee) &&
      t.isIdentifier(c.callee.object, { name: 'Vue' }) &&
      t.isIdentifier(c.callee.property)
    ) {
      return ['directive', 'component', 'filter', 'mixin', 'use'].includes(
        c.callee.property.name,
      )
    }
    return false
  })
}

/** 收集节点下所有 CallExpression（深度优先，不进入 nested fn body 以免误判） */
function collectCalls(node: t.Node, out: t.CallExpression[]): void {
  if (t.isCallExpression(node)) {
    out.push(node)
  }
  // 跳过嵌套的 function（它们的 Vue.xxx 跟外层 install 无关）
  if (t.isFunction(node) || t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return
  }
  for (const key of t.VISITOR_KEYS[node.type] || []) {
    const child = (node as any)[key]
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && c.type) collectCalls(c, out)
      }
    } else if (child && typeof child === 'object' && child.type) {
      collectCalls(child, out)
    }
  }
}

/** 把函数体里的 Vue.xxx(...) 重写为 app.xxx(...) */
function rewriteVueCallsInBody(body: t.BlockStatement): void {
  const calls: t.CallExpression[] = []
  collectCalls(body, calls)
  for (const c of calls) {
    if (
      t.isMemberExpression(c.callee) &&
      t.isIdentifier(c.callee.object, { name: 'Vue' }) &&
      t.isIdentifier(c.callee.property) &&
      ['directive', 'component', 'filter', 'mixin', 'use'].includes(
        c.callee.property.name,
      )
    ) {
      c.callee.object = t.identifier('app')
    }
  }
}

function rewriteInstallFn(fn: t.Function): void {
  // 重命名参数 Vue → app
  const param = fn.params[0] as t.Identifier
  param.name = 'app'
  // 重写函数体内的 Vue.xxx(...) 调用
  if (t.isBlockStatement(fn.body)) {
    rewriteVueCallsInBody(fn.body)
  }
}

export function applyDirectiveInstallRewrite(file: any, utils: any): void {
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  // ============ 1) `const install = function(Vue) { ... }` / 箭头 ============
  traverse(ast, {
    VariableDeclarator(path: any) {
      const node = path.node
      const init = node.init
      if (!init) return
      if (!t.isIdentifier(node.id, { name: 'install' })) return
      if (!t.isFunction(init)) return
      if (!isVue2InstallLike(init)) return

      rewriteInstallFn(init)
      utils.markChanged('install: Vue → app (renamed parameter, replaced calls)')
    },
  })

  // ============ 2) `xxx.install = Vue => { ... }` 赋值属性形式 ============
  traverse(ast, {
    AssignmentExpression(path: any) {
      const node = path.node
      if (!t.isMemberExpression(node.left)) return
      if (!t.isIdentifier(node.left.property, { name: 'install' })) return
      if (!t.isFunction(node.right)) return
      if (!isVue2InstallLike(node.right)) return

      rewriteInstallFn(node.right)
      utils.markChanged('xxx.install = Vue => {...} → xxx.install = app => {...}')
    },
  })

  // ============ 3) `if (window.Vue) { ... Vue.use(install) ... }` 守卫删除 ============
  traverse(ast, {
    IfStatement(path: any) {
      const node = path.node
      if (!t.isMemberExpression(node.test)) return
      if (!t.isIdentifier(node.test.object, { name: 'window' })) return
      if (!t.isIdentifier(node.test.property, { name: 'Vue' })) return
      if (!t.isBlockStatement(node.consequent)) return

      // 检查 consequent 体内是否有 Vue.use(...) 或 window.Vue.use(...)
      const calls: t.CallExpression[] = []
      collectCalls(node.consequent, calls)
      const hasUse = calls.some((c) => {
        if (!t.isMemberExpression(c.callee)) return false
        if (!t.isIdentifier(c.callee.property, { name: 'use' })) return false
        // Vue.use 或 window.Vue.use
        if (t.isIdentifier(c.callee.object, { name: 'Vue' })) return true
        if (
          t.isMemberExpression(c.callee.object) &&
          t.isIdentifier(c.callee.object.object, { name: 'window' }) &&
          t.isIdentifier(c.callee.object.property, { name: 'Vue' })
        ) {
          return true
        }
        return false
      })

      if (!hasUse) return

      // 检查有没有 window.xxx = xxx 副作用（典型如 window.clipboard = Clipboard）
      const mutations: t.AssignmentExpression[] = []
      collectAssigns(node.consequent, mutations)
      const hasWindowMutation = mutations.some((m) => {
        return (
          t.isMemberExpression(m.left) &&
          t.isIdentifier(m.left.object, { name: 'window' })
        )
      })

      if (hasWindowMutation) {
        utils.manualReview(
          'window.xxx = xxx + Vue.use(install) 守卫已删除。Vue3 下若 window.xxx 全局赋值仍需保留，需手动重写。',
        )
      }
      path.remove()
      utils.markChanged('window.Vue guard removed')
    },
  })

  // ============ 4) 顶层独立的 `Vue.use(install)` 删除 ============
  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      if (
        !t.isMemberExpression(node.callee) ||
        !t.isIdentifier(node.callee.object, { name: 'Vue' }) ||
        !t.isIdentifier(node.callee.property, { name: 'use' })
      ) {
        return
      }
      // 必须在 ExpressionStatement 内
      if (!t.isExpressionStatement(path.parent)) return
      // 必须在 Program 顶层
      if (!path.parentPath?.parentPath?.isProgram()) return

      // 检查 export default 里是否有 install 字段
      const hasExportInstall = findExportDefaultInstall(ast)
      if (!hasExportInstall) return

      path.parentPath.remove()
      utils.markChanged('standalone Vue.use(install) removed (export default has install)')
    },
  })
}

/** 收集所有 AssignmentExpression */
function collectAssigns(node: t.Node, out: t.AssignmentExpression[]): void {
  if (t.isAssignmentExpression(node)) {
    out.push(node)
  }
  if (t.isFunction(node) || t.isFunctionExpression(node) || t.isArrowFunctionExpression(node)) {
    return
  }
  for (const key of t.VISITOR_KEYS[node.type] || []) {
    const child = (node as any)[key]
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && c.type) collectAssigns(c, out)
      }
    } else if (child && typeof child === 'object' && child.type) {
      collectAssigns(child, out)
    }
  }
}

/** 检查 `export default { ..., install, ... }` 是否存在 */
function findExportDefaultInstall(ast: t.File): boolean {
  let found = false
  traverse(ast, {
    ExportDefaultDeclaration(p: any) {
      const d = p.node.declaration
      if (!t.isObjectExpression(d)) return
      if (
        d.properties.some(
          (prop: any) =>
            t.isObjectProperty(prop) &&
            t.isIdentifier(prop.key, { name: 'install' }),
        )
      ) {
        found = true
      }
    },
  })
  return found
}
