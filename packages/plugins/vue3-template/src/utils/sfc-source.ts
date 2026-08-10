/**
 * SFC 源改写工具
 *
 * 问题：core 的 codegen 只重写 script 块，template 原样保留。
 *       所以我必须在插件里重写整个 file.source，然后**让 codegen
 *       仍然能找到正确的 script 位置**。
 *
 * 策略：
 *   1. 在原始 source 上找到 <template>...</template> 块的起止 offset
 *      （直接用 file.sfc.template.loc，它在 scanner 阶段已经算好）
 *   2. 用新的 template 内容替换掉 source 中的 [start, end) 切片
 *   3. 调整所有后续 block（script / style / customBlocks）的 offset
 *   4. 更新 file.sfc.template.content 和 .loc.end.offset
 *
 * 这样后续的 codegen 用 slice(start, end) 替换 script 时不会出错。
 *
 * Fallback：当 file.sfc 为 undefined（@vue/compiler-sfc parse 失败）时，
 *          用正则定位 template 块。codegen 走 file.source 原样返回的路径，
 *          所以不调整 offset。
 */

import type { FileNode } from '@vue-migrate/core'

export interface RewriteResult {
  /** 是否有变化 */
  changed: boolean
  /** 变化描述（短） */
  message: string
}

/**
 * 替换 .vue 文件中 <template> 块的内容（保留外层 <template ...> 标签和属性）。
 * 后续 block 的 offset 会被自动调整。
 *
 * 关键：每次调用都重新从 file.source 算 SFC 块位置（用 resyncSfcBlockLocations），
 * 避免多次调用时 += delta 累加导致偏移。
 */
export function replaceTemplateContent(
  file: FileNode,
  newContent: string,
  message = 'rewrote template content',
): RewriteResult {
  if (file.kind !== 'vue') {
    return { changed: false, message: '' }
  }

  // Fallback 路径：file.sfc 缺失
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

  const sfc = file.sfc
  const tpl = sfc.template
  if (!tpl) return { changed: false, message: '' }
  const loc = tpl.loc

  const innerContentStart = loc.start.offset
  const innerContentEnd = loc.end.offset

  const oldInnerContent = file.source.slice(innerContentStart, innerContentEnd)
  if (oldInnerContent === newContent) {
    return { changed: false, message: 'no change' }
  }

  // 替换 inner content
  file.source =
    file.source.slice(0, innerContentStart) +
    newContent +
    file.source.slice(innerContentEnd)

  // **关键修复**：不再用 += delta 累加，直接重新同步所有 SFC 块位置
  resyncSfcBlockLocations(file)

  return { changed: true, message }
}

/**
 * 重新从 file.source 同步所有 SFC 块（template/script/style/customBlocks）的 loc。
 * 不用累加 delta，直接从最新 source 算绝对位置。
 */
function resyncSfcBlockLocations(file: FileNode): void {
  if (!file.sfc) return
  const source = file.source

  // 1. template
  if (file.sfc.template) {
    const tplRange = findTemplateBlockRange(source)
    if (tplRange) {
      const tpl = file.sfc.template
      // 提取 inner content 范围（剥外层 <template> 和 </template>）
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

  // 2. script / scriptSetup
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

  // 3. style
  const styleOpenMatch = source.match(/<style\b[^>]*>/i)
  if (styleOpenMatch && styleOpenMatch.index !== undefined && file.sfc.style) {
    const styleOpenIdx = styleOpenMatch.index
    const styleCloseIdx = source.indexOf('</style>', styleOpenIdx + styleOpenMatch[0].length)
    if (styleCloseIdx > 0) {
      file.sfc.style.loc.start.offset = styleOpenIdx + styleOpenMatch[0].length
      file.sfc.style.loc.end.offset = styleCloseIdx
    }
  }

  // 4. customBlocks
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

/** 找 <template>...</template> 块的范围（含外层标签，正确处理嵌套） */
export function findTemplateBlockRange(source: string): { start: number; end: number } | null {
  const m = source.match(/<template\b[^>]*>/i)
  if (!m || m.index === undefined) return null
  const start = m.index
  const openEnd = start + m[0].length
  // 找最外层 </template>
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
