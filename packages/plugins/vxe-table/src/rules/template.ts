/**
 * 规则 VT.2: 模板中 <vxe-table-column> → <vxe-column>
 *
 * vxe-table 4 把 <vxe-table-column> 改名为更短的 <vxe-column>。
 * v4 同时保留 vxe-table-column 作为兼容别名（自动转发到 vxe-column），
 * 所以这一改不是必须的，但 v4 官方文档和示例都用新名。
 *
 * 策略：替换 element 的 tagName 字符串（不影响 attrs / children）。
 * 走 vue3-template 的 central template-editor（applyEdits 一次处理）。
 */

import { scanAllElements, type ElementMatch } from '../../../vue3-template/src/utils/template-scanner.js'
import { applyEdits, type TextEdit } from '../../../vue3-template/src/utils/template-editor.js'

const OLD_TAG = 'vxe-table-column'
const NEW_TAG = 'vxe-column'

export interface RenameResult {
  out: string
  changed: boolean
  changes: string[]
}

export function renameVxeTableColumn(template: string): RenameResult {
  const all = scanAllElements(template)
  const edits: TextEdit[] = []
  const changes: string[] = []

  for (const el of all) {
    if (el.tagName !== OLD_TAG) continue
    // 1) Open tag: replace '<' + old tagName with '<' + new tagName.
    //    The attrs and closing '>' after tagNameEnd are left untouched.
    edits.push({ start: el.openStart, end: el.tagNameEnd, replacement: `<${NEW_TAG}` })
    // 2) Close tag: replace tagName portion (skip '</' = 2 chars after closeStart).
    //    selfClosing 元素没有 close tag,跳过。
    if (!el.selfClosing && el.closeStart >= 0) {
      const closeTagNameStart = el.closeStart + 2 // skip '</'
      const closeTagNameEnd = closeTagNameStart + OLD_TAG.length
      edits.push({
        start: closeTagNameStart,
        end: closeTagNameEnd,
        replacement: NEW_TAG,
      })
    }
    changes.push(`<${OLD_TAG}> → <${NEW_TAG}>`)
  }

  if (edits.length === 0) {
    return { out: template, changed: false, changes: [] }
  }
  return { out: applyEdits(template, edits), changed: true, changes }
}
