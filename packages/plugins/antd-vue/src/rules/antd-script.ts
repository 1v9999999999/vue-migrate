/**
 * iter-121: ant-design-vue script AST 端规则
 *
 * 1) this.$form.createForm(this)            → review (改 Form.useForm())
 * 2) form.validateFields(cb) 回调形式      → review (改 await form.validateFields())
 * 3) import { Form } from 'ant-design-vue'  → review 提示 Form 来自 useForm (optional)
 * 4) this.$confirm / this.$info etc.        → review (改用 Modal.confirm / message.info)
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

export interface AntdScriptResult {
  hasAntdImport: boolean
  hasAntdv2Import: boolean
  reviewItems: string[]
  modifications: number
}

function inspectImports(ast: any): { hasAntdImport: boolean; hasAntdv2Import: boolean } {
  let hasAntdImport = false
  let hasAntdv2Import = false
  traverse(ast, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      const v = node.source.value
      // 1.x: 'ant-design-vue' (但 v1 主版本也是 'ant-design-vue')
      // v2: 还是 'ant-design-vue' (同包名)
      if (v === 'ant-design-vue') {
        hasAntdImport = true
        // 检测是否有 useForm 等 v2 API
        for (const spec of node.specifiers) {
          if (t.isImportSpecifier(spec)) {
            const name = (spec.imported as any)?.name
            if (name === 'useForm' || name === 'Form') hasAntdv2Import = true
          }
        }
      }
    },
  })
  return { hasAntdImport, hasAntdv2Import }
}

export function migrateAntdScript(ast: any): AntdScriptResult {
  const { hasAntdImport, hasAntdv2Import } = inspectImports(ast)
  const reviewItems: string[] = []
  let modifications = 0

  if (!hasAntdImport) {
    return { hasAntdImport, hasAntdv2Import, reviewItems, modifications }
  }

  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      const callee = node.callee
      if (!t.isMemberExpression(callee)) return

      // 路径 A: this.$form.createForm(this)
      if (
        t.isMemberExpression(callee.object) &&
        t.isThisExpression((callee.object as any).object) &&
        t.isIdentifier((callee.object as any).property) &&
        ((callee.object as any).property.name === '$form') &&
        t.isIdentifier(callee.property) &&
        (callee.property as any).name === 'createForm'
      ) {
        reviewItems.push(
          `this.$form.createForm(this) — ant-design-vue 2.x 改用 Form.useForm(this): const [form] = Form.useForm()`,
        )
        modifications++
        return
      }

      // 路径 B: form.validateFields((err, values) => {...})
      if (
        t.isIdentifier(callee.property) &&
        (callee.property as any).name === 'validateFields' &&
        node.arguments.length > 0
      ) {
        const arg = node.arguments[0]
        if (t.isFunctionExpression(arg) || t.isArrowFunctionExpression(arg)) {
          const params = (arg as any).params
          if (params.length >= 2) {
            // 双参数 → 还是 v1 callback 形式
            reviewItems.push(
              `form.validateFields((err, values) => {...}) — ant-design-vue 2.x 改用 Promise: try { const values = await form.validateFields() } catch (err) { ... }`,
            )
            modifications++
            return
          }
        }
      }

      // 路径 C: this.$confirm / this.$info / this.$success / this.$error / this.$warning / this.$modal
      if (
        t.isThisExpression(callee.object) &&
        t.isIdentifier(callee.property)
      ) {
        const name = (callee.property as any).name
        if (['$confirm', '$info', '$success', '$error', '$warning', '$modal'].includes(name)) {
          const target = name === '$modal' ? 'Modal' :
            name === '$confirm' ? 'Modal.confirm' :
            name === '$info' ? 'Modal.info' :
            name === '$success' ? 'message.success' :
            name === '$error' ? 'message.error' :
            'message.warning'

          reviewItems.push(
            `this.${name}({...}) — ant-design-vue 2.x 推荐按需 import: import { Modal, message } from 'ant-design-vue'; ${target}({...})`,
          )
          modifications++
          return
        }
      }
    },
  })

  return { hasAntdImport, hasAntdv2Import, reviewItems, modifications }
}
