/**
 * iter-048a F4: CJS 库的 default import 改写
 *
 * 适用场景:
 *   - xlsx / jszip: CJS 模块, Vite 5 + strict ESM 下 default 不可用 → namespace
 *   - file-saver: Vite 5 下有 named `saveAs`, 改 named import
 *   - 类似 codemirror / dropzone 等 UMD 包装也可加入
 *
 * 用法:
 *   {
 *     name: 'xlsx',            // package name
 *     type: 'namespace'        // → import * as X from 'pkg'
 *   }
 *   {
 *     name: 'file-saver',
 *     type: 'named',
 *     namedImports: { default: 'saveAs' }  // 把 default 的 localName 映射到 named
 *   }
 *
 * 注意:
 *   - 仅当 source 是字面量完全匹配时改
 *   - 已经有 namespace import 不动
 *   - 已经有纯 named import (没有 default) 不动
 *   - 混合 default + named: 替换 default 为对应 named, named 部分保留
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

export interface CjsDefaultToNamedRule {
  /** package 名 */
  name: string
  /** 转换类型 */
  type: 'namespace' | 'named'
  /**
   * named 类型的映射: 原 default 的 localName → 新 named 的 imported 名
   * 例如 { default: 'saveAs' } 表示把 default 替换成 `import { saveAs as <localName> } from 'pkg'`
   * 用户的代码用 `saveAs(blob, name)` 不变, 但需要 import 里保持 localName 一致
   */
  namedImports?: Record<string, string>
  /** 改写原因 (用于 markChanged) */
  reason: string
}

export function fixCjsDefaultToNamed(
  ctx: TransformContext,
  rules: CjsDefaultToNamedRule[],
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

      // iter-048: 支持 sub-path 改写 (e.g. 'element-plus/lib/locale/lang/en' → 'element-plus/es/locale/lang/en')
      // 规则可以提供 pathRewrite 函数处理 sub-path
      const subPathMatch = Object.entries((rules as any).__subPathRewrite || {}).find(
        ([from]) => pkg === from,
      ) as [string, (pkg: string) => string] | undefined

      let rule = ruleByName.get(pkg)
      let isSubPathRewrite = false
      if (!rule && subPathMatch) {
        const [from, rewrite] = subPathMatch
        const newPkg = rewrite(from)
        if (newPkg !== from) {
          path.node.source = t.stringLiteral(newPkg)
          changed = true
          hits.push(`${from} → ${newPkg}`)
          ctx.utils.markChanged(`${from}: sub-path 改写 (${rules.find((r: any) => (r as any).subPathFrom === from)?.reason || 'Vue 3 / element-plus v2 路径'})`)
          return
        }
      }

      if (!rule) return

      // 跳过非 sub-path 规则的 sub-path
      if (pkg.includes('/') && !isSubPathRewrite) return

      // 已经是 namespace import: 不动
      const isNamespace = node.specifiers.some((s: any) =>
        t.isImportNamespaceSpecifier(s),
      )
      if (isNamespace) return

      // default specifier
      const defaultSpec = node.specifiers.find((s: any) =>
        t.isImportDefaultSpecifier(s),
      )
      if (!defaultSpec) {
        // 已经是 named import (无 default): 不动
        return
      }

      const localName = (defaultSpec as any).local?.name ?? rule.name

      if (rule.type === 'namespace') {
        // 替换为 namespace import
        node.specifiers = [t.importNamespaceSpecifier(t.identifier(localName))]
        changed = true
        hits.push(`${rule.name} → * as ${localName}`)
        ctx.utils.markChanged(
          `${rule.name}: default import → namespace import (${rule.reason})`,
        )
      } else if (rule.type === 'named' && rule.namedImports) {
        // 替换 default 为 named
        // 例: import X from 'pkg' → import { saveAs as X } from 'pkg'
        const defaultMap = rule.namedImports
        const importName = defaultMap.default
        if (!importName) return

        const newSpec: t.ImportSpecifier = t.importSpecifier(
          t.identifier(localName),
          t.identifier(importName),
        )
        // 保留其它 specifier (混合 named)
        const otherSpecs = node.specifiers.filter(
          (s: any) => s !== defaultSpec,
        )
        node.specifiers = [newSpec, ...otherSpecs]
        changed = true
        hits.push(`${rule.name} → { ${importName} as ${localName} }`)
        ctx.utils.markChanged(
          `${rule.name}: default import → named import { ${importName} as ${localName} } (${rule.reason})`,
        )
      }
    },
  })

  return { changed, hits }
}
