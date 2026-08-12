/**
 * SFC 源改写工具 (iter-121, i18n-migrate 自带的精简版)
 *
 * 与 elementui/vue3-template 的版本逻辑相同, 但**不依赖它们**:
 * 每个 plugin 必须 self-contained, 避免跨 plugin 依赖。
 */

import type { FileNode } from '@vue-migrate/core'

export interface RewriteResult {
  changed: boolean
  message: string
}

/**
 * 替换 .vue 文件中 <template> 块的内容 (保留外层 <template> 标签)
 */
export function replaceTemplateContent(
  file: FileNode,
  newContent: string,
  message = 'rewrote template content',
): RewriteResult {
  if (file.kind !== 'vue') {
    return { changed: false, message: '' }
  }

  // Fallback 路径
  if (!file.sfc || !file.sfc.template) {
    const range = findTemplateBlockRange(file.source)
    if (!range) return { changed: false, message: '' }
    const oldBlock = file.source.slice(range.start, range.end)
    const openEnd = oldBlock.indexOf('>')
    if (openEnd < 0) return { changed: false, message: '' }
    const openingTag = oldBlock.slice(0, openEnd + 1)
    const newBlock = openingTag + newContent + '</template>'
    if (newBlock === oldBlock) return { changed: false, message: 'no change' }

    file.source =
      file.source.slice(0, range.start) +
      newBlock +
      file.source.slice(range.end)
    return { changed: true, message }
  }

  const tpl = file.sfc.template
  if (!tpl) return { changed: false, message: '' }
  const loc = tpl.loc

  const innerContentStart = loc.start.offset
  const innerContentEnd = loc.end.offset

  const oldInnerContent = file.source.slice(innerContentStart, innerContentEnd)
  if (oldInnerContent === newContent) {
    return { changed: false, message: 'no change' }
  }

  file.source =
    file.source.slice(0, innerContentStart) +
    newContent +
    file.source.slice(innerContentEnd)

  resyncSfcBlockLocations(file)

  return { changed: true, message }
}

function resyncSfcBlockLocations(file: FileNode): void {
  if (!file.sfc) return
  const source = file.source

  if (file.sfc.template) {
    const tplRange = findTemplateBlockRange(source)
    if (tplRange) {
      const tpl = file.sfc.template
      const block = source.slice(tplRange.start, tplRange.end)
      const openEnd = block.indexOf('>')
      if (openEnd >= 0) {
        const innerStart = tplRange.start + openEnd + 1
        const innerEnd = tplRange.end - '</template>'.length
        tpl.loc.start.offset = innerStart
        tpl.loc.end.offset = innerEnd
        tpl.content = source.slice(innerStart, innerEnd)
      }
    }
  }

  const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
  if (scriptOpenMatch && scriptOpenMatch.index !== undefined) {
    const scriptOpenIdx = scriptOpenMatch.index
    const scriptCloseIdx = source.indexOf('</script>', scriptOpenIdx + scriptOpenMatch[0].length)
    if (scriptCloseIdx > 0 && file.sfc.script) {
      file.sfc.script.loc.start.offset = scriptOpenIdx + scriptOpenMatch[0].length
      file.sfc.script.loc.end.offset = scriptCloseIdx
      file.sfc.script.content = source.slice(file.sfc.script.loc.start.offset, scriptCloseIdx)
    }
  }

  const styleOpenMatch = source.match(/<style\b[^>]*>/i)
  if (styleOpenMatch && styleOpenMatch.index !== undefined && file.sfc.style) {
    const styleOpenIdx = styleOpenMatch.index
    const styleCloseIdx = source.indexOf('</style>', styleOpenIdx + styleOpenMatch[0].length)
    if (styleCloseIdx > 0) {
      file.sfc.style.loc.start.offset = styleOpenIdx + styleOpenMatch[0].length
      file.sfc.style.loc.end.offset = styleCloseIdx
    }
  }

  for (const cb of file.sfc.customBlocks || []) {
    const tag = cb.type || (cb.attrs && cb.attrs.type)
    if (!tag) continue
    const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'i')
    const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
    const openM = openRe.exec(source)
    if (openM) {
      const closeM = closeRe.exec(source)
      if (closeM) {
        cb.loc.start.offset = openM.index + openM[0].length
        cb.loc.end.offset = closeM.index
        cb.content = source.slice(cb.loc.start.offset, cb.loc.end.offset)
      }
    }
  }
}

export function findTemplateBlockRange(source: string): { start: number; end: number } | null {
  const m = source.match(/<template\b[^>]*>/i)
  if (!m || m.index === undefined) return null
  const start = m.index
  const openEnd = start + m[0].length
  let depth = 1
  let pos = openEnd
  const openRe = /<template\b[^>]*>/gi
  const closeRe = /<\/template\s*>/gi
  openRe.lastIndex = pos
  closeRe.lastIndex = pos
  while (depth > 0) {
    openRe.lastIndex = pos
    closeRe.lastIndex = pos
    const nextOpen = openRe.exec(source)
    const nextClose = closeRe.exec(source)
    if (!nextClose) return null
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++
      pos = nextOpen.index + nextOpen[0].length
    } else {
      depth--
      pos = nextClose.index + nextClose[0].length
    }
  }
  return { start, end: pos }
}
