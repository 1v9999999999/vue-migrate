/**
 * 规则 VT.1: import 路径调整
 *
 * vxe-table 3 (Vue 2) → vxe-table 4 (Vue 3) 的 import 路径差异：
 *   - CSS 路径: 'vxe-table/lib/index.css'  → 'vxe-table/lib/style.css'
 *
 * 主包 import 'vxe-table' 保持不变（同名包）。
 *
 * 默认导入名建议改成 VxeUITable 以符合 v4 习惯
 * (但插件不强制改 — `Vue.use(VXETable)` 的代码 v4 仍能跑)。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

const OLD_CSS = 'vxe-table/lib/index.css'
const NEW_CSS = 'vxe-table/lib/style.css'

export interface VxeTableContext {
  /** 主包 'vxe-table' 是否被引用（v3 + v4 都有，但 v4 仍可能用 VXETable 这个名） */
  hasMainImport: boolean
  /** CSS 是否需要替换 */
  hasCss: boolean
}

export function collectVxeTableImports(ctx: TransformContext): VxeTableContext {
  const info: VxeTableContext = {
    hasMainImport: false,
    hasCss: false,
  }

  if (!ctx.file.scriptAst) return info

  traverse(ctx.file.scriptAst, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      const src = node.source.value

      if (src === 'vxe-table') {
        info.hasMainImport = true
        // 不强制改 source（同名），但记录下来供后续规则判断
      } else if (src === OLD_CSS) {
        node.source.value = NEW_CSS
        if (node.source.extra) node.source.extra.raw = `'${NEW_CSS}'`
        else node.source.raw = `'${NEW_CSS}'`
        info.hasCss = true
        ctx.utils.markChanged(`vxe-table CSS path: ${OLD_CSS} → ${NEW_CSS}`)
      }
    },
  })

  return info
}
