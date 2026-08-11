/**
 * 规则 2.13: v-bind="$attrs" / v-on="$listeners" / ::v-deep 处理
 *
 * Vue2 → Vue3 行为变化：
 *   - $listeners 已移除，Vue3 中事件继承走 attrs（fallthrough attributes）
 *   - $attrs 现在包含 attrs 和 listeners（合并）
 *   - `v-bind="$attrs"` 在 Vue3 仍有效
 *   - `v-on="$attrs"` 是 Vue2 时代的 bug —— 应该是 v-bind
 *   - 子组件应该显式声明 props/emits，剩余 attrs 用 inheritAttrs: false + v-bind="$attrs" 显式转发
 *   - ::v-deep 已被废弃（Vue 3.4 → 警告，Vue 3.5+ → 移除），用 :deep() 替代
 *
 * iter-112 自动改规则 (字符串级, 跟 this-replacer 思路):
 *   - `v-on="$listeners"`  →  `v-bind="$attrs"` (Vue 3: $listeners 已合并到 $attrs)
 *   - `v-on="$attrs"`  →  `v-bind="$attrs"` (Vue 2 bug, 风险极低)
 *   - `v-bind="$attrs"`  →  标 review (用户选择 inheritAttrs)
 *   - `::v-deep / /deep/ / >>>`  →  `:deep()` (iter-048a F2)
 */

import {
  scanAllElements,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { applyEdits, type TextEdit } from '../utils/template-editor.js'

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
  const edits: TextEdit[] = []
  const editDescs: string[] = []

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
      // iter-112: 标 review + 给出修复建议. 自动改需要 template offset 重建 (复杂),
      // 这里先标 review 提示用户改. (避免 attr.start/end 跟 template offset 错位的复杂逻辑)
      if (
        a.isDirective &&
        a.name === 'on' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$listeners'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-on="$listeners" 已废弃 (Vue 3: $listeners 已合并到 $attrs)。自动建议改为 v-bind="$attrs"。`,
        )
        changes.push(
          `<${el.tagName} v-on="$listeners"> — auto-fix suggestion: v-bind="$attrs" (Vue 3 移除 $listeners)`,
        )
        continue
      }
      // v-on="$attrs"  - 典型 Vue2 错用（应该是 v-bind）
      // iter-112: 标 review + 提示用户这是 bug
      if (
        a.isDirective &&
        a.name === 'on' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$attrs'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-on="$attrs" 看起来是 bug — $attrs 不是事件, 应该用 v-bind="$attrs"。`,
        )
        changes.push(
          `<${el.tagName} v-on="$attrs"> is likely a bug — should be v-bind="$attrs"`,
        )
      }
    }
  }

  // ============ iter-048a F2: ::v-deep / /deep/ / >>> 替换为 :deep() ============
  const cssDeepEdits = reviewAndRewriteVDeep(template)
  edits.push(...cssDeepEdits.edits)
  editDescs.push(...cssDeepEdits.descs)
  reviews.push(...cssDeepEdits.reviews)

  if (changes.length === 0 && edits.length === 0 && reviews.length === 0) {
    return { out: template, changed: false, changes, reviewItems: [] }
  }
  return {
    out: edits.length > 0 ? applyEdits(template, edits) : template,
    changed: edits.length > 0 || changes.length > 0,
    changes: [...changes, ...editDescs],
    reviewItems: reviews,
  }
}

/**
 * iter-112 (实现层): 字符串级 replace, 在整个 template 里直接替换
 * 这个函数独立调用, 跟 reviewVAttrsVListeners 并行. 调用方:
 *   1. 先调 reviewVAttrsVListeners 给用户 review 提示
 *   2. 再调 autoFixVOnAttrsListeners 直接改 source
 * 这样 review 信息保留 (用户能学到), 同时 source 也自动修了
 */
export function autoFixVOnAttrsListeners(template: string): string {
  let out = template
  // 模式: v-on="$listeners" 或 @="$listeners" → v-bind="$attrs"
  // 字符串级 replace, 支持 v-on / :on / @ 3 种 prefix
  out = out.replace(
    /(\s)(?:v-on|:on|@)\s*=\s*(["'])\$\s*listeners\s*\2/g,
    '$1v-bind="$attrs"',
  )
  // 模式: v-on="$attrs" → v-bind="$attrs" (Vue 2 bug)
  out = out.replace(
    /(\s)(?:v-on|:on|@)\s*=\s*(["'])\$\s*attrs\s*\2/g,
    '$1v-bind="$attrs"',
  )
  return out
}

/**
 * 在 source 里找 ::v-deep / /deep/ / >>> 并处理。
 *
 * 简化策略:只处理"简单"情况 — 选择器里只有 ::v-deep 一次 + 一个标识符。
 *   e.g. ::v-deep .foo     → :deep(.foo)
 *        ::v-deep .foo .bar  → :deep(.foo .bar)
 *        ::v-deep(.foo)    → :deep(.foo)  (已经 Vue 3 写法,跳过)
 * 其它 (选择器里有多个 ::v-deep, 或者 ::v-deep 紧跟 ::v-deep 等) 标 review。
 */
function reviewAndRewriteVDeep(source: string): {
  edits: TextEdit[]
  descs: string[]
  reviews: string[]
} {
  const edits: TextEdit[] = []
  const descs: string[] = []
  const reviews: string[] = []

  const re = /(::v-deep|\/deep\/|>>>)\s+([^\n{};]+?)(\s*)(?=\{|;|$|\n)/g
  let m: RegExpExecArray | null
  let lastIndex = 0
  while ((m = re.exec(source)) !== null) {
    if (m.index < lastIndex) break
    lastIndex = m.index + m[0].length

    const fullMatch = m[0]
    const deepKeyword = m[1]
    const selector = m[2]
    const trailing = m[3]

    if (/(::v-deep|\/deep\/|>>>)/.test(selector)) {
      reviews.push(
        `嵌套深度选择器 (源偏移 ${m.index}) 含多个 ::v-deep,无法自动重写,需手动改写为 Vue 3 的 :deep() 链。`,
      )
      continue
    }

    if (selector.trim().startsWith('(')) {
      continue
    }

    edits.push({
      start: m.index,
      end: m.index + fullMatch.length,
      replacement: `:deep(${selector})${trailing}`,
    })
    descs.push(
      `${deepKeyword} ${selector.trim()} → :deep(${selector.trim()}) (Vue 3 scoped style)`,
    )
  }

  return { edits, descs, reviews }
}
