/**
 * 规则：v-if + v-for 同节点检测与拆分
 *
 * Vue2 行为：v-for 优先级高（v-for 包住 v-if）
 * Vue3 行为：v-if 优先级高（v-if 不会渲染未通过检查的项）
 *
 * 简单实现：检测同一节点上同时有 v-if 和 v-for，输出 manualReview 提示。
 * 自动拆分复杂（涉及 template wrapper 引入、变量作用域），所以只警告。
 */

import { findTemplateRange, transformTemplate } from '../utils'

const TAG_RE = /<([A-Za-z][\w-]*)([^>]*?)\/?>/g
const ATTR_RE = /\s(v-if|v-for)(?:=("[^"]*"|'[^']*'|[^\s"'<>]+))?/g

export function applyVIfVForWarning(ctx: any): void {
  transformTemplate(
    ctx.file,
    (template) => {
      const reviewItems: string[] = []
      let changed = false

      // 不修改文件内容，只收集 review
      let m: RegExpExecArray | null
      TAG_RE.lastIndex = 0
      while ((m = TAG_RE.exec(template)) !== null) {
        const full = m[0]
        const attrs = m[2]
        let hasIf = false
        let hasFor = false
        const a = [...attrs.matchAll(ATTR_RE)]
        for (const am of a) {
          if (am[1] === 'v-if') hasIf = true
          if (am[1] === 'v-for') hasFor = true
        }
        if (hasIf && hasFor) {
          reviewItems.push(
            `v-if + v-for on the same element (${full.slice(0, 60)}...) — Vue2 prioritized v-for, Vue3 prioritizes v-if. Please split into <template v-if> wrapper.`,
          )
          changed = true // 标记 changed 以便 markChanged 触发
        }
      }

      return { out: template, changed, reviewItems }
    },
    ctx.utils,
    'v-if + v-for coexistence warned',
  )
}
