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
// @ts-ignore -- @babel/generator has no built-in .d.ts; this is dev-only code
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

  // iter-117: loc.start.offset 可能 stale (前一个 plugin 改 source 后没 sync sfc loc).
  //   重新从 file.source 字符串级定位 <script>...</script> 边界, 避免切坏标签.
  //   例如 vue3-types 跑 syncScriptAstToSource 时, loc 指向的 absStart 在 <script setup> 中间,
  //   二次 sync 会切掉 `>`. 用 lastIndexOf + indexOf 重定位是更安全的做法.
  const sourceNow = file.source
  // 找 <script...> 标签的 > 位置
  //   (1) 用 loc.start.offset 之前找最近的 > (loc 假设的 script open 标签尾巴)
  //   (2) 如果 (1) 失败, fallback 扫整个 source 找 <script...>
  let scriptOpenEnd = sourceNow.lastIndexOf('>', loc.start.offset)
  if (scriptOpenEnd < 0) {
    // fallback: 全 source 找
    const m = sourceNow.match(/<script\b[^>]*>/i)
    if (!m || m.index === undefined) return
    scriptOpenEnd = m.index + m[0].length
  } else {
    scriptOpenEnd = scriptOpenEnd + 1  // 包含 >
  }
  // 找 </script> 标签开始
  let scriptCloseStart = sourceNow.indexOf('</script>', loc.end.offset - 1)
  if (scriptCloseStart < 0) {
    // fallback: 找 scriptOpenEnd 之后的 </script>
    scriptCloseStart = sourceNow.indexOf('</script>', scriptOpenEnd)
  }
  if (scriptCloseStart < 0) return
  const absEnd = scriptCloseStart  // </script> 开始
  const absStart = scriptOpenEnd   // <script...> 结束 (含 >)

  file.source =
    sourceNow.substring(0, absStart) +
    newScriptBody +
    sourceNow.substring(absEnd)

  // 同步 sfc script.content + loc
  scriptBlock.content = newScriptBody
  loc.start.offset = absStart
  loc.end.offset = absStart + newScriptBody.length

  // iter-125: 改 file.source 后必须 mark changed, 否则 codegen 跳 (file.changed=false → 不写 output)
  //   这就是之前 master 195 102 个 .vue 缺失的根因:
  //   syncScriptAstToSource 改 source 但没 mark, codegen 看到 file.changed=false 直接跳,
  //   user 拿到 missing .vue 跑 vite build 报 "Could not resolve".
  file.changed = true
}
