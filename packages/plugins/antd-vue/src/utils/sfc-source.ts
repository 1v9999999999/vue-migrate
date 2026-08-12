/**
 * SFC 源改写工具 (iter-121, antd-vue 自带的精简版)
 */

import type { FileNode } from '@vue-migrate/core'

export interface RewriteResult {
  changed: boolean
  message: string
}

export function replaceTemplateContent(
  file: FileNode,
  newContent: string,
  message = 'rewrote template content',
): RewriteResult {
  if (file.kind !== 'vue') {
    return { changed: false, message: '' }
  }

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
