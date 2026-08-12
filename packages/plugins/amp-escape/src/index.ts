/**
 * @vue-migrate/plugin-amp-escape
 *
 * iter-125: 把 .vue 模板里裸 & 转义为 &amp;
 *
 *   Vue 3 template parser 严格遵循 HTML 5 规范, 模板里裸 & 字符必须 entity-escape 成 &amp;
 *   (webpack/v-loader 容忍, vite 严格 → "[vite:vue] Element is missing end tag")
 *
 *   单独成 plugin (priority 99, 在 codegen 之前最后跑), 不依赖 scriptAst,
 *   可处理纯 template file (无 <script> 块).
 */
import { registerPlugin, type TransformPlugin, type TransformContext } from '@vue-migrate/core'

const BARE_AMP = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g

function escapeAmpInTemplates(file: any): { changed: boolean; count: number } {
  if (file.kind !== 'vue') return { changed: false, count: 0 }
  const source: string = file.source
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
    // 同步 sfc.template.content
    if (file.sfc?.template) {
      const m = newSource.match(/<template>([\s\S]*?)<\/template>/)
      if (m) file.sfc.template.content = m[1]
    }
  }
  return { changed, count }
}

const plugin: TransformPlugin = {
  name: 'amp-escape',
  description: 'Escape bare & to &amp; in .vue templates (HTML 5 strict, Vite requires).',
  priority: 99,
  fileKinds: ['vue'],
  // iter-125: 标记 templateOnly, 允许跑在无 <script> 块的 .vue (e.g. <template> only)
  templateOnly: true,
  transform(ctx: TransformContext) {
    const r = escapeAmpInTemplates(ctx.file)
    if (r.changed) {
      ctx.utils.markChanged(`amp-escape: ${r.count} 处 & → &amp;`)
    }
  },
}

registerPlugin(plugin)
export default plugin
