/**
 * vuedraggable v2 → v4 import 形式调整
 *
 * 背景:
 *   vuedraggable v2 默认导出整个组件 (Vue.extend),用法:
 *     import draggable from 'vuedraggable'
 *     export default { components: { draggable } }
 *   v4 改成 named export `draggable`,并需要 componentName 标记:
 *     import { draggable } from 'vuedraggable'
 *     export default { components: { draggable } }
 *     // 可选: 加上 componentName 标识 (v4 推荐)
 *     // export default { componentName: 'draggable', components: { draggable } }
 *
 * 改写:
 *   import draggable from 'vuedraggable'  →  import { draggable } from 'vuedraggable'
 *
 * 注意:
 *   - 仅当 source 是字面量 'vuedraggable' 时改
 *   - 已经 named import / namespace import 不动
 *   - default specifier 改 named specifier 即可,本地变量名保留为 draggable
 *     (用户代码里 components: { draggable } / <draggable> 不变)
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

export function fixVuedraggableImports(ctx: TransformContext): { changed: boolean } {
  if (!ctx.file.scriptAst) return { changed: false }
  let changed = false

  traverse(ctx.file.scriptAst, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      if (node.source.value !== 'vuedraggable') return

      // 已经是 named import: 不动
      const hasNamedOnly =
        node.specifiers.length > 0 &&
        node.specifiers.every((s: any) => t.isImportSpecifier(s))
      if (hasNamedOnly) return

      // 已经是 namespace: 不动
      const isNamespace = node.specifiers.some((s: any) =>
        t.isImportNamespaceSpecifier(s),
      )
      if (isNamespace) return

      // default import → named import { draggable }
      const defaultSpec = node.specifiers.find((s: any) =>
        t.isImportDefaultSpecifier(s),
      )
      if (!defaultSpec) return

      const localName = (defaultSpec as any).local?.name ?? 'draggable'

      // 重写: import { <localName> } from 'vuedraggable'
      node.specifiers = [
        t.importSpecifier(
          t.identifier(localName),
          t.identifier('draggable'),
        ),
      ]
      changed = true
      ctx.utils.markChanged(
        `vuedraggable v2 → v4: default import → named import { ${localName} } (v4 改 named export). 注意 componentName 推荐用 "${localName}"`,
      )
    },
  })

  return { changed }
}
