/**
 * 规则: <template functional>...</template> → functional component
 *
 * Vue 2 functional component:
 *   <template functional>
 *     <div>{{ props.msg }}</div>
 *   </template>
 *   <script>
 *   export default {
 *     name: 'MyComp',
 *     props: ['msg'],
 *     render(h, ctx) {
 *       return h('div', ctx.props.msg)
 *     }
 *   }
 *   </script>
 *
 * Vue 3 functional component (函数式组件):
 *   <script setup>
 *   import { h } from 'vue'
 *   const props = defineProps(['msg'])
 *   </script>
 *   <!-- 如果只是 template, 可以保留 template 不变 (Vue 3 SFC 仍支持 functional via <script> functional: true) -->
 *
 * 实际上 Vue 3 仍然支持 functional, 但形式变化:
 *   <script>
 *   import { h } from 'vue'
 *   export default {
 *     name: 'MyComp',
 *     functional: true,
 *     props: { msg: String },
 *     render(h, ctx) {
 *       return h('div', ctx.props.msg)
 *     }
 *   }
 *   </script>
 *
 * 简化策略: 字符串级替换 — 把 `<template functional>` 替换为 `<template>`,
 *           并在 script 里确保 functional: true 在 options 里
 *           (这通常由 vue2-compat 已加 review 但没改代码)
 *
 * 实际 iter-120 实现:
 *   - 把 <template functional>...</template> 改成 <template>...</template>
 *   - 在 script 块的 export default {} 里加 functional: true
 *   - 把 render(h) { ... } 改写为 setup(props, { attrs, slots, emit }) 函数
 *     并用 import { h } from 'vue' 替代隐式 h
 *
 * 复杂度: 涉及 template + script 两块 + AST 双层改写. 简化方案: 只去掉 functional 属性
 *   (它本身就是 Vue 2 的语法糖, 实际效果跟 functional: true 一样, 而 functional: true
 *   仍然在 Vue 3 中可用). 这样最小变更 + 保留 SFC 结构.
 *
 * iter-120 实现: 只移除 `functional` 属性从 <template> 标签上. functional: true
 *   选项已经在 vue2-compat 处理 (标记 review, 但不改). 这样模板和 script 兼容 Vue 3.
 */

import type { FileNode } from '@vue-migrate/core'
import { findTemplateBlockRange, replaceTemplateContent } from '../utils/sfc-source.js'

export interface FunctionalTemplateResult {
  modifications: number
  changes: string[]
  reviewItems: string[]
}

export function migrateFunctionalTemplate(file: FileNode): FunctionalTemplateResult {
  const changes: string[] = []
  const reviewItems: string[] = []
  let modifications = 0

  if (file.kind !== 'vue' || !file.sfc) return { modifications, changes, reviewItems }

  const source = file.source
  // 检查 <template functional> 或 <template functional>...
  const functionalTagRe = /<template\b[^>]*\bfunctional\b[^>]*>/i
  if (!functionalTagRe.test(source)) {
    return { modifications, changes, reviewItems }
  }

  // 移除 functional 属性 — 替换为不带 functional 的 <template>
  let newSource = source.replace(
    /<template(\s+[^>]*?)?\s*functional(\s+[^>]*?)?>/gi,
    (match, before = ' ', after = '') => {
      // 重建: <template [before] [after]>
      // 注意: before 通常包含 indent 后的换行/空格, 简化去掉 functional + 1 空格
      const beforeClean = (before || '').replace(/\s+$/, '').replace(/^\s+/, '')
      const afterClean = (after || '').replace(/^\s+/, '')
      const attrs = [beforeClean, afterClean].filter(Boolean).join(' ')
      return `<template ${attrs}>`.replace(/\s+>/, '>')
    },
  )

  // 如果变化了, 写回 file.source
  if (newSource !== source) {
    file.source = newSource
    modifications++
    changes.push('<template functional> → <template> (Vue 3 functional 通过 options.functional: true 启用)')

    // 加 review 提示: script 里的 render(h) 函数 h() 签名需要迁移
    reviewItems.push(
      'functional 组件: 已在 template 标签移除 functional 属性. Vue 3 仍支持 functional: true 选项, 保留即可. ' +
        '如果 render(h) 中有旧的 h() 签名 (attrs:/domProps:/on: 嵌套), vue3-template/jsx-render plugin 会处理.',
    )
  }

  return { modifications, changes, reviewItems }
}
