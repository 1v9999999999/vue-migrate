/**
 * 规则：`:value="x" @input="y"` → `v-model="x"`（或 `v-model="y"`）
 *
 * 经典 Vue2 表单写法：
 *   <input :value="msg" @input="msg = $event.target.value">
 *
 * 转成：
 *   <input v-model="msg">
 *
 * 自动转换条件：
 *   - 同节点同时有 :value (或 v-bind:value) 和 @input (或 v-on:input)
 *   - 替换后保留 v-model 表达式（取 :value 的）
 *
 * 已知限制：
 *   - 仅处理最常见的 case
 *   - 不处理 :value 用三元 / 函数 / 表达式复杂情况
 *   - 不处理 @input 表达式里用了 $event 但不是 target.value 的情况
 */

import { transformTemplate } from '../utils'

const TAG_RE = /<([A-Za-z][\w-]*)([^>]*?)\/?>/g

type ParsedAttrs = {
  hasValue: boolean
  valueExpr: string | null
  hasInput: boolean
  inputExpr: string | null
  hasVModel: boolean
}

function parseAttrs(attrText: string): ParsedAttrs {
  const result: ParsedAttrs = {
    hasValue: false,
    valueExpr: null,
    hasInput: false,
    inputExpr: null,
    hasVModel: false,
  }

  // 找 :value 或 v-bind:value
  const valueRe = /(?:^|\s)(?::|v-bind:)value\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^\s"'`<>=]+))/i
  const vm = attrText.match(valueRe)
  if (vm) {
    result.hasValue = true
    result.valueExpr = vm[1] ?? vm[2] ?? vm[3] ?? ''
  }

  // 找 @input 或 v-on:input
  const inputRe = /(?:^|\s)(?:@|v-on:)input\s*=\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/i
  const im = attrText.match(inputRe)
  if (im) {
    result.hasInput = true
    result.inputExpr = im[1] ?? im[2] ?? ''
  }
  if (/(?:^|\s)v-model(?:\s|=|$)/.test(attrText)) {
    result.hasVModel = true
  }
  return result
}

/** 把 :value="x" 和 @input="..." 从 attrs 里剥离出来 */
function stripAttrs(attrText: string): string {
  let out = attrText
  out = out.replace(/(?:^|\s)(?::|v-bind:)value\s*=\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s"'`<>=]+)/gi, ' ')
  out = out.replace(/(?:^|\s)(?:@|v-on:)input\s*=\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi, ' ')
  return out.replace(/\s+/g, ' ').trim()
}

export function applyValueInputToVModel(ctx: any): void {
  transformTemplate(
    ctx.file,
    (template) => {
      let changed = false
      const reviewItems: string[] = []

      const out = template.replace(TAG_RE, (full, tag, attrs) => {
        const parsed = parseAttrs(attrs)
        if (parsed.hasVModel) return full
        if (!parsed.hasValue || !parsed.hasInput) return full
        if (!parsed.valueExpr) return full

        // 简单判断：@input 是否就是赋值表达式？
        const inputExpr = parsed.inputExpr || ''
        // 比如: msg = $event.target.value 或 msg = $event
        // 我们的 v-model 表达式取 :value 的
        const vmodelExpr = parsed.valueExpr
        const cleanAttrs = stripAttrs(attrs)
        const sep = cleanAttrs ? ' ' : ''
        const selfClose = full.endsWith('/>') ? ' />' : '>'
        changed = true
        reviewItems.push(
          `:value + @input on <${tag}> replaced with v-model="${vmodelExpr}" — please verify input handler (${
            inputExpr.length > 30 ? inputExpr.slice(0, 30) + '...' : inputExpr
          }) is just an assignment. Vue3 注意事项: 1) v-model 默认绑定到 modelValue + emit update:modelValue, 自定义组件需 defineModel 或手动 expose modelValue/update:modelValue; 2) input 元素 $event.target.value 用法保持兼容, 但 select/checkbox/radio 行为有差异; 3) 修饰符 .lazy/.number/.trim 在 v-model 上仍然有效`,
        )
        return `<${tag}${sep}${cleanAttrs} v-model="${vmodelExpr}"${selfClose}`
      })

      return { out, changed, reviewItems }
    },
    ctx.utils,
    ':value + @input → v-model',
  )
}
