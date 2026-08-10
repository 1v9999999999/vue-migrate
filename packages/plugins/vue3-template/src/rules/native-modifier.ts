/**
 * 规则 2.11: 移除 .native 修饰符
 *
 * Vue2: @click.native / @keyup.enter.native / v-on:click.native / @click.native.prevent
 *   在自定义组件上，`.native` 表示监听原生 DOM 事件
 *
 * Vue3: 移除 .native，因为根元素继承的原生事件默认就是原生的
 *   @click / @keyup.enter / v-on:click 即可
 *   .prevent 仍然保留
 *
 * 实现：扫描所有 directive attributes，移除 .native 修饰符
 *       使用 applyEdits 自动从右到左处理 offset 累加问题
 */

import {
  scanAllElements,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { applyEdits, type TextEdit } from '../utils/template-editor.js'

export interface NativeModifierResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function removeNativeModifier(template: string): NativeModifierResult {
  const all = scanAllElements(template)
  // 收集所有带 .native 修饰符的 directive attr
  // 注意：直接匹配 raw 文本，因为 splitDirective 工具函数对 @event.modifier
  //       解析有 bug（丢失修饰符），所以这里用 rawName 自己检查
  const targets: Array<{ el: ElementMatch; attr: ParsedAttr }> = []
  for (const el of all) {
    for (const a of el.attrs) {
      if (!a.isDirective) continue
      const hasNativeInMods = a.modifiers.includes('native')
      const hasNativeInRaw =
        /\.native(?=[\s./>="']|$)/.test(a.rawName) ||
        /\.native(?=[\s./>="']|$)/.test(a.raw)
      if (hasNativeInMods || hasNativeInRaw) {
        targets.push({ el, attr: a })
      }
    }
  }
  if (targets.length === 0) {
    return { out: template, changed: false, changes: [], reviewItems: [] }
  }

  const changes: string[] = []
  const reviewItems: string[] = []
  const edits: TextEdit[] = []

  for (const { el, attr } of targets) {
    const newRaw = removeNativeFromRaw(attr.raw)
    if (newRaw === attr.raw) continue
    const absStart = el.tagNameEnd + attr.start
    const absEnd = el.tagNameEnd + attr.end
    edits.push({
      start: absStart,
      end: absEnd,
      replacement: newRaw,
    })
    changes.push(`${attr.raw} → ${newRaw}`)
  }

  if (edits.length === 0) {
    return { out: template, changed: false, changes, reviewItems }
  }
  reviewItems.push(
    '已移除模板中的 .native 修饰符（Vue3 中根元素继承原生事件默认就是原生的）。',
  )

  return { out: applyEdits(template, edits), changed: true, changes, reviewItems }
}

function removeNativeFromRaw(raw: string): string {
  let s = raw
  // 模式 1: .native. (后面还有修饰符)  → 保留后面的修饰符
  s = s.replace(/\.native\./g, '.')
  // 模式 2: .native 在末尾（下一个字符是空白 / > / = / 引号 / 字符串结束） → 删掉
  s = s.replace(/\.native(?=[\s>/="']|$)/g, '')
  return s
}
