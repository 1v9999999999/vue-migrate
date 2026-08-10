/**
 * Shared utilities for vue3-entry plugin.
 */

import * as t from '@babel/types'
import _traverse from '@babel/traverse'
import type { Node } from '@babel/types'

// ESM-safe: babel traverse may have .default or not depending on entry
const _traverseObj: any = (_traverse as any)
const traverse = (_traverseObj.default || _traverseObj) as typeof _traverse

/**
 * Check if `node` is a member access of the form `Vue.<name>` (or `vue.<name>`).
 * Does NOT match `Vue.prototype.foo` or `Vue.config.foo` (those need extra matching).
 */
export function isVueStaticMember(node: t.CallExpression, name: string): boolean {
  if (!t.isMemberExpression(node.callee)) return false
  const m = node.callee
  if (!t.isIdentifier(m.object, { name: 'Vue' })) return false
  if (!t.isIdentifier(m.property, { name })) return false
  // must be `Vue.x(...)`, not `Vue.x.y(...)` — i.e. not computed, and property not member
  if (m.computed) return false
  return true
}

/**
 * Check if `node` is an assignment of the form `Vue.<chain>.<prop> = <value>`
 * where <chain> is `prototype` or `config` and <prop> is the last segment.
 * Returns the chain name and the property name if matched, else null.
 *
 * Matches:
 *   Vue.prototype.$x = ...
 *   Vue.config.productionTip = ...
 *   Vue.config.ignoredElements = ...
 */
export function getVueChainAssignment(
  node: t.AssignmentExpression,
): { chain: 'prototype' | 'config'; prop: string; value: t.Expression } | null {
  if (!t.isMemberExpression(node.left)) return null
  const outer = node.left
  if (!t.isIdentifier(outer.property)) return null
  if (outer.computed) return null
  const propName = outer.property.name

  if (!t.isMemberExpression(outer.object)) return null
  const inner = outer.object
  if (!t.isIdentifier(inner.object, { name: 'Vue' })) return null
  if (!t.isIdentifier(inner.property)) return null
  if (inner.computed) return null
  const chainName = inner.property.name
  if (chainName !== 'prototype' && chainName !== 'config') return null

  return { chain: chainName, prop: propName, value: node.right }
}

/**
 * Add `import { a, b, c } from 'vue'` to file if not already present.
 * Merges into existing `import ... from 'vue'` if any.
 */
export function ensureVueImport(file: { scriptAst?: Node | null }, names: string[]): void {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return

  let vueImport = ast.program.body.find(
    (n) => t.isImportDeclaration(n) && t.isStringLiteral(n.source, { value: 'vue' }),
  ) as t.ImportDeclaration | undefined

  if (vueImport) {
    const existing = new Set<string>()
    for (const s of vueImport.specifiers) {
      if (t.isImportSpecifier(s) && t.isIdentifier(s.imported)) {
        existing.add(s.imported.name)
      }
    }
    for (const name of names) {
      if (!existing.has(name)) {
        vueImport.specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)))
        existing.add(name)
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

/**
 * iter-039 (#15c): clean up orphan `import Vue from 'vue'`.
 *
 * After vue3-entry has converted all `Vue.use(...)` / `Vue.filter(...)` /
 * `Vue.config.*` / `new Vue({...})` etc., the local binding `Vue` may no
 * longer be referenced anywhere. In that case:
 *   1) If the `import Vue, { ... } from 'vue'` still has named specifiers,
 *      drop only the default `Vue` specifier.
 *   2) If it has no remaining specifiers, drop the whole import statement.
 *
 * This is conservative: if we cannot prove `Vue` is unused (e.g. dynamic
 * refs in template strings we can't trace), we leave the import alone.
 */
export function removeVueDefaultImportIfUnused(
  file: { scriptAst?: Node | null },
  markChanged: (msg?: string) => void,
): void {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return

  // 1) Find `import Vue` default specifier from 'vue'
  let importPath: any = null
  let importSpec: t.ImportDefaultSpecifier | null = null
  traverse(ast, {
    ImportDeclaration(path: any) {
      if (!t.isStringLiteral(path.node.source, { value: 'vue' })) return
      const def = path.node.specifiers.find(
        (s: any) =>
          t.isImportDefaultSpecifier(s) && t.isIdentifier(s.local, { name: 'Vue' }),
      )
      if (def) {
        importPath = path
        importSpec = def as t.ImportDefaultSpecifier
      }
    },
  })
  if (!importPath || !importSpec) return

  // 2) Scan the whole AST (except the import itself) for any `Vue` reference
  let stillUsed = false
  traverse(ast, {
    ReferencedIdentifier(path: any) {
      if (stillUsed) return
      if (path.node.name !== 'Vue') return
      // Skip the import's own local binding
      if (path.parent === importSpec) return
      // Skip the import specifier subtree (binding identifier)
      if (path.parentPath?.isImportDefaultSpecifier && path.parentPath.node === importSpec) return
      // Walk up to confirm we're not in the import declaration itself
      let p: any = path.parentPath
      while (p) {
        if (p === importPath) return
        p = p.parentPath
      }
      stillUsed = true
      path.stop()
    },
  })
  if (stillUsed) return

  // 3) Drop the default specifier
  importPath.node.specifiers = importPath.node.specifiers.filter(
    (s: any) => s !== importSpec,
  ) as any

  // 4) If nothing left, drop the whole import
  if (importPath.node.specifiers.length === 0) {
    importPath.remove()
  }

  markChanged("removed orphan `import Vue from 'vue'` (Vue 标识符已无引用)")
}

/**
 * Find the closest ancestor that is a top-level statement (ExpressionStatement,
 * VariableDeclaration, IfStatement etc.) — basically the "line" this expression
 * lives on at the program level. Used to remove a whole statement.
 */
export function getTopLevelStatementPath(path: any): any | null {
  let p = path
  while (p) {
    if (p.isProgram()) return null
    if (
      p.isExpressionStatement() ||
      p.isVariableDeclaration() ||
      p.isIfStatement() ||
      p.isExportNamedDeclaration() ||
      p.isExportDefaultDeclaration() ||
      p.isFunctionDeclaration()
    ) {
      // ensure it's a direct child of Program (or BlockStatement of one)
      if (p.parentPath?.isProgram()) return p
    }
    p = p.parentPath
  }
  return null
}

// =====================================================================
// iter-044 B4 / B5: entry-file Vite/ESM adaptations
// =====================================================================

/**
 * iter-044 B4: `process.env.NODE_ENV` → `import.meta.env.MODE`
 *
 * Vite 不暴露 `process.env.NODE_ENV` (因为是 ESM,没有 process global);
 * 应用 `import.meta.env.MODE` ('development' | 'production' | 'test' | 自定义)
 * 或 `import.meta.env.PROD` (boolean). 这里统一改 `import.meta.env.MODE` — 与原值语义最接近。
 *
 * 同时处理 computed 形式: `process.env['NODE_ENV']`。
 *
 * @returns { count, changes } - 替换次数 + 描述列表
 */
export function rewriteProcessEnvNodeEnv(
  ast: t.File,
  markChanged: (msg: string) => void,
): { count: number; changes: string[] } {
  const changes: string[] = []
  let count = 0
  traverse(ast, {
    MemberExpression(path: any) {
      const node = path.node
      if (
        !t.isMemberExpression(node.object) ||
        !t.isIdentifier(node.object.object, { name: 'process' }) ||
        !t.isIdentifier(node.object.property, { name: 'env' })
      ) {
        return
      }
      const isNodeEnv =
        (!node.computed && t.isIdentifier(node.property, { name: 'NODE_ENV' })) ||
        (node.computed && t.isStringLiteral(node.property, { value: 'NODE_ENV' }))
      if (!isNodeEnv) return
      // 替换: process.env.NODE_ENV → import.meta.env.MODE
      path.replaceWith(
        t.memberExpression(
          t.memberExpression(
            t.memberExpression(t.identifier('import'), t.identifier('meta')),
            t.identifier('env'),
          ),
          t.identifier('MODE'),
        ),
      )
      count++
      changes.push('process.env.NODE_ENV → import.meta.env.MODE')
    },
  })
  if (count > 0) markChanged(`[B4] process.env.NODE_ENV → import.meta.env.MODE (${count} 处)`)
  return { count, changes }
}

/**
 * iter-044 B5: `require(x)` → `await import(x)`,并把外层 if-body 包成 async IIFE
 *
 * Vite 没有 CommonJS require。改写策略:
 *   1. `require(x)` → `await import(x)`
 *   2. 如果 require 在某个顶层 if-statement 的 body 内,把整个 body 包成
 *      `(async () => { ... })()` (IIFE),让 await 合法
 *   3. `require.context` / `require.x(...)` 复杂形式,标 manual review 不动
 *
 * @returns { count, reviews, changes } - 替换次数 + 标 review 的内容 + 描述
 */
export function rewriteRequireToImport(
  ast: t.File,
  markChanged: (msg: string) => void,
  manualReview: (msg: string) => void,
  generateCode: (node: t.Node) => string,
): { count: number; reviews: string[]; changes: string[] } {
  const reviews: string[] = []
  const changes: string[] = []
  let count = 0

  const requirePaths: any[] = []
  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      // 1) `require.context(...)` 形式 — callee 是 MemberExpression(Identifier('require'), Identifier('context'))
      if (
        t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object, { name: 'require' }) &&
        t.isIdentifier(node.callee.property)
      ) {
        const sub = node.callee.property.name
        manualReview(
          `[iter-044 B5] require.${sub}(...) 是 webpack 专属 API,Vite 没有等价品,请手动处理 (位置: ${generateCode(node)})`,
        )
        reviews.push(`require.${sub} at ${generateCode(node)}`)
        return
      }
      // 2) `require(x)` 简单形式
      if (
        t.isIdentifier(node.callee, { name: 'require' }) &&
        node.arguments.length === 1
      ) {
        const arg = node.arguments[0]
        if (t.isMemberExpression(arg)) {
          manualReview(
            `[iter-044 B5] require(${generateCode(arg)}) 形式复杂,未自动处理,请手动转为 import (位置: ${generateCode(node)})`,
          )
          reviews.push(`require.x at ${generateCode(node)}`)
          return
        }
        requirePaths.push(path)
      }
    },
  })

  // 替换 require(x) → await import(x)
  for (const p of requirePaths) {
    const arg = p.node.arguments[0]
    p.replaceWith(
      t.awaitExpression(
        t.callExpression(t.identifier('import'), [arg]),
      ),
    )
    count++
  }
  if (count > 0) {
    markChanged(`[B5] require() → await import() (${count} 处)`)
    changes.push(`require() → await import() (${count} 处)`)
  }

  // 把外层 if-body 包成 async IIFE
  const wrappedIfs = new Set<any>()
  for (const p of requirePaths) {
    let cur: any = p.parentPath
    while (cur && !cur.isProgram()) {
      if (cur.isIfStatement() && cur.parentPath?.isProgram()) {
        if (wrappedIfs.has(cur)) break
        wrappedIfs.add(cur)
        const body = cur.node.consequent
        if (t.isBlockStatement(body)) {
          const iife = t.callExpression(
            t.arrowFunctionExpression([], body, true),
            [],
          )
          cur.node.consequent = t.blockStatement([t.expressionStatement(iife)])
          markChanged('[B5] if-body 包含 require() → 用 async IIFE 包裹')
          changes.push('if-body 用 async IIFE 包裹')
        }
        break
      }
      cur = cur.parentPath
    }
  }

  return { count, reviews, changes }
}
