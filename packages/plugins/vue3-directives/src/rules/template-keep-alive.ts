/**
 * 规则：<keep-alive :include="'a,b,c'"> → 数组
 *
 * Vue2 接受 :include="'A,B,C'"（字符串，逗号分隔）
 * Vue3 接受 :include="['A','B','C']"（数组）
 *
 * 自动转换策略：
 *   - 匹配 `<keep-alive ... :include="'a,b,c'" ...>` 这种形式
 *   - 把单引号字符串里的内容拆成数组
 *   - 拆不出来的（包含复杂表达式）就只警告
 */

import { transformTemplate } from '../utils'

const TAG_RE = /<keep-alive\b([^>]*?)\/?>/gi

/**
 * 把一个 JS 字符串字面量解出来（去掉外层引号）
 * 支持 'foo' / "foo" / 嵌套引号
 * 返回 string content（不含外层引号），或 null
 */
function unquoteStringLiteral(s: string): string | null {
  if (s.length >= 2) {
    const first = s[0]
    const last = s[s.length - 1]
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      return s.slice(1, -1)
    }
  }
  return null
}

/**
 * 解析属性里 :include="..." 的 value。
 * 返回 { rawValue, isStringLiteral, stringValue }
 *   - rawValue: 属性值字符串（带引号）
 *   - isStringLiteral: true 表示 value 整体就是字符串字面量（'xxx' 或 "xxx"）
 *   - stringValue: 如果是字符串字面量，提取的内容（不含引号）
 *
 * rawValue 是 attribute 里的整个 JS 表达式字符串。
 * 我们要区分：
 *   - 'a,b,c'    — 单引号字符串字面量（→ isStringLiteral）
 *   - "a,b,c"    — 双引号字符串字面量（→ isStringLiteral）
 *   - 'a,b', "x" — 字符串字面量里面套了引号的情况
 *   - ['A','B']  — 数组字面量（→ NOT a string literal, 跳过）
 *   - someVar    — 变量（→ 跳过）
 */
function parseIncludeFromAttrs(attrText: string): { rawValue: string; isStringLiteral: boolean; stringValue: string | null } | null {
  const m = attrText.match(/(?:^|\s)(?::|v-bind:)include\s*=\s*(.+?)\s*$/i)
  if (!m) return null
  const rawValue = m[1].trim()

  // 1) 整体是单引号字符串
  const single = rawValue.match(/^'((?:[^'\\]|\\.)*)'$/)
  if (single) {
    return { rawValue, isStringLiteral: true, stringValue: single[1] }
  }
  // 2) 整体是双引号字符串
  const dbl = rawValue.match(/^"((?:[^"\\]|\\.)*)"$/)
  if (dbl) {
    // 内容本身如果也是个字符串字面量，递归解出来
    const inner = dbl[1]
    const innerUnquoted = unquoteStringLiteral(inner)
    if (innerUnquoted !== null) {
      // 内容确实是个字符串字面量 → 整个表达式是字符串
      return { rawValue, isStringLiteral: true, stringValue: innerUnquoted }
    }
    // 内容是数组 / 变量 / 表达式 —— 不是字符串
    return { rawValue, isStringLiteral: false, stringValue: null }
  }
  // 3) 其他（数组/变量）——不处理
  return { rawValue, isStringLiteral: false, stringValue: null }
}

function rewriteAttrs(attrText: string, newExpr: string): string {
  // 把 :include="..." (整体) 替换成 :include="<newExpr>"
  return attrText.replace(
    /((?:^|\s)(?::|v-bind:)include\s*=\s*).+$/i,
    (full, prefix) => `${prefix}"${newExpr}"`,
  )
}

export function applyKeepAliveIncludeArray(ctx: any): void {
  transformTemplate(
    ctx.file,
    (template) => {
      let changed = false
      const reviewItems: string[] = []

      const out = template.replace(TAG_RE, (full, attrs) => {
        const parsed = parseIncludeFromAttrs(attrs)
        if (!parsed) return full

        if (parsed.isStringLiteral && parsed.stringValue !== null) {
          const names = parsed.stringValue
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (names.length === 0) return full
          const arr = names.map((n) => `'${n.replace(/'/g, "\\'")}'`).join(', ')
          const newAttrs = rewriteAttrs(attrs, `[${arr}]`)
          changed = true
          return `<keep-alive${newAttrs ? ' ' + newAttrs.replace(/^\s+/, '') : ''}${full.endsWith('/>') ? ' />' : '>'}`
        }

        // 不是字符串字面量：可能本来就是数组 / 动态表达式；提示但不强行改
        reviewItems.push(
          `<keep-alive :include="${parsed.rawValue}"> — Vue3 requires an array of names, not a string. Please convert manually if it's a string.`,
        )
        changed = true
        return full
      })

      return { out, changed, reviewItems }
    },
    ctx.utils,
    'keep-alive :include converted to array',
  )
}
