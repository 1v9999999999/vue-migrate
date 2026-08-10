/**
 * 规则 E.3: Vue.use(ElementUI) → app.use(ElementPlus)
 *
 * 这是入口文件里的全局注册。vue3-entry 已经把 Vue.use → app.use 串到链上，
 * 我们这里只是把 ElementUI 变量名改成 ElementPlus。
 *
 * 注意：本插件的 import-path.ts 已经把 `import ElementUI from 'element-ui'` 改成了
 * `import ElementPlus from 'element-plus'`，但默认导入的"本地变量名"我们没改。
 * 这里要做的：
 *   - 收集 import 时的 default 本地名
 *   - 在整个文件里把那个名字改成 ElementPlus
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'
import type { ElementUIContext } from './import-path.js'

const traverse = (_traverse as any).default || _traverse

export function renameDefaultImport(
  ctx: TransformContext,
  info: ElementUIContext,
): void {
  if (!info.defaultLocalName) return
  if (info.defaultLocalName === 'ElementPlus') return // 已经是新名了

  const oldName = info.defaultLocalName
  const newName = 'ElementPlus'

  if (!ctx.file.scriptAst) return

  // 收集要改的节点（ImportDefaultSpecifier 里的 local + 其他地方的引用）
  // 关键：必须正确判断"是不是 element-ui 那个 import 的 local"
  traverse(ctx.file.scriptAst, {
    // 1. 在 import 默认声明里：改 local
    ImportDefaultSpecifier(path: any) {
      if (path.node.local && path.node.local.name === oldName) {
        // 还要判断这个 import 的 source 是不是 element-ui（或 element-plus，因为前面已改过）
        const importDecl = path.parent
        if (t.isImportDeclaration(importDecl) && t.isStringLiteral(importDecl.source)) {
          const src = importDecl.source.value
          if (src === 'element-ui' || src === 'element-plus') {
            path.node.local.name = newName
            ctx.utils.markChanged(`rename default import ${oldName} → ${newName}`)
          }
        }
      }
    },
    // 2. 引用这个变量的地方
    Identifier(path: any) {
      if (path.node.name !== oldName) return
      // 排除 import 声明里的（那是源头，前面已处理）
      if (
        t.isImportDefaultSpecifier(path.parent) ||
        t.isImportSpecifier(path.parent) ||
        t.isImportNamespaceSpecifier(path.parent)
      ) {
        return
      }
      // 排除属性访问里的 key（{ElementUI: x} 里的 ElementUI 不要改）
      if (t.isObjectProperty(path.parent) && path.parent.key === path.node && !path.parent.computed) {
        return
      }
      // 排除成员访问的属性名（a.ElementUI = ...）
      if (t.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed) {
        return
      }
      // 排除 export from / import ... as ElementUI
      if (t.isExportSpecifier(path.parent)) {
        return
      }
      path.node.name = newName
      ctx.utils.markChanged(`rename ${oldName} → ${newName} (reference)`)
    },
  })
}
