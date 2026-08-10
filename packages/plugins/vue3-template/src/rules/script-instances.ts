/**
 * 规则 2.5, 2.6, 2.7, 2.10: 脚本端的 Vue2 实例属性
 *
 * 2.5  this.$listeners → this.$attrs (注意：语义有差异，仅警告)
 * 2.6  this.$children → 模板 ref (标 review)
 * 2.7  this.$scopedSlots.xxx → this.$slots.xxx
 * 2.10 this.$on / $off / $once → mitt / tiny-emitter (标 review)
 *
 * 实现：
 *   - $scopedSlots → $slots 是直接改名，AST 改即可
 *   - $listeners → $attrs 改名 + 加 review 警告
 *   - $children / $on / $off / $once 直接标 review（不改）
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

  // 触发 review 项目计数
  for (const r of reviewItems) {
    manualReview(r)
  }

  return { modifications, changes, reviewItems }
}
