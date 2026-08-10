/**
 * 规则 2.1 & 2.2: slot / slot-scope → <template #xxx>
 *
 * Vue2 写法：
 *   <my-comp>
 *     <span slot="header">标题</span>
 *     <span slot-scope="props">{{ props.text }}</span>
 *     <span slot="item" slot-scope="row">{{ row.id }}</span>
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
 *     <template #item="row">
 *       <span>{{ row.id }}</span>
 *     </template>
 *   </my-comp>
 *
 * 注意：
 *   - 同时有 slot 和 slot-scope：合并成 <template #slot=scope>
 *   - 只有 slot-scope：默认 slot 名是 "default"
 *   - 自闭合元素也支持
 *   - 缩进：尽量保持原缩进
 */

import {
  scanAllElements,
  findAttr,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'

export interface SlotRewriteResult {
  /** 修改后的模板内容 */
  out: string
  /** 是否发生了变化 */
  changed: boolean
  /** 变化描述 */
  changes: string[]
  /** 需要人工 review 的项 */
  reviewItems: string[]
}

/**
 * 主入口：把模板里的 slot / slot-scope 重写为 <template #xxx>
 */
export function rewriteSlots(template: string): SlotRewriteResult {
  const all = scanAllElements(template)
  // 只关心带 slot / slot-scope 的元素
  const targets: ElementMatch[] = []
  for (const el of all) {
    if (findAttr(el, 'slot') || findAttr(el, 'slot-scope')) {
      targets.push(el)
    }
  }
  if (targets.length === 0) {
    return { out: template, changed: false, changes: [], reviewItems: [] }
  }

  // 从右往左处理（offset 大的先处理），避免前面替换影响后面的 offset
  targets.sort((a, b) => b.start - a.start)

  const changes: string[] = []
  const reviewItems: string[] = []
  let out = template

  for (const el of targets) {
    const slotAttr = findAttr(el, 'slot')
    const scopeAttr = findAttr(el, 'slot-scope')

    // 检查是否带 v-for 等冲突 —— v-for 不能直接套在 <template> 上以外
    // 实际上 <template v-for> 是合法的，所以这里只警告 v-if 同节点的情况
    // 暂时不处理

    const slotName = slotAttr?.value
    const scopeName = scopeAttr?.value

    // 检查是否是动态 slot name
    if (slotName && (slotName as string).startsWith(':')) {
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

    // 1. 重构内层元素：去掉 slot / slot-scope 属性
    const parts = rebuildElementParts(el, template)

    // 2. 构造外层 <template> 包裹
    // lineIndent 是原 element 所在行的缩进
    const lineIndent = detectIndent(template, el.start)
    const indentUnit = detectIndentUnit(template)
    const wrapped = wrapInTemplate(
      finalSlotName,
      finalScopeName,
      parts,
      indentUnit,
      lineIndent,
    )
    // prefix 只到上一行的换行符（不包括 element 行的缩进）
    const prefix = computePrefix(template, el.start)

    // 3. 替换
    out = prefix + wrapped + out.slice(el.end)

    const desc =
      `<${el.tagName} slot="${finalSlotName}"` +
      (finalScopeName ? ` slot-scope="${finalScopeName}"` : '') +
      '> → <template>'
    changes.push(desc)
  }

  return {
    out,
    changed: true,
    changes,
    reviewItems,
  }
}

/**
 * 重建一个元素，返回三段：openTag / innerContent / closeTag
 * - 去掉 slot / slot-scope 属性
 * - 其余属性原样保留
 */
interface ElementParts {
  openTag: string
  innerContent: string
  closeTag: string
  selfClosing: boolean
}

function rebuildElementParts(
  el: ElementMatch,
  template: string,
): ElementParts {
  const tagName = template.slice(el.tagNameStart, el.tagNameEnd)
  const kept: ParsedAttr[] = el.attrs.filter(
    (a) => a.name !== 'slot' && a.name !== 'slot-scope',
  )

  // 取出 attrText 原文
  const attrText = template.slice(el.tagNameEnd, el.openEnd)
  // 重建 attrText：只保留 kept 列表里的 attribute 及其前面的空白
  let newAttrText = ''
  let cursor = 0
  for (const a of kept) {
    if (a.start > cursor) {
      newAttrText += attrText.slice(cursor, a.start)
    }
    newAttrText += a.raw
    cursor = a.end
  }
  // 注意：不再追加 cursor 之后的尾部 —— 那是被丢弃的 attrs

  const openTag = `<${tagName}${newAttrText}${el.selfClosing ? ' />' : '>'}`

  if (el.selfClosing) {
    return { openTag, innerContent: '', closeTag: '', selfClosing: true }
  }

  const innerContent = template.slice(el.contentStart, el.contentEnd)
  const closeTag = template.slice(el.closeStart, el.closeEnd)
  return { openTag, innerContent, closeTag, selfClosing: false }
}

/**
 * 把内层元素包成 <template #slotName[=scope]>...</template>
 *
 * 输出结构（每行都自带 lineIndent）：
 *   {lineIndent}<template #xxx>            <- 第一行
 *   {innerIndent}<openTag>...              <- 内层 open tag（innerIndent = lineIndent + indentUnit）
 *   {原始 indent + indentUnit}<inner lines>  <- 中间内容
 *   {innerIndent}</closeTag>               <- 内层 close tag
 *   {lineIndent}</template>                <- 最后一行
 */
function wrapInTemplate(
  slotName: string,
  scopeName: string | null,
  parts: ElementParts,
  indentUnit: string,
  lineIndent: string,
): string {
  const templateOpen = lineIndent +
    `<template #${slotName}` + (scopeName ? `="${scopeName}"` : '') + '>'
  const templateClose = lineIndent + `</template>`

  const innerIndent = lineIndent + indentUnit

  let inner: string
  if (parts.selfClosing) {
    inner = innerIndent + parts.openTag
  } else if (!parts.innerContent.includes('\n')) {
    inner = innerIndent + parts.openTag + parts.innerContent + parts.closeTag
  } else {
    // 块级内容：先剥掉内容首尾的纯空白行，得到中间真实的"内容行"
    // 原始 innerContent 形如 "\n    <h1>...\n    <p>...\n  "
    // 剥掉首尾后是 "    <h1>...\n    <p>..."
    // 每行的原始 leading 是相对于原 open tag 的列（0）的偏移。
    // 新位置 = 原 leading + indentUnit（即整体下移一层）。
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

/** 去掉内容首尾的纯空白行（保留中间的内容行）
 *  原始: "\n    <h1>...\n    <p>...\n  "
 *  剥后: "    <h1>...\n    <p>..."
 */
function trimBlockContent(content: string): string {
  // 去掉开头的 \n 和空白
  let s = content.replace(/^\s*\n/, '')
  // 去掉结尾的 \n 和空白（这些是 close tag 所在行的缩进）
  s = s.replace(/\n\s*$/, '')
  return s
}

/** 计算 prefix：到 element 所在行之前的换行符为止（不含 element 行的缩进） */
function computePrefix(template: string, offset: number): string {
  // 找 offset 之前的 \n
  let i = offset - 1
  while (i >= 0 && template[i] !== '\n') i--
  // i 现在指向 \n（或者 -1）
  return template.slice(0, i + 1)
}

/** 检测元素起始处的缩进（最近的前导空白） */
function detectIndent(template: string, offset: number): string {
  // 找 offset 之前的 \n
  let i = offset - 1
  while (i >= 0 && template[i] !== '\n') i--
  const start = i + 1
  let j = start
  while (j < offset && (template[j] === ' ' || template[j] === '\t')) j++
  return template.slice(start, j)
}

/** 检测整个文件的缩进单位（默认 2 spaces） */
function detectIndentUnit(template: string): string {
  // 简单策略：看前几个非空行的缩进，取 GCD
  // MVP：默认 2 spaces
  const lines = template.split('\n')
  const indents: number[] = []
  for (const line of lines) {
    const m = /^( +)\S/.exec(line)
    if (m) indents.push(m[1].length)
    if (indents.length >= 5) break
  }
  if (indents.length === 0) return '  '
  // 取最小值
  const min = Math.min(...indents)
  if (min === 0) return '  '
  return ' '.repeat(Math.min(min, 4))
}
