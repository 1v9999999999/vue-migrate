/**
 * iter-121: <a-form-model> → <a-form>, <a-form-model-item> → <a-form-item>
 *
 * 1.x → 2.x 重命名, 简单 token replace
 *   - 1.x: a-form-model + a-form-model-item
 *   - 2.x: a-form + a-form-item
 */

import type { ElementLite } from '../utils/template-scanner.js'

export interface FormModelResult {
  out: string
  changed: boolean
  count: number
}

/** tag 重命名映射 */
const RENAMES: Record<string, string> = {
  'a-form-model': 'a-form',
  'a-form-model-item': 'a-form-item',
}

/**
 * 重写 template 字符串: a-form-model 系列 → a-form 系列 (含开闭标签)
 */
export function renameFormModel(template: string, elements: ElementLite[]): FormModelResult {
  let out = template
  let count = 0

  type Edit = { start: number; end: number; replacement: string }
  const edits: Edit[] = []

  for (const el of elements) {
    const tagLower = el.tagName.toLowerCase()
    const newTag = RENAMES[tagLower]
    if (!newTag) continue
    // 开标签
    edits.push({
      start: el.openStart,
      end: el.openStart + 1 + el.tagName.length,
      replacement: '<' + newTag,
    })
    // 闭标签
    if (el.closeStart >= 0) {
      edits.push({
        start: el.closeStart,
        end: el.closeStart + 2 + el.tagName.length,
        replacement: '</' + newTag,
      })
    }
    count++
  }

  if (count === 0) return { out, changed: false, count: 0 }

  edits.sort((a, b) => b.start - a.start)
  for (const e of edits) {
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end)
  }

  return { out, changed: true, count }
}
