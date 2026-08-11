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
 *
 * 注意 (iter-104): 直接修改 file.scriptAst 不够, 因为 composition plugin
 * (priority 0, 先跑) 会设 file.useRawSource=true, codegen 直接输出
 * file.source 而忽略 scriptAst。所以这里要**同时**改 file.source 字符串。
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

  const file: any = ctx.file

  // iter-104: 同时修改 file.source 字符串 (composition 之后会优先用 file.source)
  if (file.source && typeof file.source === 'string' && file.source.includes(OLD_CSS)) {
    file.source = file.source.split(OLD_CSS).join(NEW_CSS)
    info.hasCss = true
  }

  // 同时改 AST, 让下游 plugin (如 import-cleaner) 重新 parse 时看到新路径
  if (file.scriptAst) {
    traverse(file.scriptAst, {
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
        }
      },
    })
  }

  if (info.hasCss) {
    ctx.utils.markChanged(`vxe-table CSS path: ${OLD_CSS} → ${NEW_CSS}`)
  }

  return info
}
