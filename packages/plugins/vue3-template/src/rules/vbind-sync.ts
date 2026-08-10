/**
 * 规则 2.4: v-bind.sync="x" → v-model:xxx
 *
 * Vue2 写法：
 *   <my-dialog v-bind.sync="dialog" />     // 整个对象同步
 *   <my-dialog v-bind.sync="title" />     // 单个 prop
 *   <my-dialog v-bind.sync="{ a, b }" />  // 字面量对象，需要多个 v-model
 *
 * Vue3 写法：
 *   1. 单个标识符：<my-dialog v-model:dialog="dialog" />
 *   2. 简单属性：<my-dialog v-model:a="a" v-model:b="b" />
 *   3. 复杂表达式：标 manual review
 *
 * 实现：使用 template-editor 的 replaceAttribute / applyEdits，
 * 避免手写 absStart/absEnd 换算。
 */

import {
  scanAllElements,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { applyEdits, type TextEdit } from '../utils/template-editor.js'

export interface VbindSyncResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

type SyncValue =
  | { kind: 'simple'; prop: string }
  | { kind: 'object-literal'; raw: string }
  | { kind: 'complex'; raw: string }

export function rewriteVbindSync(template: string): VbindSyncResult {
  const all = scanAllElements(template)
  // 收集每个 (element, attr) target，按 attr 绝对 offset 升序
  const targets: Array<{ el: ElementMatch; attr: ParsedAttr }> = []
  for (const el of all) {
    for (const a of el.attrs) {
      if (a.isDirective && a.name === 'bind' && a.modifiers.includes('sync')) {
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

  for (const { attr } of targets) {
    const rawValue = typeof attr.value === 'string' ? attr.value.trim() : ''
    const transformed = transformVbindSyncValue(rawValue)
    if (transformed.kind === 'simple') {
      const newAttr = `v-model:${transformed.prop}="${transformed.prop}"`
      edits.push({
        start: attr.start,
        end: attr.end,
        replacement: newAttr,
      })
      changes.push(
        `v-bind.sync="${rawValue}" → v-model:${transformed.prop}="${transformed.prop}"`,
      )
    } else if (transformed.kind === 'object-literal') {
      const props = parseObjectLiteralKeys(rawValue)
      if (props.length > 0) {
        const vmodels = props.map((p) => `v-model:${p}="${p}"`).join(' ')
        edits.push({ start: attr.start, end: attr.end, replacement: vmodels })
        changes.push(
          `v-bind.sync="{ ${props.join(', ')} }" → ${vmodels}`,
        )
      } else {
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

  if (edits.length === 0) {
    return { out: template, changed: true, changes, reviewItems }
  }

  // applyEdits 处理的是 attribute text 内的相对 offset（attr.start/end 已经是
  // 相对 attrText 的），所以我们需要把 edits 转换到 template 绝对 offset。
  // 但我们没有存 el 的引用。最简单的做法：传 attr.start/end 到 applyEdits 时，
  // 先把 target 重新组织成 [{el, attr, edit}]，对每个 edit 加上 el.tagNameEnd。
  // 不过 applyEdits 的接口是 [start, end)，所以我们直接用闭包构造：
  const allEdits: TextEdit[] = []
  for (let i = 0; i < edits.length; i++) {
    const e = edits[i]
    const t = targets[i]
    allEdits.push({
      start: t.el.tagNameEnd + e.start,
      end: t.el.tagNameEnd + e.end,
      replacement: e.replacement,
    })
  }

  return {
    out: applyEdits(template, allEdits),
    changed: true,
    changes,
    reviewItems,
  }
}

function transformVbindSyncValue(raw: string): SyncValue {
  if (/^[a-zA-Z_$][\w$]*$/.test(raw)) {
    return { kind: 'simple', prop: raw }
  }
  if (/^\{[\s\S]*\}$/.test(raw) && !/[()\[]/.test(raw)) {
    return { kind: 'object-literal', raw }
  }
  return { kind: 'complex', raw }
}

function parseObjectLiteralKeys(raw: string): string[] {
  const inner = raw.slice(1, -1).trim()
  if (!inner) return []
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
  const colonIdx = part.indexOf(':')
  const rawKey = colonIdx < 0 ? part : part.slice(0, colonIdx)
  const key = rawKey.trim()
  if (/^[a-zA-Z_$][\w$]*$/.test(key)) return key
  const m = /^['"]([^'"]+)['"]$/.exec(key)
  if (m) return m[1]
  return null
}
