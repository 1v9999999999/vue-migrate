/**
 * echarts v4 → v5 import 形式调整
 *
 * 背景：
 *   echarts v4 是 CJS + ESM hybrid，default import 在 Vite 下勉强能跑（通过 esbuild interop），
 *   但在 Vite 5 + 严格 ESM 模式 / SSR / 大型 build 下会报 "default is not exported"。
 *
 * 官方推荐 v5 用法：
 *   import * as echarts from 'echarts'
 *   // or
 *   import { init, use } from 'echarts'  // 具名导入
 *
 * 改写：
 *   import echarts from 'echarts'          → import * as echarts from 'echarts'
 *   import { init } from 'echarts'         → 保持（已经是 named import）
 *   import * as echarts from 'echarts'     → 保持
 *
 * 注意：
 *   - 仅当 source 是字面量 'echarts' 时改
 *   - 如果是 `import echarts from 'echarts/lib/...'` 不动
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

export function fixEchartsImports(ctx: TransformContext): { changed: boolean } {
  if (!ctx.file.scriptAst) return { changed: false }
  let changed = false

  traverse(ctx.file.scriptAst, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      if (node.source.value !== 'echarts') return

      // 已经是 namespace import (* as echarts): 不动
      const isNamespace = node.specifiers.some((s: any) => t.isImportNamespaceSpecifier(s))
      if (isNamespace) return

      // 已经是 named import: 不动
      const hasNamed = node.specifiers.some((s: any) => t.isImportSpecifier(s))
      if (hasNamed && !node.specifiers.some((s: any) => t.isImportDefaultSpecifier(s))) {
        return
      }

      // default import → namespace import
      // 把 default specifier 改名为本地原名, 然后把 specifier type 改 namespace
      const defaultSpec = node.specifiers.find((s: any) => t.isImportDefaultSpecifier(s))
      if (!defaultSpec) return

      const localName = (defaultSpec as any).local?.name ?? 'echarts'

      // 重写: import * as <localName> from 'echarts'
      node.specifiers = [
        t.importNamespaceSpecifier(t.identifier(localName)),
      ]
      changed = true
      ctx.utils.markChanged(`echarts: default import → namespace import (* as ${localName})`)
    },
  })

  return { changed }
}
