/**
 * Generic: 把 3rd-party 库的 default import 改 namespace import
 *
 * 适用场景：
 *   - screenfull@4 CJS → screenfull@6 ESM（虽然 v6 已 default ESM,
 *     但部分 Vite 模式下推荐 `import * as screenfull from 'screenfull'`）
 *   - 任何只有 CJS export 的库升 ESM 后的过渡
 *
 * 用法：
 *   { name: 'screenfull', localName: 'screenfull' }
 *
 * 注意：
 *   - 仅改 source 字符串完全匹配的 import
 *   - 仅当该 import 只有 default specifier 时改
 *   - 已有 namespace import / 已有 named import 不动
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

export interface DefaultToNamespaceRule {
  /** package 名, 用于 source.value 匹配 */
  name: string
  /** 在 import 中用的本地变量名（默认同 name） */
  localName?: string
  /** 改写说明 */
  reason: string
}

export function fixDefaultToNamespace(
  ctx: TransformContext,
  rules: DefaultToNamespaceRule[],
): { changed: boolean; hits: string[] } {
  if (!ctx.file.scriptAst) return { changed: false, hits: [] }
  let changed = false
  const hits: string[] = []

  const ruleByName = new Map(rules.map((r) => [r.name, r]))

  traverse(ctx.file.scriptAst, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      const pkg = node.source.value
      const rule = ruleByName.get(pkg)
      if (!rule) return

      // 跳过 sub-path (e.g. 'echarts/lib/...')
      if (pkg.includes('/')) return

      // 已经是 namespace: 不动
      const isNamespace = node.specifiers.some((s: any) => t.isImportNamespaceSpecifier(s))
      if (isNamespace) return

      // 已经是纯 named import: 不动
      const hasNamed = node.specifiers.some((s: any) => t.isImportSpecifier(s))
      if (hasNamed && !node.specifiers.some((s: any) => t.isImportDefaultSpecifier(s))) {
        return
      }

      // default import → namespace
      const defaultSpec = node.specifiers.find((s: any) => t.isImportDefaultSpecifier(s))
      if (!defaultSpec) return

      const localName = (defaultSpec as any).local?.name ?? rule.localName ?? rule.name
      node.specifiers = [
        t.importNamespaceSpecifier(t.identifier(localName)),
      ]
      changed = true
      hits.push(`${rule.name} → * as ${localName}`)
      ctx.utils.markChanged(`${rule.name}: default import → namespace import (${rule.reason})`)
    },
  })

  return { changed, hits }
}
