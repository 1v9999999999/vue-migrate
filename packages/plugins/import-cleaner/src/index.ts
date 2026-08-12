/**
 * @vue-migrate/plugin-import-cleaner
 *
 * iter-042c: 在所有 transform 后清理 unused import。
 *
 * 典型场景:
 *   - composition 转完后, 原 import Vue / import { mapState } from 'vuex' 没人用了
 *   - elementui 转完后, 原 import { Button } from 'element-ui' 没人用了
 *   - 用户需人工 cleanup 这类 import → 浪费时间
 *
 * 策略:
 *   - 扫 AST 找所有 import declaration
 *   - 对每个 specifier (default / named / namespace) 找本地 binding 名
 *   - 找该 binding 的 ReferencedIdentifier (排除 import 自己的 local)
 *   - 0 引用 → 移除 specifier
 *   - 整个 import 都没 specifier → 移除整条 import
 *
 * Priority: -1 (最低, 最后跑)
 */

import * as t from '@babel/types'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import { parse as _parse } from '@babel/parser'
import { registerPlugin, type TransformPlugin } from '@vue-migrate/core'

// ESM-safe
const _traverseObj: any = (_traverse as any)
const traverse = _traverseObj.default || _traverseObj
const _genObj: any = (_generate as any)
const generateFn = _genObj.default || _genObj
const parseScript: any = _parse

const plugin: TransformPlugin = {
  name: 'import-cleaner',
  description:
    'iter-042c: After all transforms, remove unused imports (Vue, vuex, element-ui etc.) to avoid manual cleanup.',
  priority: -1,
  fileKinds: ['vue', 'js', 'ts', 'tsx', 'jsx'],

  transform(ctx) {
    const { file } = ctx
    const ast = file.scriptAst
    if (!ast || !t.isFile(ast)) return
    if (!process.env.DBG_IMPCLEAN4 || !/addGoods|foodList/.test(file.path)) {
      // normal path
    } else {
      try {
        cleanUnusedImportsFromSource(file, ctx)
        console.log('[DBG-IMPCLEAN4-DONE]', file.path)
      } catch (e: any) {
        console.log('[DBG-IMPCLEAN4-THROW]', file.path, 'msg=', e.message)
        console.log('[DBG-IMPCLEAN4-STACK]', e.stack?.split('\n').slice(0, 10).join('\n'))
        throw e
      }
      return
    }

    // iter-042d: ALWAYS prefer the raw-source path. file.scriptAst is the
    // original parse — it does NOT reflect the current file.source after
    // composition/elementui have rewritten the script. Walking the stale AST
    // misses imports that composition introduced/removed in <script setup>.
    // Raw-source re-parse is robust and idempotent.
    if (process.env.DBG_IMPCLEAN2 && /addGoods|headTop/.test(file.path)) {
      const before = file.source
      const openMatch = before.match(/<script\b[^>]*>/i)
      if (openMatch && openMatch.index !== undefined) {
        const sStart = openMatch.index + openMatch[0].length
        const sEnd = before.indexOf('</script>', sStart)
        const body = before.slice(sStart, sStart + 250)
        // dump as JSON to see exact chars
        console.log(`[DBG-IMPCLEAN-IN-JSON] ${file.path}`)
        console.log(JSON.stringify(body))
        console.log('--- end ---')
      }
    }
    cleanUnusedImportsFromSource(file, ctx)
    if (process.env.DBG_IMPCLEAN2 && /addGoods|headTop/.test(file.path)) {
      const after = file.source
      const openMatch = after.match(/<script\b[^>]*>/i)
      if (openMatch && openMatch.index !== undefined) {
        const sStart = openMatch.index + openMatch[0].length
        const body = after.slice(sStart, sStart + 350)
        console.log(`[DBG-IMPCLEAN-OUT-JSON] ${file.path}`)
        console.log(JSON.stringify(body))
        console.log('--- end ---')
      }
    }
  }
}

function uniqueByPath(paths: any[]): any[] {
  const seen = new Set<any>()
  const out: any[] = []
  for (const p of paths) {
    if (!seen.has(p)) { seen.add(p); out.push(p) }
  }
  return out
}

/**
 * iter-042c: 当 useRawSource=true (composition 改过 file.source) 时,
 * 重新 parse file.source, 找 unused import, 然后改 file.source 字符串.
 * 同时 reparse scriptAst 让 codegen 看到新 AST.
 */
function cleanUnusedImportsFromSource(file: any, ctx: any): void {
  const source = file.source as string
  // iter-043: 用 file.sfc.script (scanner 已 parse 过 @vue/compiler-sfc) 定位 <script> 块
  //   而不是 regex — 避免 <script> 在 template/comment 里的误匹配
  const sfcScript = file.sfc?.script
  if (!sfcScript || sfcScript.loc == null) {
    // 非 .vue 文件 / 没有 SFC 定位: 整段 source 当 script
    //   - raw .js / .ts: 整个文件就是脚本
    //   - .vue 但 sfc.script 没 loc: fallback 整段 source
    return cleanImportsInRange(source, 0, source.length, source.length, file, ctx)
  }
  // Resync sfc.script.loc from current file.source. Some upstream plugins
  // (notably composition) write a wrong loc.start.offset (= position of `<script`
  // opening tag instead of position of first content char). Re-derive by regex
  // so this plugin never operates on stale offsets.
  const source2 = file.source as string
  const openTagMatch = source2.match(/<script\b[^>]*>/i)
  if (!openTagMatch || openTagMatch.index === undefined) return
  const openTagIdx = openTagMatch.index
  const openTagEnd = openTagIdx + openTagMatch[0].length
  const closeTagStart = source2.indexOf('</script>', openTagEnd)
  if (closeTagStart < 0) return
  // also patch sfc loc so downstream plugins (e.g. codegen) see correct range
  sfcScript.loc.start.offset = openTagEnd
  sfcScript.loc.end.offset = closeTagStart
  sfcScript.content = source2.slice(openTagEnd, closeTagStart)
  return cleanImportsInRange(source2, openTagEnd, closeTagStart, closeTagStart - openTagEnd, file, ctx)
}

function cleanImportsInRange(source: string, openTagEnd: number, closeTagStart: number, _blockLen: number, file: any, ctx: any): void {
  // 块内: openTagEnd 到 closeTagStart
  const block = source.slice(openTagEnd, closeTagStart)
  // 找 leading whitespace (前导换行)
  let startOffset = 0
  while (startOffset < block.length && (block[startOffset] === '\n' || block[startOffset] === '\r' || block[startOffset] === ' ' || block[startOffset] === '\t')) {
    startOffset++
  }
  // 找 trailing whitespace
  let endOffset = block.length
  while (endOffset > 0 && (block[endOffset - 1] === '\n' || block[endOffset - 1] === '\r' || block[endOffset - 1] === ' ' || block[endOffset - 1] === '\t')) {
    endOffset--
  }
  const scriptInner = block.slice(startOffset, endOffset)
  // CRITICAL: pass `openTagEnd + startOffset` to all offset math below, so that
  // AST node offsets (which are relative to the trimmed scriptInner) are mapped
  // back to the correct absolute file.source position. Without this fix, when
  // the script block starts with a newline (very common), the first import
  // edit would consume that newline and shred the next import's `i`.
  const scriptInnerAbsStart = openTagEnd + startOffset
  const replaceStart = openTagEnd
  const replaceEnd = closeTagStart

  // parse scriptInner → AST
  // NOTE: do NOT use `sourceType: 'module'` here. Some vue2 source has a
  // method/local that collides with an import binding (e.g. `function addFood()`
  // + `import { addFood } from '@/api/getData'`). In strict module mode, babel
  // throws "Duplicate declaration" on parse and the file is left untouched.
  // `errorRecovery: true` tells babel to keep parsing past errors (just marks
  // the offending nodes). Combined with `sourceType: 'unambiguous'` (so
  // scripts with `import` aren't forced into module mode) this lets us scan
  // the AST and drop the unused import anyway.
  let ast: any
  try {
    ast = parseScript(scriptInner, {
      sourceType: 'unambiguous',
      allowImportExportEverywhere: true,
      errorRecovery: true,
      plugins: ['typescript', 'jsx'],
    })
  } catch {
    return  // parse 失败, 跳过 (不破坏文件)
  }

  // 收集 import specifier → 本地 binding 名
  interface SpecInfo {
    importPath: any
    spec: any
    localName: string
    kind: 'default' | 'named' | 'namespace'
    refs: number
  }
  const specs: SpecInfo[] = []
  // `noScope: true` disables babel's scope tracking, which would otherwise
  // throw `TypeError: Duplicate declaration "addFood"` on files where a
  // composition-emitted `function addFood()` collides with a user
  // `import { addFood } from '...'`. We don't need scope info here — we just
  // want to enumerate ImportDeclarations.
  traverse(ast, {
    noScope: true,
    ImportDeclaration(path: any) {
      for (const spec of path.node.specifiers) {
        let localName: string | null = null
        let kind: 'default' | 'named' | 'namespace' | null = null
        if (t.isImportDefaultSpecifier(spec) && t.isIdentifier(spec.local)) {
          localName = spec.local.name
          kind = 'default'
        } else if (t.isImportSpecifier(spec) && t.isIdentifier(spec.local)) {
          localName = spec.local.name
          kind = 'named'
        } else if (t.isImportNamespaceSpecifier(spec) && t.isIdentifier(spec.local)) {
          localName = spec.local.name
          kind = 'namespace'
        }
        if (localName && kind) specs.push({ importPath: path, spec, localName, kind, refs: -1 })
      }
    },
  })

  if (specs.length === 0) return

  // For .vue files we also need to check the <template> block — Vue 3 auto-resolves
  // <MyComp /> → imported binding `MyComp`, and kebab-case in template can match
  // PascalCase imports (e.g. <head-top> matches `import headTop from ...`).
  // Build a "template-referenced" set of identifiers found in raw template text.
  const templateRefs = collectTemplateReferences(file.source, openTagEnd, closeTagStart)

  let removed = 0
  for (const info of specs) {
    const scriptRefs = findReferences(ast, info.localName, info.spec, info.importPath)
    const tplRefs = templateRefs.has(info.localName) ? 1 : 0
    const refs = scriptRefs + tplRefs
    info.refs = refs
    if (refs === 0) {
      const importNode = info.importPath.node
      importNode.specifiers = importNode.specifiers.filter((s: any) => s !== info.spec)
      removed++
    }
  }

  // 整个 import 都没 specifier → 删
  // (We do this purely in source-string space — `path.remove()` on the AST
  // does NOT update file.source, so it would be a no-op.)
  if (removed === 0) return

  // iter-042e: STRING-LEVEL replace imports (avoid re-generating whole script —
  // re-generation breaks when composition has produced declarations whose
  // names collide with import bindings that should be kept, or when the
  // composition-injected free-variable declarations are duplicated by
  // re-generation).
  //
  // Strategy:
  //   - Collect edits (offsets + replacements) FIRST, dedup by importPath.
  //   - Apply edits to file.source in reverse offset order.
  let newSource = source

  // Build a list of unique importPaths from specs.
  const uniqueImportPaths: any[] = []
  const seenPaths = new Set<any>()
  for (const info of specs) {
    if (!info.importPath || seenPaths.has(info.importPath)) continue
    seenPaths.add(info.importPath)
    uniqueImportPaths.push(info.importPath)
  }

  // First pass: collect importPath ranges relative to the SCRIPT BLOCK
  // (scriptInner), then map them back to absolute offsets in the original
  // file.source.  Each importNode is an AST node whose `start`/`end` point
  // into scriptInner.
  const edits: Array<{ start: number; end: number; replacement: string }> = []
  for (const ip of uniqueImportPaths) {
    if (!ip || !ip.node) continue
    const startInScriptInner = ip.node.start
    const endInScriptInner = ip.node.end
    if (typeof startInScriptInner !== 'number' || typeof endInScriptInner !== 'number') continue
    // scriptInnerAbsStart + startInScriptInner = absolute offset in file.source
    const absStart = scriptInnerAbsStart + startInScriptInner
    const absEnd = scriptInnerAbsStart + endInScriptInner
    const remaining = ip.node.specifiers
    if (remaining.length === 0) {
      // Drop the whole import line — extend to consume the trailing semicolon
      // and following newline so we don't leave a blank line.
      let dropStart = absStart
      let dropEnd = absEnd
      if (newSource[dropEnd] === ';') dropEnd++
      if (newSource[dropEnd] === '\r') dropEnd++
      if (newSource[dropEnd] === '\n') dropEnd++
      while (dropStart > 0 && (newSource[dropStart - 1] === ' ' || newSource[dropStart - 1] === '\t')) dropStart--
      edits.push({ start: dropStart, end: dropEnd, replacement: '' })
    } else {
      // Regenerate just this import line (bigger safety net than
      // string-patching the specifier list).
      // CRITICAL: babel generate on a single ImportDeclaration node does NOT
      // emit a trailing newline. If the original source had `import A;\nimport B;`
      // and we replace `import A;` with `import A;` (no \n), the result is
      // `import A;\nimport B;` — looks fine in isolation, BUT when an earlier
      // edit drops `import B;` (its `;` + `\n`), the boundary shifts and we
      // get `import A;;mport C` (the `;` from A's regenerate and the `;`
      // from a subsequent import are now adjacent). Force a trailing `\n`
      // so the regenerated line behaves identically to the original.
      const newImportNode: any = {
        type: ip.node.type,
        source: ip.node.source,
        specifiers: remaining,
        // Preserve leading comments if any
        leadingComments: ip.node.leadingComments,
        trailingComments: ip.node.trailingComments,
      }
      let newImportText = generateFn(newImportNode, { comments: true, retainLines: false, compact: false }).code
      // Ensure the regenerated import is terminated with `\n` so it can be
      // safely concatenated with the next statement.
      if (!newImportText.endsWith('\n')) newImportText += '\n'
      edits.push({ start: absStart, end: absEnd, replacement: newImportText })
    }
  }
  // Apply edits in reverse order so earlier offsets stay valid.
  edits.sort((a, b) => b.start - a.start)
  for (const e of edits) {
    if (process.env.DBG_IMPCLEAN3 && /addGoods|foodList/.test(file.path)) {
      try {
        throw new Error('TRACE-EDIT')
      } catch (ex: any) {
        console.log('[DBG-EDIT]', e.start, e.end, JSON.stringify(e.replacement.slice(0, 60)))
      }
    }
    newSource = newSource.slice(0, e.start) + e.replacement + newSource.slice(e.end)
  }

  file.source = newSource
  if (process.env.DBG_IMPCLEAN3 && /addGoods|foodList/.test(file.path)) {
    console.log('[DBG-IMPCLEAN-DONE]', file.path, 'removed=', removed)
  }

  // 同步改 file.scriptAst: 把上面删掉的 specifier 也在原 AST 里删掉
  //   - 测试用 generate(file.scriptAst) 验证 (不能只改 file.source)
  //   - 真实 codegen 走 file.scriptAst 时也看到这个改动
  //   - 匹配键: (source.value, localName, specKind) — 三者同时匹配才删
  //   - 跳过 import-cleaner 自己的 re-parsed AST (already mutated)
  const scriptAst = file.scriptAst
  if (scriptAst && t.isFile(scriptAst) && scriptAst !== ast) {
    for (const info of specs) {
      // 只有真正被删的 (refs===0) 才同步
      if (info.refs !== 0) continue
      // 从 re-parsed AST 的 importNode 拿 source 字符串
      const srcVal = info.importPath?.node?.source?.value
      if (typeof srcVal !== 'string') continue
      // 在 file.scriptAst 找同源同 spec 的 import declaration
      traverse(scriptAst, {
        noScope: true,
        ImportDeclaration(p: any) {
          if (p.node.source?.value !== srcVal) return
          p.node.specifiers = p.node.specifiers.filter((s: any) => {
            if (t.isImportDefaultSpecifier(s) && info.kind === 'default') {
              return s.local?.name !== info.localName
            }
            if (t.isImportSpecifier(s) && info.kind === 'named') {
              // 比 imported 名还是 local 名? iter-042c 默认比 local
              return s.local?.name !== info.localName
            }
            if (t.isImportNamespaceSpecifier(s) && info.kind === 'namespace') {
              return s.local?.name !== info.localName
            }
            return true  // 其他保留
          })
        },
      })
    }
  }

  ctx.utils.markChanged(`removed ${removed} unused import specifier(s) (from raw source)`)
}

/**
 * 找 AST 里 `name` 的引用次数 (排除 import 自己的 local binding)。
 * 返回 0 表示 unused。
 */
function findReferences(ast: any, name: string, ownSpec: any, ownImport: any): number {
  let count = 0
  // noScope: true for the same reason as the ImportDeclaration walker above —
  // duplicate-binding files (function + import with the same name) throw on
  // scope registration otherwise.
  traverse(ast, {
    noScope: true,
    ReferencedIdentifier(path: any) {
      if (path.node.name !== name) return
      // 排除 import 自己的 local binding
      if (path.parent === ownSpec) return
      // walk up: 如果在 import declaration 里, 跳过
      let p: any = path.parentPath
      while (p) {
        if (p === ownImport) return
        p = p.parentPath
      }
      count++
      // 不需要 stop — 计数直到最后 (会终止)
    },
  })
  return count
}

/**
 * Collect identifiers referenced in the <template> block of a .vue file.
 *
 * Vue 3 auto-resolves component tags by name, so a tag like `<head-top>` will
 * resolve to a binding named `headTop` (kebab-case ↔ PascalCase). Same for
 * `MyComp` ↔ `<my-comp>`. We extract every tag name + every `{{ ... }}` and
 * directive identifier from the template region and return the set of
 * `localName` strings we believe are referenced from template.
 *
 * Conservative on purpose: false-positives (i.e. keeping an import that
 * is not actually used) are far less harmful than false-negatives (clearing
 * an import that the template still needs → runtime "unknown component").
 */
function collectTemplateReferences(
  source: string,
  scriptOpenTagEnd: number,
  scriptCloseTagStart: number,
): Set<string> {
  const out = new Set<string>()
  // Anything outside <script>...</script> is potentially template/style
  // we treat the first <template>...</template> block as the template region.
  const tplOpen = source.search(/<template\b[^>]*>/i)
  if (tplOpen < 0) return out
  const tplOpenEnd = source.indexOf('>', tplOpen) + 1
  const tplClose = source.indexOf('</template>', tplOpenEnd)
  if (tplClose < 0) return out
  const tpl = source.slice(tplOpenEnd, tplClose)

  // 1. tag names: <TagName ...> or </TagName>
  const tagRe = /<\/?([A-Za-z][A-Za-z0-9-]*)/g
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(tpl))) {
    const tag = m[1]
    // skip HTML elements we never auto-resolve (lowercase, simple)
    // but we still add the camelCase variant — the import might be `headTop`
    // and the tag is `head-top`
    const camel = kebabToCamel(tag)
    if (camel) out.add(camel)
  }
  // 2. mustache identifiers: {{ foo }} or {{ foo.bar }}
  const mustacheRe = /\{\{\s*([A-Za-z_$][\w$]*)/g
  while ((m = mustacheRe.exec(tpl))) {
    out.add(m[1])
  }
  // 3. directive identifiers (v-if="x", :foo="x", @click="x")
  const dirRe = /\b(?:v-[A-Za-z]+|:[A-Za-z][\w-]*|@[\w-]+)\s*=\s*"([^"]+)"/g
  while ((m = dirRe.exec(tpl))) {
    const expr = m[1]
    const identRe = /[A-Za-z_$][\w$]*/g
    let im: RegExpExecArray | null
    while ((im = identRe.exec(expr))) {
      const id = im[0]
      if (id === 'true' || id === 'false' || id === 'null' || id === 'undefined') continue
      out.add(id)
    }
  }
  return out
}

function kebabToCamel(s: string): string | null {
  if (!s) return null
  if (!s.includes('-')) {
    // `headTop` or `HeadTop` — keep as-is, but for kebab → camel we use lower
    return s
  }
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

registerPlugin(plugin)
export default plugin
