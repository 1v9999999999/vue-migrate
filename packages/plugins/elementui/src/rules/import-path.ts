/**
 * 规则 E.1, E.2, E.x: import 路径 'element-ui' → 'element-plus'
 *
 * 处理：
 *   - `import ElementUI from 'element-ui'` → `import ElementPlus from 'element-plus'`
 *   - `import { Button, Form, Message } from 'element-ui'` → 同名 from 'element-plus'
 *   - `import 'element-ui/lib/theme-chalk/index.css'` → `import 'element-plus/dist/index.css'`
 *   - `import enLang from 'element-ui/lib/locale/lang/en'` → `from 'element-plus/lib/locale/lang/en'` (iter-044 B2)
 *   - `import { addResizeListener } from 'element-ui/src/utils/resize-event'` → `from 'element-plus/lib/utils/resize-event'` (iter-044 B7)
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
  /** iter-044 B2: 是否引用了 locale 子路径 */
  hasLocale: boolean
  /** iter-044 B2: 检测到的 locale 路径 (e.g. 'element-ui/lib/locale/lang/en') */
  localeSource?: string
  /** iter-044 B7: 是否引用了 deep import (element-ui/src/...) */
  hasDeepImport: boolean
  /** iter-044 B7: 检测到的 deep import 路径列表 */
  deepImports: string[]
}

export const NEW_PKG = 'element-plus'
export const OLD_PKG = 'element-ui'

/** iter-044 B2: 'element-ui/lib/locale/...' 路径前缀 (含 'lang/...') */
const LOCALE_PREFIX = `${OLD_PKG}/lib/locale/`

/** iter-044 B7: element-ui deep imports 路径前缀 (e.g. 'element-ui/src/utils/resize-event') */
const DEEP_IMPORT_PREFIXES = [
  `${OLD_PKG}/src/`,
  `${OLD_PKG}/packages/`,
]

/**
 * 把 element-ui deep import 路径映射成 element-plus 等价路径。
 * 例: `element-ui/src/utils/resize-event` → `element-plus/lib/utils/resize-event`
 *
 * 启发式映射:
 *   element-ui/src/...   → element-plus/lib/...
 *   element-ui/packages/... → element-plus/...
 */
function mapDeepImport(src: string): string | null {
  if (src.startsWith(`${OLD_PKG}/src/`)) {
    return src.replace(`${OLD_PKG}/src/`, `${NEW_PKG}/lib/`)
  }
  if (src.startsWith(`${OLD_PKG}/packages/`)) {
    return src.replace(`${OLD_PKG}/packages/`, `${NEW_PKG}/`)
  }
  return null
}

export function collectElementUIImports(ctx: TransformContext): ElementUIContext {
  const info: ElementUIContext = {
    namedImports: new Map(),
    hasCss: false,
    hasLocale: false,
    hasDeepImport: false,
    deepImports: [],
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

      // 3. iter-044 B2: locale 子路径
      //   'element-ui/lib/locale/lang/en'  →  'element-plus/lib/locale/lang/en'
      //   'element-ui/lib/locale/lang/zh-CN' → 'element-plus/lib/locale/lang/zh-CN'
      //   'element-ui/lib/locale' (无 lang)  →  'element-plus/lib/locale'
      if (src.startsWith(LOCALE_PREFIX) || src === `${OLD_PKG}/lib/locale`) {
        const newSrc = src.replace(OLD_PKG, NEW_PKG)
        node.source.value = newSrc
        if (node.source.extra) node.source.extra.raw = `'${newSrc}'`
        else node.source.raw = `'${newSrc}'`
        info.hasLocale = true
        info.localeSource = newSrc
        ctx.utils.markChanged(`element-ui locale path → ${newSrc}`)
      }

      // 4. iter-044 B7: deep imports (element-ui/src/...  element-ui/packages/...)
      //   'element-ui/src/utils/resize-event' → 'element-plus/lib/utils/resize-event'
      //   'element-ui/packages/...'/...
      if (DEEP_IMPORT_PREFIXES.some((p) => src.startsWith(p))) {
        const newSrc = mapDeepImport(src)
        if (newSrc) {
          node.source.value = newSrc
          if (node.source.extra) node.source.extra.raw = `'${newSrc}'`
          else node.source.raw = `'${newSrc}'`
          info.hasDeepImport = true
          info.deepImports.push(newSrc)
          ctx.utils.markChanged(`element-ui deep import → ${newSrc}`)
          // 提示用户验证路径 (element-plus 内部结构可能不同)
          ctx.utils.manualReview(
            `[iter-044 B7] 检测到 element-ui deep import 已映射: '${src}' → '${newSrc}'。Element Plus 内部路径结构可能与 element-ui 不同,请确认模块在 '${newSrc}' 路径下确实存在 (可用 IDE 跳转验证)。`,
          )
        }
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


