/**
 * 规则 2.9: inline-template 移除
 *
 * Vue2: <child-comp inline-template>...</child-comp>
 * Vue3: inline-template 不再支持，需要在子组件里用 <slot> 替代
 *
 * 策略：
 *   - 调用 template-editor 的 replaceAttribute(source, el, attr, null)
 *     来移除属性。空白处理由 central 库负责。
 *   - 标 manual review（因为 Vue3 等价写法需要重构成 slot 形式）
 */

import {
  scanAllElements,
  findAttr,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { replaceAttribute } from '../utils/template-editor.js'

export interface InlineTemplateResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function removeInlineTemplate(template: string): InlineTemplateResult {
  const all = scanAllElements(template)
  // 收集所有带 inline-template 的元素，按 attr.start 降序
  const targets: Array<{ el: ElementMatch; attr: ParsedAttr }> = []
  for (const el of all) {
    const attr = findAttr(el, 'inline-template')
    if (attr) targets.push({ el, attr })
  }
  if (targets.length === 0) {
    return { out: template, changed: false, changes: [], reviewItems: [] }
  }

  // 按绝对 offset 降序处理（中央编辑器已经处理空白，我们只负责 splice）
  targets.sort((a, b) => {
    const aStart = a.el.tagNameEnd + a.attr.start
    const bStart = b.el.tagNameEnd + b.attr.start
    return bStart - aStart
  })

  const changes: string[] = []
  const reviewItems: string[] = []
  let out = template

  for (const { el, attr } of targets) {
    out = replaceAttribute(out, el, attr, null)
    changes.push(`<${el.tagName}> 上的 inline-template 已移除`)
    reviewItems.push(
      `<${el.tagName}> 上的 inline-template 已被移除，需手动将子组件内容改为 <slot> 注入形式`,
    )
  }

  return { out, changed: true, changes, reviewItems }
}
