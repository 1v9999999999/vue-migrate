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
  const all = scanAllElements(template)
  // 收集所有带 slot / slot-scope 的元素
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
  // 用 edMap 保持每个 target 对应的描述
  const editDescs: string[] = []

  for (const el of targets) {
    const slotAttr = findAttr(el, 'slot')
    const scopeAttr = findAttr(el, 'slot-scope')

    const slotName = slotAttr?.value
    const scopeName = scopeAttr?.value

    // 检查是否是动态 slot name
    if (typeof slotName === 'string' && slotName.startsWith(':')) {
      reviewItems.push(
        `动态 slot 名 "${slotName}" 需手动确认 Vue3 等价写法`,
      )
    }

    const finalSlotName =
      typeof slotName === 'string' && !slotName.startsWith(':')
        ? slotName
        : 'default'
    const finalScopeName =
      typeof scopeName === 'string' ? scopeName : null

    // 关键修复（B33）：原元素是 <template> 时，只重写属性，不再 wrap
    if (el.tagName === 'template') {
      const newOpen = buildTemplateOpenTag(
        el,
        template,
        finalSlotName,
        finalScopeName,
      )
      edits.push({
        start: el.openStart,
        end: el.openEnd + 1, // 包含 '>'
        replacement: newOpen,
      })
      editDescs.push(
        `<template slot="${finalSlotName}"` +
          (finalScopeName ? ` slot-scope="${finalScopeName}"` : '') +
          ' → <template #' + finalSlotName +
          (finalScopeName ? `="${finalScopeName}"` : '') + '>',
      )
      continue
    }

    // 普通元素：wrap 成 <template #xxx>...</template>
    // 注意：edit 范围要包含 element 之前的 line indent，否则会
    // 出现双层缩进（wrapped 自身以 lineIndent 开头）。
    const lineIndent = detectIndent(template, el.start)
    const lineStart = el.start - lineIndent.length
    const indentUnit = detectIndentUnit(template)
    const parts = rebuildElementParts(el, template)
    const wrapped = wrapInTemplate(
      finalSlotName,
      finalScopeName,
      parts,
      indentUnit,
      lineIndent,
    )
    edits.push({
      start: lineStart,
      end: el.end,
      replacement: wrapped,
    })
    editDescs.push(
      `<${el.tagName} slot="${finalSlotName}"` +
        (finalScopeName ? ` slot-scope="${finalScopeName}"` : '') +
        '> → <template>',
    )
  }

  return {
    out: applyEdits(template, edits),
    changed: true,
    changes: editDescs,
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
