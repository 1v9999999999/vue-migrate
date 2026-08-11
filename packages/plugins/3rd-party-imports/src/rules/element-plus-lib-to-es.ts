/**
 * iter-048: element-plus v2 把 `lib/` 子路径移到了 `es/`.
 * 旧代码 `import enLang from 'element-plus/lib/locale/lang/en'` 在 v2 找不到。
 *
 * 策略: 把所有 `element-plus/lib/...` import path 改成 `element-plus/es/...`,
 * 同时把 default import 改成 named import (因为 es 下的 lang 文件 export `en` / `zhCn` 等 named)。
 *
 * 命名规则: 文件名转 camelCase 作为 named import.
 *   e.g. `element-plus/es/locale/lang/en` → `import { en } from '...'`
 *        `element-plus/es/locale/lang/zh-cn` → `import { zhCn } from '...'`
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

/** 文件名 → camelCase 命名. e.g. 'en' → 'en', 'zh-cn' → 'zhCn', 'zh-CN' → 'zhCn' */
function fileBaseToExportName(base: string): string {
  const parts = base.split('-').filter(Boolean)
  if (parts.length === 0) return base
  return parts[0] + parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

export function fixElementPlusLibToEs(ctx: TransformContext): { changed: boolean; hits: string[] } {
  if (!ctx.file.scriptAst) return { changed: false, hits: [] }
  let changed = false
  const hits: string[] = []

  traverse(ctx.file.scriptAst, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      const src = node.source.value
      // 只处理 element-plus/lib/... (v1 路径)
      if (!src.startsWith('element-plus/lib/')) return

      // 改 path
      const newSrc = 'element-plus/es/' + src.substring('element-plus/lib/'.length)
      path.node.source = t.stringLiteral(newSrc)
      hits.push(`${src} → ${newSrc}`)

      // 处理 default import: 改成 named import
      // e.g. `import enLang from 'element-plus/lib/locale/lang/en'` → `import { en as enLang } from '...'`
      const defaultSpec = node.specifiers.find((s: any) => t.isImportDefaultSpecifier(s))
      if (defaultSpec) {
        const localName = (defaultSpec as any).local?.name ?? 'enLang'
        // 推断 named export: 取 path 最后一段
        const pathParts = newSrc.split('/')
        const fileName = pathParts[pathParts.length - 1].replace(/\.js$/, '')
        const exportName = fileBaseToExportName(fileName)

        const otherSpecs = node.specifiers.filter((s: any) => s !== defaultSpec)
        const newSpec: t.ImportSpecifier = t.importSpecifier(
          t.identifier(exportName),
          t.identifier(localName),
        )
        path.node.specifiers = [newSpec, ...otherSpecs]
        hits.push(`default → { ${exportName} as ${localName} }`)
        ctx.utils.markChanged(
          `${src} → ${newSrc}, default import → named { ${exportName} as ${localName} } (element-plus v2 已把 lib/ 移到 es/)`,
        )
      } else {
        ctx.utils.markChanged(`${src} → ${newSrc} (element-plus v2 已把 lib/ 移到 es/)`)
      }
      changed = true
    },
  })

  return { changed, hits }
}
