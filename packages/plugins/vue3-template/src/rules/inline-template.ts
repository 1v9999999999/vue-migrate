/**
 * 规则 2.9: inline-template 移除
 *
 * Vue2: <child-comp inline-template>...</child-comp>
 * Vue3: inline-template 不再支持，需要在子组件里用 <slot> 替代
 *
 * MVP 策略：
 *   - 移除 inline-template 属性
 *   - 标 manual review（因为 Vue3 等价写法需要重构成 slot 形式）
 */

import {
  scanAllElements,
  findAttr,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'

export interface InlineTemplateResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function removeInlineTemplate(template: string): InlineTemplateResult {
  const all = scanAllElements(template)
  const targets: Array<{ el: ElementMatch; attr: ParsedAttr }> = []
  for (const el of all) {
    const attr = findAttr(el, 'inline-template')
    if (attr) {
      targets.push({ el, attr })
    }
  }
  if (targets.length === 0) {
    return { out: template, changed: false, changes: [], reviewItems: [] }
  }

  // 按 attr.start 降序处理
  targets.sort((a, b) => b.attr.start - a.attr.start)

  const changes: string[] = []
  const reviewItems: string[] = []
  let out = template

  for (const { el, attr } of targets) {
    const tagName = template.slice(el.tagNameStart, el.tagNameEnd)
    const attrTextStartInTpl = el.tagNameEnd
    const absStart = attrTextStartInTpl + attr.start
    const absEnd = attrTextStartInTpl + attr.end

    // 找 attr 之前最近的一个非空白字符（即 attr 前导空白的右边界）
    let leftBound = absStart
    while (leftBound > el.tagNameEnd && /\s/.test(template[leftBound - 1])) {
      leftBound--
    }
    // 找 attr 之后最近的一个非空白字符（即 attr 后续空白的左边界）
    let rightBound = absEnd
    while (rightBound < el.openEnd && /\s/.test(template[rightBound])) {
      rightBound++
    }

    const hasLeftContent = leftBound > el.tagNameEnd
    const hasRightContent = rightBound < el.openEnd

    // 决定 remove 区间
    // - 两边都有内容（其他属性）：去掉 attr 本身，左右各保留到边界
    // - 只有一边有内容：连空白一起吃
    // - 都没有：<tag inline-template /> 整个吃
    let removeStart: number
    let removeEnd: number
    let replacement = ''

    if (hasLeftContent && hasRightContent) {
      removeStart = absStart
      removeEnd = rightBound
      replacement = ' '
    } else if (hasLeftContent && !hasRightContent) {
      removeStart = leftBound
      removeEnd = el.openEnd
    } else if (!hasLeftContent && hasRightContent) {
      removeStart = absStart
      removeEnd = rightBound
    } else {
      removeStart = leftBound
      removeEnd = el.openEnd
    }

    out = out.slice(0, removeStart) + replacement + out.slice(removeEnd)
    changes.push(`<${tagName} inline-template> → <${tagName}>`)
    reviewItems.push(
      `<${tagName}> 上的 inline-template 已被移除，需手动将子组件内容改为 <slot> 注入形式`,
    )
  }

  return {
    out,
    changed: true,
    changes,
    reviewItems,
  }
}
