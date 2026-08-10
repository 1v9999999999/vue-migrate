/**
 * 规则 2.4: v-bind.sync="x" → v-model:xxx
 *
 * Vue2 写法：
 *   <my-dialog v-bind.sync="dialog" />     // 整个对象同步
 *   <my-dialog v-bind.sync="title" />     // 单个 prop
 *   <my-dialog v-bind.sync="{ a, b }" />  // 字面量对象，需要多个 v-model
 *
 * Vue3 写法：
 *   1. 单个标识符：<my-dialog v-model:dialog="dialog" />   // 直接转
 *   2. 简单属性：<my-dialog v-model:a="a" v-model:b="b" />  // 拆分（最佳猜测）
 *   3. 复杂表达式：标 manual review
 *
 * 简化策略（MVP）：
 *   - 看到 v-bind.sync="<identifier>" 就转成 v-model:<identifier>="<identifier>"
 *   - 看到 v-bind.sync="<object literal>" 就警告 + 标 review
 *   - 其他情况：标 review
 *
 * 实现：在扫描到的 element 上做 attribute 替换，直接修改原 template。
 */

import {
  scanAllElements,
  findDirective,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'

export interface VbindSyncResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function rewriteVbindSync(template: string): VbindSyncResult {
  const all = scanAllElements(template)
  // 找出所有带 v-bind.sync 的元素（一个元素可能有多个 v-bind.sync）
  const targets: Array<{ el: ElementMatch; attr: ParsedAttr }> = []
  for (const el of all) {
    const attrs = el.attrs.filter(a => a.isDirective && a.name === 'bind' && a.modifiers.includes('sync'))
    for (const attr of attrs) {
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
    const rawValue = typeof attr.value === 'string' ? attr.value.trim() : ''
    // attr.start/end 是相对 attrText（即 template.slice(tagNameEnd, openEnd)）的
    // 需要换算到 template 的 offset
    const attrTextStartInTpl = el.tagNameEnd
    const absStart = attrTextStartInTpl + attr.start
    const absEnd = attrTextStartInTpl + attr.end

    // 分析 value
    const transformed = transformVbindSyncValue(rawValue)
    if (transformed.kind === 'simple') {
      // 直接替换为 v-model:<x>="<x>"
      const newAttr = `v-model:${transformed.prop}="${transformed.prop}"`
      out = out.slice(0, absStart) + newAttr + out.slice(absEnd)
      changes.push(`v-bind.sync="${rawValue}" → v-model:${transformed.prop}="${transformed.prop}"`)
    } else if (transformed.kind === 'object-literal') {
      // 尝试展开 { a, b, c } 成多个 v-model
      const props = parseObjectLiteralKeys(rawValue)
      if (props.length > 0) {
        const vmodels = props
          .map((p) => `v-model:${p}="${p}"`)
          .join(' ')
        out = out.slice(0, absStart) + vmodels + out.slice(absEnd)
        changes.push(
          `v-bind.sync="{ ${props.join(', ')} }" → ${vmodels}`,
        )
      } else {
        // 解析不出来，标 review
        reviewItems.push(
          `v-bind.sync="${rawValue}" 需手动展开为多个 v-model:xxx="xxx"`,
        )
      }
    } else {
      reviewItems.push(
        `v-bind.sync="${rawValue}" 需手动转换为 v-model:xxx 形式`,
      )
    }
  }

  return {
    out,
    changed: changes.length > 0 || reviewItems.length > 0,
    changes,
    reviewItems,
  }
}

type SyncValue =
  | { kind: 'simple'; prop: string }
  | { kind: 'object-literal'; raw: string }
  | { kind: 'complex'; raw: string }

function transformVbindSyncValue(raw: string): SyncValue {
  // 简单 identifier: a-zA-Z_$ 开头，可有 [a-zA-Z0-9_$]
  // 不允许 [.] —— 因为 form.data 之类的成员访问无法推断 prop 名
  if (/^[a-zA-Z_$][\w$]*$/.test(raw)) {
    return { kind: 'simple', prop: raw }
  }
  // 对象字面量: { ... } —— 但要排除包含函数调用等的
  if (/^\{[\s\S]*\}$/.test(raw) && !/[()\[]/.test(raw)) {
    return { kind: 'object-literal', raw }
  }
  return { kind: 'complex', raw }
}

/** 粗略解析 { a, b: 1, c } 中的 key 列表。 */
function parseObjectLiteralKeys(raw: string): string[] {
  const inner = raw.slice(1, -1).trim()
  if (!inner) return []
  // 简单切分（按逗号），但要忽略嵌套
  const keys: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '{' || ch === '[' || ch === '(') depth++
    else if (ch === '}' || ch === ']' || ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      const part = inner.slice(start, i).trim()
      const key = extractKeyFromPair(part)
      if (key) keys.push(key)
      start = i + 1
    }
  }
  const last = inner.slice(start).trim()
  if (last) {
    const key = extractKeyFromPair(last)
    if (key) keys.push(key)
  }
  return keys
}

function extractKeyFromPair(part: string): string | null {
  if (!part) return null
  // "a" → a
  // "a: 1" → a
  // "a: b" → a
  const colonIdx = part.indexOf(':')
  const rawKey = colonIdx < 0 ? part : part.slice(0, colonIdx)
  const key = rawKey.trim()
  if (/^[a-zA-Z_$][\w$]*$/.test(key)) return key
  // 字符串字面量
  const m = /^['"]([^'"]+)['"]$/.exec(key)
  if (m) return m[1]
  return null
}
