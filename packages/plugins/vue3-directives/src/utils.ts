/**
 * 工具函数：共享给各规则
 */

import * as t from '@babel/types'

/**
 * 往文件里添加 `import { x, y } from 'vue'`（如果没有的话）
 */
export function ensureVueImport(file: any, names: string[]): void {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return

  let vueImport = ast.program.body.find(
    (n: any) =>
      t.isImportDeclaration(n) &&
      t.isStringLiteral(n.source, { value: 'vue' }),
  ) as t.ImportDeclaration | undefined

  if (vueImport) {
    const existing = new Set(
      vueImport.specifiers
        .filter((s): s is t.ImportSpecifier => t.isImportSpecifier(s))
        .map((s) => (s.imported as t.Identifier).name),
    )
    for (const name of names) {
      if (!existing.has(name)) {
        vueImport.specifiers.push(
          t.importSpecifier(t.identifier(name), t.identifier(name)),
        )
      }
    }
  } else {
    const newImport = t.importDeclaration(
      names.map((n) => t.importSpecifier(t.identifier(n), t.identifier(n))),
      t.stringLiteral('vue'),
    )
    ast.program.body.unshift(newImport)
  }
}

/**
 * 在 .vue 文件源码中找 <template> 块的内容范围。
 * 返回 { start, end }（offset），start 是 `<template ...>` 之后，end 是 `</template>` 之前。
 *
 * 重要：必须用 scanner 已经解析好的 sfc.template.loc，但 sfc.template.loc 会被前面的
 * transformTemplate 调用污染（loc.offset 累加 delta）。所以**每次调用时都从 file.source
 * 重新计算 loc**（用 SFC 描述符的原始 loc + 累计 delta 不可靠，直接用 source 重新找最简单）。
 *
 * 关键问题：模板里可能嵌套 `<template slot="...">`，所以不能直接 indexOf('</template>')。
 * 用 scanner 已经解析好的 sfc.template.content 长度 + 一个固定策略定位：
 *   - <template> 标签的开头在 source 里第一次出现的位置（注意：嵌套的 <template> 也是合法的，
 *     但 scanner 的 sfc.template 是最外层的，对应 file.source[loc.start.offset] 的位置）
 *   - 实际上 sfc.template.loc 已经记录了"inner content" 的 [start, end)，最可靠的方式是
 *     重新从 file.source 里找。但因为 sfc.template.loc 已经被累加污染了，我们必须重新算。
 *
 * 策略：在 file.source 里从 start=0 开始数 `<template` 和 `</template>`，配对找到**最外层**的。
 * 这是最可靠的方案。
 */
export function findTemplateRange(file: any): { start: number; end: number } | null {
  const source = file.source
  // 找最外层 <template> 标签的结束位置
  // 1. 找第一个 <template> 标签（开头，> 之前可能有属性）
  const openMatch = source.match(/<template\b[^>]*>/i)
  if (!openMatch || openMatch.index === undefined) return null
  const openEnd = openMatch.index + openMatch[0].length  // 第一个 > 之后的位置

  // 2. 从 openEnd 开始数嵌套深度
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
    if (!nextClose) return null  // 没有匹配的 </template>，SFC 损坏
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++
      pos = nextOpen.index + nextOpen[0].length
    } else {
      depth--
      pos = nextClose.index + nextClose[0].length
    }
  }

  // pos 现在是最外层 </template> 结束的位置
  // inner content 是 [openEnd, nextClose.index)
  return { start: openEnd, end: pos - '</template>'.length }
}

/**
 * 在 .vue 文件源码中找 <script> 块的内容范围。
 * 返回 { start, end }（offset），start 是 `<script ...>` 之后，end 是 `</script>` 之前。
 */
export function findScriptRange(source: string): { start: number; end: number } | null {
  const m = source.match(/<script\b[^>]*>/i)
  if (!m || m.index === undefined) return null
  const start = m.index + m[0].length
  const closeIdx = source.indexOf('</script>', start)
  if (closeIdx < 0) return null
  return { start, end: closeIdx }
}

/**
 * 在模板内容里用字符串替换（只在 .vue 模板块内做）。
 *
 * 策略：
 * 1. 在 file.source 的 <template> 内容里做字符串替换
 * 2. 更新 sfc.script.loc（start/end）以反映新位置（因为模板块大小变了）
 * 3. **不**清 file.scriptAst —— AST 改动仍要保留
 */
export function transformTemplate(
  file: any,
  replacer: (template: string) => { out: string; changed: boolean; reviewItems?: string[] },
  utils: any,
  markMessage: string,
): void {
  if (file.kind !== 'vue') return
  const range = findTemplateRange(file)
  if (!range) return
  const template = file.source.slice(range.start, range.end)
  const result = replacer(template)
  if (!result.changed) return

  const oldLen = range.end - range.start
  const newLen = result.out.length
  const delta = newLen - oldLen

  file.source = file.source.slice(0, range.start) + result.out + file.source.slice(range.end)

  // 关键：core codegen 用 sfc.script.loc 来切 script 块
  // 之前用 += delta 累加，多个 plugin 调用时会导致 loc 偏移多倍。修复为：
  // 重新从 file.source 里找 <script> 标签的绝对位置（每次都重新算，不累加）。
  resyncSfcBlockLocations(file)

  // 不清 file.scriptAst！AST 改动要保留给 codegen
  utils.markChanged(markMessage)
  for (const r of result.reviewItems || []) {
    utils.manualReview(r)
  }
}

/**
 * 重新从 file.source 同步所有 SFC block（template/script/style/customBlocks）的 loc
 * 不用累加 delta，直接从最新 source 算绝对位置。
 * 这样无论 transformTemplate 被调用多少次，loc 都保持正确。
 */
function resyncSfcBlockLocations(file: any): void {
  if (!file.sfc) return
  const source = file.source

  // 1. template
  if (file.sfc.template) {
    const tplRange = findTemplateRange(file)
    if (tplRange) {
      file.sfc.template.loc.start.offset = tplRange.start
      file.sfc.template.loc.end.offset = tplRange.end
      file.sfc.template.content = source.slice(tplRange.start, tplRange.end)
    }
  }

  // 2. script / scriptSetup：找 <script> 和 </script>
  const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
  const scriptCloseIdx = source.indexOf('</script>', scriptOpenMatch ? scriptOpenMatch.index + scriptOpenMatch[0].length : 0)
  if (scriptOpenMatch && file.sfc.script) {
    file.sfc.script.loc.start.offset = scriptOpenMatch.index + scriptOpenMatch[0].length
    file.sfc.script.loc.end.offset = scriptCloseIdx
    file.sfc.script.content = source.slice(file.sfc.script.loc.start.offset, scriptCloseIdx)
  }

  // 3. style：第一个 <style> 和 </style>
  const styleOpenMatch = source.match(/<style\b[^>]*>/i)
  const styleCloseIdx = source.indexOf('</style>', styleOpenMatch ? styleOpenMatch.index + styleOpenMatch[0].length : 0)
  if (styleOpenMatch && file.sfc.style) {
    file.sfc.style.loc.start.offset = styleOpenMatch.index + styleOpenMatch[0].length
    file.sfc.style.loc.end.offset = styleCloseIdx
  }

  // 4. customBlocks
  for (const cb of file.sfc.customBlocks || []) {
    const tag = cb.type || cb.attrs?.type
    if (!tag) continue
    const openRe = new RegExp(`<${tag}\\b[^>]*>`, 'i')
    const closeRe = new RegExp(`</${tag}\\s*>`, 'i')
    const openM = openRe.exec(source)
    if (openM) {
      const closeM = closeRe.exec(source)
      if (closeM) {
        cb.loc.start.offset = openM.index + openM[0].length
        cb.loc.end.offset = closeM.index
      }
    }
  }
}
