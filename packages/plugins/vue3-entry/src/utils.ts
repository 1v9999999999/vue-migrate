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
