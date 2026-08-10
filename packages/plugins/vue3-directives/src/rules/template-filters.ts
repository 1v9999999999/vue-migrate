/**
 * 规则：模板里的 filter 管道 → 函数调用
 *
 *   {{ x | filterA | filterB(arg) }}   →  {{ filterB(filterA(x), arg) }}
 *   {{ x | filter }}                    →  {{ filter(x) }}
 *   {{ x | filterA(a, b) }}             →  {{ filterA(x, a, b) }}
 *
 * 模板处理通过 transformTemplate 完成，core codegen 不会重写 template。
 *
 * 已知限制：
 *   - 只处理 {{ ... }} 内的表达式
 *   - filter 名只允许标识符；遇到含 . / ( / 运算符的复杂场景会跳过
 */

import type { TransformContext } from '@vue-migrate/core'
import { transformTemplate } from '../utils'

/**
 * 解析 `x | a | b(arg1, arg2)` 为：
 *   { arg: 'x', pipes: [{ name: 'a', args: [] }, { name: 'b', args: ['arg1','arg2'] }] }
 */
function parseFilterChain(expr: string): { arg: string; pipes: { name: string; args: string }[] } | null {
  const parts = expr.split('|').map((s) => s.trim())
  if (parts.length < 2) return null
  const arg = parts[0]
  const pipes: { name: string; args: string }[] = []
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    const m = part.match(/^([A-Za-z_$][\w$]*)\s*(?:\((.*)\))?$/)
    if (!m) return null
    const name = m[1]
    const argsRaw = (m[2] || '').trim()
    pipes.push({ name, args: argsRaw })
  }
  return { arg, pipes }
}

/** 把 filter 链重写成嵌套调用 */
function rewriteChain(arg: string, pipes: { name: string; args: string }[]): string {
  let acc = arg
  for (const p of pipes) {
    if (p.args) {
      acc = `${p.name}(${acc}, ${p.args})`
    } else {
      acc = `${p.name}(${acc})`
    }
  }
  return acc
}

const MUSTACHE = /\{\{\s*([^{}]+?)\s*\}\}/g

function hasFilterPipe(expr: string): boolean {
  let inStr: string | null = null
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i]
    if (inStr) {
      if (ch === inStr && expr[i - 1] !== '\\') inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '|') {
      const rest = expr.slice(i + 1).trimStart()
      if (/^[A-Za-z_$]/.test(rest)) return true
    }
  }
  return false
}

export function applyTemplateFilterRewrite(ctx: TransformContext): void {
  transformTemplate(
    ctx.file,
    (template) => {
      let out = ''
      let lastIndex = 0
      let changed = false
      const reviewItems: string[] = []

      MUSTACHE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = MUSTACHE.exec(template)) !== null) {
        const inner = m[1]
        if (!hasFilterPipe(inner)) continue
        const parsed = parseFilterChain(inner)
        if (!parsed) continue

        const rewritten = rewriteChain(parsed.arg, parsed.pipes)
        out += template.slice(lastIndex, m.index) + `{{ ${rewritten} }}`
        lastIndex = m.index + m[0].length
        changed = true
        reviewItems.push(
          `template filter: {{ ${inner} }} → {{ ${rewritten} }} (ensure filter functions are available as methods or imports in <script setup>)`,
        )
      }

      if (!changed) return { out: template, changed: false }
      out += template.slice(lastIndex)
      return { out, changed, reviewItems }
    },
    ctx.utils,
    'template filters rewritten',
  )
}
