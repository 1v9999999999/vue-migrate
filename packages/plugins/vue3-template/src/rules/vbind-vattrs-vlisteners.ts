/**
 * 规则 2.13: 标记 v-bind="$attrs" / v-on="$listeners" 为 review
 *
 * Vue2 → Vue3 行为变化：
 *   - $listeners 已移除，Vue3 中事件继承走 attrs（fallthrough attributes）
 *   - $attrs 现在包含 attrs 和 listeners（合并）
 *   - `v-bind="$attrs"` 在 Vue3 仍有效，但配合 `v-on="$attrs"` 这种重复使用是 Vue2 时代的 bug
 *   - 子组件应该显式声明 props/emits，剩余 attrs 用 inheritAttrs: false + v-bind="$attrs" 显式转发
 *
 * 实现：
 *   扫描所有 `v-bind="$attrs"` 和 `v-on="$listeners"`，只标 review（不删除）。
 *   同时检测 `v-on="$attrs"`（典型 Vue2 错用）也标 review。
 */

import {
  scanAllElements,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'

export interface VAttrResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function reviewVAttrsVListeners(template: string): VAttrResult {
  const all = scanAllElements(template)
  const reviews: string[] = []
  const changes: string[] = []

  for (const el of all) {
    for (const a of el.attrs) {
      // v-bind="$attrs"  (also matches `:="$attrs"` short form)
      if (
        a.isDirective &&
        a.name === 'bind' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$attrs'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-bind="$attrs" 在 Vue3 中仍可用，但子组件建议显式声明 props，并把 inheritAttrs 设为 false 来禁用自动继承。`,
        )
        changes.push(
          `<${el.tagName} v-bind="$attrs"> marked for review (Vue3 inheritAttrs API)`,
        )
        continue
      }
      // v-on="$listeners"  (also matches @="$listeners")
      if (
        a.isDirective &&
        a.name === 'on' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$listeners'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-on="$listeners" 已废弃（Vue3 移除 $listeners）。改为显式 emit 事件，或用 v-on="someListenerObj"。`,
        )
        changes.push(
          `<${el.tagName} v-on="$listeners"> marked for review (Vue3 removed $listeners)`,
        )
        continue
      }
      // v-on="$attrs"  - 典型 Vue2 错用（应该是 v-bind）
      if (
        a.isDirective &&
        a.name === 'on' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$attrs'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-on="$attrs" 看起来是 bug —— 应该用 v-bind="$attrs"。`,
        )
        changes.push(
          `<${el.tagName} v-on="$attrs"> is likely a bug — should be v-bind="$attrs"`,
        )
      }
    }
  }

  if (changes.length === 0) {
    return { out: template, changed: false, changes, reviewItems: [] }
  }
  return { out: template, changed: true, changes, reviewItems: reviews }
}
