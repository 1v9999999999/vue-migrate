/**
 * 规则 E.1, E.2: import 路径 'element-ui' → 'element-plus'
 *
 * 处理：
 *   - `import ElementUI from 'element-ui'` → `import ElementPlus from 'element-plus'`
 *   - `import { Button, Form, Message } from 'element-ui'` → 同名 from 'element-plus'
 *   - `import 'element-ui/lib/theme-chalk/index.css'` → `import 'element-plus/dist/index.css'`
 *
 * 同时记录 import 的具名导出（Message/MessageBox/Notification/Loading），
 * 供后续 this.$message → ElMessage 转换时补 import。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

export interface ElementUIContext {
  /** 默认导入的本地名（ElementUI） */
  defaultLocalName?: string
  /** 具名导入的本地名（{ Message: 本地名 }） */
  namedImports: Map<string, string> // 原始名 → 本地名
  /** 是否引用了 css */
  hasCss: boolean
}

export const NEW_PKG = 'element-plus'
export const OLD_PKG = 'element-ui'

export function collectElementUIImports(ctx: TransformContext): ElementUIContext {
  const info: ElementUIContext = {
    namedImports: new Map(),
    hasCss: false,
  }

  if (!ctx.file.scriptAst) return info

  traverse(ctx.file.scriptAst, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      const src = node.source.value

      // 1. 主包：'element-ui'
      if (src === OLD_PKG) {
        // 改 source
        node.source.value = NEW_PKG
        if (node.source.extra) node.source.extra.raw = `'${NEW_PKG}'`
        else node.source.raw = `'${NEW_PKG}'`

        // 收集 default 名
        for (const spec of node.specifiers) {
          if (t.isImportDefaultSpecifier(spec)) {
            info.defaultLocalName = spec.local.name
          } else if (t.isImportSpecifier(spec)) {
            const imported = (spec.imported as t.Identifier).name
            const local = spec.local.name
            // Element Plus 把 Message/MessageBox/Notification/Loading 重命名为 ElMessage 等
            // 如果用户没显式用 alias (as)，自动加 'El' 前缀
            if (
              imported === local &&
              (imported === 'Message' ||
                imported === 'MessageBox' ||
                imported === 'Notification' ||
                imported === 'Loading')
            ) {
              const newName = `El${imported}`
              ;(spec.imported as t.Identifier).name = newName
              spec.local.name = newName
              info.namedImports.set(imported, newName)
            } else {
              info.namedImports.set(imported, local)
            }
          }
        }
        ctx.utils.markChanged(
          `element-ui import → element-plus (default=${info.defaultLocalName}, named=${[...info.namedImports.keys()].join(',')})`,
        )
      }

      // 2. CSS 路径：'element-ui/lib/theme-chalk/index.css' 或 'element-ui/lib/theme-default/index.css' → 'element-plus/dist/index.css'
      if (
        src === 'element-ui/lib/theme-chalk/index.css' ||
        src === 'element-ui/lib/theme-default/index.css'
      ) {
        node.source.value = 'element-plus/dist/index.css'
        if (node.source.extra) node.source.extra.raw = "'element-plus/dist/index.css'"
        else node.source.raw = "'element-plus/dist/index.css'"
        info.hasCss = true
        ctx.utils.markChanged('element-ui CSS path → element-plus/dist/index.css')
      }
    },
  })

  return info
}

/** Vue.use(ElementUI) → app.use(ElementPlus)，改 import 默认名 */
export function renameDefaultLocalName(
  ctx: TransformContext,
  oldName: string,
  newName: string,
): void {
  if (!ctx.file.scriptAst) return
  traverse(ctx.file.scriptAst, {
    Identifier(path: any) {
      if (path.node.name === oldName) {
        path.node.name = newName
        ctx.utils.markChanged(`rename ${oldName} → ${newName}`)
      }
    },
  })
}
