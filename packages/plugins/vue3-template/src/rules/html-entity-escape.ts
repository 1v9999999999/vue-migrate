/**
 * html-entity-escape.ts
 *
 * iter-125: Vue 3 template parser 严格遵循 HTML 5 规范, 模板里裸 & 字符
 *   必须 entity-escape 成 &amp; (webpack/v-loader 容忍, vite 严格).
 *
 *   例子 (master 195 src/views/documentation/index.vue):
 *     <a href="https://...utm_source=vue_admin&...">...</a>
 *       → parser 报 "Element is missing end tag"
 *       → 浏览器中 & 后面需跟 entity name, 否则 & 自身被截断 attribute
 *
 *   修复: 把 <template>...</template> 里所有裸 & 转成 &amp;
 *     (保留已经 entity-escape 的: &amp; &lt; &gt; &quot; &apos; &#NNN; &#xHHH;)
 */
import type { FileNode } from '@vue-migrate/core'

const BARE_AMP = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g

export function escapeHtmlEntitiesInTemplates(file: FileNode): { changed: boolean; count: number } {
  if (file.kind !== 'vue') return { changed: false, count: 0 }
  const source = file.source
  // 只处理 <template>...</template> 块, 跳过 <script> 里的 (JS 的 & 是合法的)
  const re = /<template>([\s\S]*?)<\/template>/g
  let changed = false
  let count = 0
  const newSource = source.replace(re, (_m, body) => {
    const newBody = body.replace(BARE_AMP, () => {
      count++
      changed = true
      return '&amp;'
    })
    return `<template>${newBody}</template>`
  })
  if (changed) {
    file.source = newSource
    // 同步 sfc.template.content (避免后续 rule 用 stale content)
    if (file.sfc?.template) {
      const newContent = newSource.match(/<template>([\s\S]*?)<\/template>/)
      if (newContent) {
        file.sfc.template.content = newContent[1]
      }
    }
    // 同步 sfc.template.loc (如果存在, 调整 length)
    if (file.sfc?.template?.loc && file.sfc.template.loc.end) {
      // end.offset 在 source 内, 需要 recalc — 这里只刷新 length 增量
      // 实际更稳妥: 让 downstream rule re-derive template
    }
  }
  return { changed, count }
}
