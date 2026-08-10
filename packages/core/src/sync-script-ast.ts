/**
 * sync-script-ast.ts
 *
 * iter-038: 反向 sync — scriptAst 改完 → file.source。
 *
 * 一些 plugin 改 file.scriptAst (elementui 的 ensureElementPlusImports,
 * vue3-types 的 JSDoc 注入, etc.) 但不写回 file.source。
 * 当 composition 跑在它们之后 (priority 0 vs elementui 25) 时,
 * composition 的 raw-source 路径会重写 file.source,
 * elementui 改的 import 改动 (ElMessage / ElNotification 等) 全部丢失。
 *
 * 解决: elementui 改完 import 后调 ctx.syncScriptAstToSource() —
 * 用 babel generate 重新 produce scriptAst, 用 <script> 块 offset
 * 替换 file.source 里的 script block。
 *
 * 这是 import-cleaner raw-source 路径的镜像, 改的不是 file.source 字符串
 * offset 整体, 而是 replace <script>...</script> 整段。
 */
import _generate from '@babel/generator'
import * as t from '@babel/types'
import type { FileNode } from './types.js'

const _genObj: any = (_generate as any).default || _generate
const generateFn = _genObj as (node: any, opts?: any) => { code: string }

export function syncScriptAstToSource(file: FileNode): void {
  if (!file.sfc?.script) return
  const scriptBlock = file.sfc.script
  const loc = scriptBlock.loc
  if (!loc || typeof loc.start.offset !== 'number' || typeof loc.end.offset !== 'number') return

  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return

  // 重新 generate 整个 scriptAst
  const newScriptBody = generateFn(ast, {
    comments: true,
    retainLines: false,
    compact: false,
  }).code

  // loc.start.offset 是 <script> 标签末尾 (内容开始),
  // loc.end.offset   是 </script> 标签开始
  const absStart = loc.start.offset
  const absEnd = loc.end.offset

  file.source =
    file.source.substring(0, absStart) +
    newScriptBody +
    file.source.substring(absEnd)

  // 同步 sfc script.content + loc
  scriptBlock.content = newScriptBody
  loc.end.offset = absStart + newScriptBody.length
}
