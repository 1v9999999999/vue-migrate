/**
 * 规则 2.1 & 2.2: slot / slot-scope → <template #xxx>
 *
 * Vue2 写法：
 *   <my-comp>
 *     <span slot="header">标题</span>
 *     <span slot-scope="props">{{ props.text }}</span>
 *   </my-comp>
 *
 * Vue3 写法：
 *   <my-comp>
 *     <template #header>
 *       <span>标题</span>
 *     </template>
 *     <template #default="props">
 *       <span>{{ props.text }}</span>
 *     </template>
 *   </my-comp>
 *
 * 注意：
 *   - 同时有 slot 和 slot-scope：合并成 <template #slot=scope>
 *   - 只有 slot-scope：默认 slot 名是 "default"
 *   - 自闭合元素也支持
 *   - 缩进：尽量保持原缩进
 *
 * 实现：用 template-editor 的 replaceElement 统一 splice，避开 B33
 * 双层 wrap bug。原元素已经是 <template> 时也走同一路径。
 */

import {
  scanAllElements,
  findAttr,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { applyEdits } from '../utils/template-editor.js'

export interface SlotRewriteResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function rewriteSlots(template: string): SlotRewriteResult {
  // iter-048a F1: 嵌套 slot wrap 修复
  //
  // 旧实现一次性扫所有 slot 元素,build 一组 edits,applyEdits 一次应用。
  // 问题:如果外层元素 (e.g. <el-dropdown-menu slot="dropdown">) 自身被 wrap 时,
  //      wrap 的内容用的是原始 source slice, 嵌套的内层 <template slot="prepend">
  //      仍带着旧属性,内层 edit 改完后外层 wrap 已经被构造好,丢了内层修改。
  //
  // 解法:逐个 edit 应用 (deepest-first,按 end offset 降序),每应用完一个 re-scan
  //      拿新 offsets。这样外层 wrap 看到的是已经改过的内层。
  // 复杂度兜底:最多扫 16 次,正常 1-2 轮就收敛。
  const allChanges: string[] = []
  const allReview: string[] = []
  let cur = template
  for (let iter = 0; iter < 16; iter++) {
    const all = scanAllElements(cur)
    // 收集所有带 slot / slot-scope 的元素
    const targets: ElementMatch[] = []
    for (const el of all) {
      if (findAttr(el, 'slot') || findAttr(el, 'slot-scope')) {
        targets.push(el)
      }
    }
    if (targets.length === 0) break

    // 按 end offset 降序 (deepest first), 一次只改一个, 改完重新扫描
    targets.sort((a, b) => b.end - a.end)
    const el = targets[0]
    const { edit, desc, review, replacement } = buildSlotEdit(el, cur)
    if (edit) {
      cur = applyEdits(cur, [edit])
      allChanges.push(desc)
      if (review) allReview.push(review)
    } else if (replacement) {
      // wrap 形式的 edit 已经在 buildSlotEdit 里构造好
      cur = applyEdits(cur, [{ start: editStart(el, cur), end: el.end, replacement }])
      allChanges.push(desc)
      if (review) allReview.push(review)
    } else {
      // 不该出现:target 被识别但没生成 edit
      break
    }
  }
  const changed = cur !== template
  return {
    out: cur,
    changed,
    changes: allChanges,
    reviewItems: allReview,
  }
}

/** 取 wrap edit 的真实 start (含行 indent) */
function editStart(el: ElementMatch, source: string): number {
  const lineIndent = detectIndent(source, el.start)
  return el.start - lineIndent.length
}

/** 单个 element 构造 slot edit,返回 description + edit 或 wrap replacement */
function buildSlotEdit(
  el: ElementMatch,
  source: string,
): {
  edit: { start: number; end: number; replacement: string } | null
  desc: string
  review: string | null
  replacement: string | null
} {
  const slotAttr = findAttr(el, 'slot')
  const scopeAttr = findAttr(el, 'slot-scope')
  const slotName = slotAttr?.value
  const scopeName = scopeAttr?.value

  let review: string | null = null
  if (typeof slotName === 'string' && slotName.startsWith(':')) {
    review = `动态 slot 名 "${slotName}" 需手动确认 Vue3 等价写法`
  }

  const finalSlotName =
    typeof slotName === 'string' && !slotName.startsWith(':')
      ? slotName
      : 'default'
  const finalScopeName = typeof scopeName === 'string' ? scopeName : null

  if (el.tagName === 'template') {
    const newOpen = buildTemplateOpenTag(el, source, finalSlotName, finalScopeName)
    return {
      edit: { start: el.openStart, end: el.openEnd + 1, replacement: newOpen },
      desc:
        `<template slot="${finalSlotName}"` +
        (finalScopeName ? ` slot-scope="${finalScopeName}"` : '') +
        ' → <template #' + finalSlotName +
        (finalScopeName ? `="${finalScopeName}"` : '') + '>',
      review,
      replacement: null,
    }
  }

  // 普通元素 wrap
  const lineIndent = detectIndent(source, el.start)
  const indentUnit = detectIndentUnit(source)
  const parts = rebuildElementParts(el, source)
  const wrapped = wrapInTemplate(
    finalSlotName,
    finalScopeName,
    parts,
    indentUnit,
    lineIndent,
  )
  return {
    edit: null,
    desc:
      `<${el.tagName} slot="${finalSlotName}"` +
      (finalScopeName ? ` slot-scope="${finalScopeName}"` : '') +
      '> → <template>',
    review,
    replacement: wrapped,
  }
}

/** 单轮 slot rewrite — 保留旧签名,供可能的其他调用方使用 */
// 注意: iter-048a F1 后,实际的 slot rewrite 由 rewriteSlots (新) 接管。
// rewriteSlotsOnce 保留作为 deprecated 入口,直接调用 buildSlotEdit 处理一轮
// (无 nested fix),供单元测试等需要单轮语义的场景使用。
function rewriteSlotsOnce(template: string): SlotRewriteResult {
  const all = scanAllElements(template)
  const targets: ElementMatch[] = []
  for (const el of all) {
    if (findAttr(el, 'slot') || findAttr(el, 'slot-scope')) {
      targets.push(el)
    }
  }
  if (targets.length === 0) {
    return { out: template, changed: false, changes: [], reviewItems: [] }
  }

  const changes: string[] = []
  const reviewItems: string[] = []
  const edits: Array<{ start: number; end: number; replacement: string }> = []

  for (const el of targets) {
    const { edit, desc, review, replacement } = buildSlotEdit(el, template)
    if (edit) {
      edits.push(edit)
      changes.push(desc)
      if (review) reviewItems.push(review)
    } else if (replacement) {
      edits.push({ start: editStart(el, template), end: el.end, replacement })
      changes.push(desc)
      if (review) reviewItems.push(review)
    }
  }

  if (edits.length === 0) {
    return { out: template, changed: false, changes, reviewItems }
  }
  return {
    out: applyEdits(template, edits),
    changed: true,
    changes,
    reviewItems,
  }
}

/**
 * 重写 <template> 的 open tag：去掉 slot / slot-scope 属性，
 * 加上 v-slot 指令 (#slotName=scope)，保留其它属性。
 */
function buildTemplateOpenTag(
  el: ElementMatch,
  source: string,
  slotName: string,
  scopeName: string | null,
): string {
  const tagName = source.slice(el.tagNameStart, el.tagNameEnd)
  const kept = el.attrs.filter((a) => a.name !== 'slot' && a.name !== 'slot-scope')
  const attrText = source.slice(el.tagNameEnd, el.openEnd)
  let newAttrText = ''
  let cursor = 0
  for (const a of kept) {
    if (a.start > cursor) {
      // 跳过 cursor..a.start 之间任何被过滤掉的 attr (slot / slot-scope) 文本，
      // 只保留紧贴当前 attr 的前导空白。直接 slice(cursor, a.start) 会把
      // 已过滤的 slot="..." 文本也带进来，参见 P1-2 bug。
      let p = a.start
      while (p > cursor && (attrText[p - 1] === ' ' || attrText[p - 1] === '\t')) p--
      newAttrText += attrText.slice(p, a.start)
    }
    newAttrText += a.raw
    cursor = a.end
  }
  const vslotAttr = scopeName ? ` #${slotName}="${scopeName}"` : ` #${slotName}`
  return `<${tagName}${newAttrText}${vslotAttr}>`
}

// ---------------------------------------------------------------------------
// 普通元素 wrap 逻辑（保持原 indent）
// ---------------------------------------------------------------------------

interface ElementParts {
  openTag: string
  innerContent: string
  closeTag: string
  selfClosing: boolean
}

function rebuildElementParts(el: ElementMatch, source: string): ElementParts {
  const tagName = source.slice(el.tagNameStart, el.tagNameEnd)
  const kept: ParsedAttr[] = el.attrs.filter(
    (a) => a.name !== 'slot' && a.name !== 'slot-scope',
  )
  const attrText = source.slice(el.tagNameEnd, el.openEnd)
  let newAttrText = ''
  let cursor = 0
  for (const a of kept) {
    if (a.start > cursor) {
      // 跳过 cursor..a.start 之间任何被过滤掉的 attr (slot / slot-scope) 文本，
      // 只保留紧贴当前 attr 的前导空白。直接 slice(cursor, a.start) 会把
      // 已过滤的 slot="..." 文本也带进来，参见 P1-2 bug。
      let p = a.start
      while (p > cursor && (attrText[p - 1] === ' ' || attrText[p - 1] === '\t')) p--
      newAttrText += attrText.slice(p, a.start)
    }
    newAttrText += a.raw
    cursor = a.end
  }
  const openTag = `<${tagName}${newAttrText}${el.selfClosing ? ' />' : '>'}`
  if (el.selfClosing) {
    return { openTag, innerContent: '', closeTag: '', selfClosing: true }
  }
  const innerContent = source.slice(el.contentStart, el.contentEnd)
  const closeTag = source.slice(el.closeStart, el.closeEnd)
  return { openTag, innerContent, closeTag, selfClosing: false }
}

function wrapInTemplate(
  slotName: string,
  scopeName: string | null,
  parts: ElementParts,
  indentUnit: string,
  lineIndent: string,
): string {
  const templateOpen =
    lineIndent +
    `<template #${slotName}` +
    (scopeName ? `="${scopeName}"` : '') +
    '>'
  const templateClose = lineIndent + `</template>`
  const innerIndent = lineIndent + indentUnit

  let inner: string
  if (parts.selfClosing) {
    inner = innerIndent + parts.openTag
  } else if (!parts.innerContent.includes('\n')) {
    inner = innerIndent + parts.openTag + parts.innerContent + parts.closeTag
  } else {
    const trimmed = trimBlockContent(parts.innerContent)
    const shifted = trimmed
      .split('\n')
      .map((line) => (line === '' ? '' : indentUnit + line))
      .join('\n')
    inner =
      innerIndent +
      parts.openTag +
      '\n' +
      shifted +
      '\n' +
      innerIndent +
      parts.closeTag
  }
  return templateOpen + '\n' + inner + '\n' + templateClose
}

function trimBlockContent(content: string): string {
  let s = content.replace(/^\s*\n/, '')
  s = s.replace(/\n\s*$/, '')
  return s
}

function detectIndent(source: string, offset: number): string {
  let i = offset - 1
  while (i >= 0 && source[i] !== '\n') i--
  const start = i + 1
  let j = start
  while (j < offset && (source[j] === ' ' || source[j] === '\t')) j++
  return source.slice(start, j)
}

function detectIndentUnit(source: string): string {
  const lines = source.split('\n')
  const indents: number[] = []
  for (const line of lines) {
    const m = /^( +)\S/.exec(line)
    if (m) indents.push(m[1].length)
    if (indents.length >= 5) break
  }
  if (indents.length === 0) return '  '
  const min = Math.min(...indents)
  if (min === 0) return '  '
  return ' '.repeat(Math.min(min, 4))
}
