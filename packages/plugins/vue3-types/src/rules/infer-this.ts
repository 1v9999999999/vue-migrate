/**
 * 规则 4.3: this.xxx 类型推断（data/props/methods/computed）
 *
 * 策略：
 *   1. 找到 export default { ... } 的 options 对象
 *   2. 收集 data() / props / methods / computed 中的所有属性
 *   3. 扫描所有 methods / computed / lifecycle 钩子函数体里的 this.xxx 访问
 *   4. 把每种 this.xxx 的 type 推断出来（已在 typeCache 里）
 *   5. 在 methods 上方加 JSDoc @type 注释
 *
 * MVP：只识别 data/props 上存在的属性。methods / computed 返回值推断太复杂，TODO。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import { getFileTypeCache } from '../utils.js'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

interface MemberInfo {
  name: string
  type: 'data' | 'props' | 'methods' | 'computed' | 'unknown'
  typeStr: string  // JSDoc-style: { count: number; ... }
}

export function inferThisTypes(ctx: TransformContext): void {
  const { file, project } = ctx
  if (!file.scriptAst) return

  // 找到 export default 的 options 对象
  let optionsNode: t.ObjectExpression | null = null
  traverse(file.scriptAst, {
    ExportDefaultDeclaration(path: any) {
      const decl = path.node.declaration
      if (t.isObjectExpression(decl)) {
        optionsNode = decl
        path.stop()
      }
    },
  })
  if (!optionsNode) return

  // 收集 data/props/methods/computed
  const members = new Map<string, MemberInfo>()
  const optionsObj = optionsNode as t.ObjectExpression
  if (!optionsObj.properties) return
  for (const prop of optionsObj.properties) {
    if (!t.isObjectProperty(prop) || !t.isIdentifier(prop.key)) continue
    const name = prop.key.name
    const cache = getFileTypeCache(project, file)
    if (name === 'data' && (t.isObjectMethod(prop) || t.isObjectProperty(prop))) {
      // data: function() { return { ... } } | () => ({ ... }) | data() { ... }
      const value = (prop as any).value
      if (value && (t.isFunctionExpression(value) || t.isArrowFunctionExpression(value) || t.isObjectMethod(prop))) {
        const returnExpr = extractReturnObject(value)
        if (returnExpr && t.isObjectExpression(returnExpr)) {
          for (const dataProp of returnExpr.properties) {
            if (t.isObjectProperty(dataProp) && t.isIdentifier(dataProp.key)) {
              const dataName = dataProp.key.name
              const inf = cache.get(`data.${dataName}`)
              if (inf) {
                members.set(dataName, { name: dataName, type: 'data', typeStr: inf.jsTypeString })
              }
            }
          }
        }
      }
    } else if (name === 'props' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      // props: { name: String, age: { type: Number } }
      for (const propsProp of prop.value.properties) {
        if (t.isObjectProperty(propsProp) && t.isIdentifier(propsProp.key)) {
          const propName = propsProp.key.name
          const inf = cache.get(`props.${propName}`)
          if (inf) {
            members.set(propName, { name: propName, type: 'props', typeStr: inf.jsTypeString })
          }
        }
      }
    } else if (name === 'methods' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      // methods: { foo() { ... }, bar: function() {} }
      for (const m of prop.value.properties) {
        if ((t.isObjectProperty(m) || t.isObjectMethod(m)) && t.isIdentifier(m.key)) {
          const mName = m.key.name
          members.set(mName, { name: mName, type: 'methods', typeStr: 'Function' })
        }
      }
    } else if (name === 'computed' && t.isObjectProperty(prop) && t.isObjectExpression(prop.value)) {
      // computed: { foo() { return ... } }
      for (const c of prop.value.properties) {
        if ((t.isObjectProperty(c) || t.isObjectMethod(c)) && t.isIdentifier(c.key)) {
          const cName = c.key.name
          // 推断 computed 返回类型
          const inf = inferComputedReturnType(c as any)
          if (inf) {
            members.set(cName, { name: cName, type: 'computed', typeStr: inf })
          } else {
            members.set(cName, { name: cName, type: 'computed', typeStr: 'unknown' })
          }
        }
      }
    }
  }

  if (members.size === 0) return

  // 给 methods/computed 函数体加 this 类型 JSDoc
  let attached = 0
  traverse(file.scriptAst, {
    ObjectMethod(path: any) {
      const node = path.node
      // 必须是 export default 对象的 methods/computed/lifecycle 内的函数
      if (!t.isIdentifier(node.key)) return
      const parent = path.parent
      if (!t.isObjectExpression(parent)) return
      const grand = path.parentPath?.parent
      if (!t.isObjectProperty(grand) || !t.isIdentifier(grand.key)) return
      const section = grand.key.name
      if (!['methods', 'computed'].includes(section)) return

      // 收集函数体里用到的 this.xxx
      const usedMembers = new Set<string>()
      path.traverse({
        MemberExpression(p: any) {
          if (
            t.isThisExpression(p.node.object) &&
            t.isIdentifier(p.node.property) &&
            !p.node.computed
          ) {
            usedMembers.add(p.node.property.name)
          }
        },
      })

      if (usedMembers.size === 0) return

      // 加 JSDoc
      const lines: string[] = []
      lines.push('this 类型:')
      lines.push('{')
      const items: string[] = []
      for (const m of usedMembers) {
        const info = members.get(m)
        if (info) {
          items.push(`  ${m}: ${info.typeStr}`)
        } else {
          items.push(`  ${m}: unknown`)
        }
      }
      lines.push(items.join(',\n'))
      lines.push('}')

      // 已有 JSDoc？
      const existing = node.leadingComments
      const newComment: t.CommentBlock = {
        type: 'CommentBlock',
        value: `\n * ${lines.join('\n * ')}\n `,
      } as any
      if (existing) {
        ;(node as any).leadingComments = [...existing, newComment]
      } else {
        ;(node as any).leadingComments = [newComment]
      }
      attached++
    },
  })

  if (attached > 0) {
    ctx.utils.markChanged(`annotated ${attached} methods with this-type JSDoc`)
  }
}

/** 提取函数 return 的对象（支持箭头函数返回 () => ({...})） */
function extractReturnObject(
  fn: any,
): t.ObjectExpression | null {
  if (!fn) return null
  // function () { return {...} } 或 () => ({...})
  if (t.isObjectMethod(fn)) {
    return extractFromBlock(fn.body)
  }
  if (t.isFunctionExpression(fn) || t.isArrowFunctionExpression(fn)) {
    // 箭头函数体是表达式
    if (t.isObjectExpression(fn.body)) return fn.body
    if (t.isParenthesizedExpression(fn.body) && t.isObjectExpression(fn.body.expression)) {
      return fn.body.expression
    }
    if (t.isBlockStatement(fn.body)) return extractFromBlock(fn.body)
    return null
  }
  return null
}

function extractFromBlock(block: t.BlockStatement | null | undefined): t.ObjectExpression | null {
  if (!block || !t.isBlockStatement(block)) return null
  for (const stmt of block.body) {
    if (t.isReturnStatement(stmt) && stmt.argument && t.isObjectExpression(stmt.argument)) {
      return stmt.argument
    }
  }
  return null
}

/** 简化版 computed 返回类型推断 */
function inferComputedReturnType(node: any): string | null {
  if (!t.isObjectMethod(node) && !t.isObjectProperty(node)) return null
  // ObjectMethod
  if (t.isObjectMethod(node)) {
    return extractFromBlock(node.body)?.type === 'ObjectExpression' ? '{ [key: string]: any }' : 'unknown'
  }
  return null
}
