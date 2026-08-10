/**
 * 规则 2.5, 2.6, 2.7, 2.10: 脚本端的 Vue2 实例属性
 *
 * 2.5  this.$listeners → this.$attrs (注意：语义有差异，仅警告)
 * 2.6  this.$children → 模板 ref (标 review)
 * 2.7  this.$scopedSlots.xxx → this.$slots.xxx
 * 2.10 this.$on / $off / $once → mitt / tiny-emitter (标 review)
 *
 * iter-044 B6: 检测 `Object.keys(x).forEach(empty-callback)` — 空 body forEach 整行删除
 *   例: Vue.filter() 全部移除后, `Object.keys(filters).forEach(key => {})` body 为空,
 *   整个 forEach 是死代码, 直接删。
 *
 * 实现：
 *   - $scopedSlots → $slots 是直接改名，AST 改即可
 *   - $listeners → $attrs 改名 + 加 review 警告
 *   - $children / $on / $off / $once 直接标 review（不改）
 *   - B6: forEach 空 body → 删除整个 statement
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

export interface ScriptInstanceResult {
  /** 修改次数 */
  modifications: number
  /** 转换描述 */
  changes: string[]
  /** 人工 review 项 */
  reviewItems: string[]
}

/**
 * iter-044 B6: 检查回调函数 body 是否为空
 * - arrow `() => {}` 或 `() => undefined`
 * - arrow `key => {}` 同上
 * - function () {} / function (key) {} 形式同
 */
function isEmptyCallbackBody(fn: t.ArrowFunctionExpression | t.FunctionExpression | t.FunctionDeclaration): boolean {
  if (!t.isBlockStatement(fn.body)) return false
  const body = fn.body
  // body.body.length === 0 → 完全空
  if (body.body.length === 0) return true
  // body 只有一条 return undefined / return; 视为空
  if (body.body.length === 1) {
    const stmt = body.body[0]
    if (t.isReturnStatement(stmt)) {
      if (!stmt.argument) return true // return;
      if (t.isIdentifier(stmt.argument, { name: 'undefined' })) return true
    }
  }
  return false
}

export function migrateScriptInstances(
  scriptAst: any,
  manualReview: (msg: string) => void,
): ScriptInstanceResult {
  const changes: string[] = []
  const reviewItems: string[] = []
  let modifications = 0

  if (!scriptAst) return { modifications, changes, reviewItems }

  traverse(scriptAst, {
    MemberExpression(path: NodePath<t.MemberExpression>) {
      const node = path.node

      // 2.7: this.$scopedSlots.xxx → this.$slots.xxx
      // 只在 `this.$scopedSlots.xxx` 形式（property 是 identifier，不是 computed）下替换
      if (
        t.isMemberExpression(node.object) &&
        t.isThisExpression(node.object.object) &&
        t.isIdentifier(node.object.property, { name: '$scopedSlots' }) &&
        t.isIdentifier(node.property) &&
        !node.computed
      ) {
        // 改 node.object 的 property 为 $slots
        // 原 `this.$scopedSlots.xxx` → `this.$slots.xxx`
        ;(node.object as t.MemberExpression).property = t.identifier('$slots')
        modifications++
        const slotName = node.property.name
        changes.push(`this.$scopedSlots.${slotName} → this.$slots.${slotName}`)
        return
      }

      // 2.5: this.$listeners → this.$attrs (改名 + 警告)
      if (
        t.isThisExpression(node.object) &&
        t.isIdentifier(node.property, { name: '$listeners' })
      ) {
        node.property = t.identifier('$attrs')
        modifications++
        changes.push(`this.$listeners → this.$attrs (语义不完全等价，需人工确认)`)
        reviewItems.push(
          `this.$listeners 改为 this.$attrs，但 Vue3 中两者合并了，行为有差异，请人工确认`,
        )
        return
      }

      // 2.6: this.$children → manual review
      if (
        t.isThisExpression(node.object) &&
        t.isIdentifier(node.property, { name: '$children' })
      ) {
        reviewItems.push(
          `this.$children 在 Vue3 中已移除，请改用模板 ref (<ChildComp ref="xxx" />) + useTemplateRef`,
        )
        // 不修改代码
        return
      }
    },

    CallExpression(path: NodePath<t.CallExpression>) {
      const node = path.node
      // 2.10: this.$on / $off / $once → manual review
      if (
        t.isMemberExpression(node.callee) &&
        t.isThisExpression(node.callee.object) &&
        t.isIdentifier(node.callee.property) &&
        ['$on', '$off', '$once'].includes(node.callee.property.name)
      ) {
        const method = node.callee.property.name
        reviewItems.push(
          `this.${method}(...) 在 Vue3 中已移除，请改用 mitt / tiny-emitter / pinia 等事件总线方案`,
        )
      }
    },
  })

  // ========== iter-044 B6: 空 forEach 检测 ==========
  // 检测 `Object.keys(x).forEach(<empty-callback>)` — body 为空, 整行是死代码, 删
  // 注意: 先于本函数处理(可能被本函数的其它规则间接清空,例如 vue3-entry 移除 Vue.filter() 后)
  traverse(scriptAst, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const node = path.node
      // 匹配 `Object.keys(x).forEach(cb)` 形式
      if (
        !t.isMemberExpression(node.callee) ||
        !t.isIdentifier(node.callee.property, { name: 'forEach' })
      ) {
        return
      }
      // callee.object 必须是 Object.keys(x)
      const obj = node.callee.object
      if (
        !t.isCallExpression(obj) ||
        !t.isMemberExpression(obj.callee) ||
        !t.isIdentifier(obj.callee.object, { name: 'Object' }) ||
        !t.isIdentifier(obj.callee.property, { name: 'keys' })
      ) {
        return
      }
      // 回调是 arrow / function expression, 且 body 为空
      if (node.arguments.length !== 1) return
      const cb = node.arguments[0]
      if (
        !t.isArrowFunctionExpression(cb) &&
        !t.isFunctionExpression(cb)
      ) {
        return
      }
      if (!isEmptyCallbackBody(cb as any)) return

      // 找到包含此 forEach 的 ExpressionStatement 并删除
      const stmtPath = (path as any).findParent?.((p: any) => p.isExpressionStatement())
      if (!stmtPath) return
      // 别删非顶层 (例如 if-body 里的 forEach 可能是 if 的副作用)
      // 保守起见,只删顶层 forEach
      if (!stmtPath.parentPath?.isProgram()) {
        return
      }
      // 别删 if/for/while 里那种 "无条件执行但有副作用" 的 — 我们的 callback 已确认空
      // 安全删
      const start = stmtPath.node.start ?? 0
      const end = stmtPath.node.end ?? 0
      stmtPath.remove()
      modifications++
      changes.push(
        `B6: 删除空 forEach (Object.keys(...).forEach(<empty>)) @${start}-${end}`,
      )
    },
  })

  // 触发 review 项目计数
  for (const r of reviewItems) {
    manualReview(r)
  }

  return { modifications, changes, reviewItems }
}

