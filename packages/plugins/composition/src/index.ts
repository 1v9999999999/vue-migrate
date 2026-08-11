/**
 * @vue-migrate/plugin-composition
 *
 * 把 Vue2 Options API 风格的组件转换为 Vue3 `<script setup>` 风格。
 *
 * 策略：字符串级别转换（不依赖 AST serialize 完整函数体）。
 *  - 找到 export default { ... } 段
 *  - 用 regex 解析各 section（data/props/methods/computed/watch/lifecycle）
 *  - 生成对应的 setup 代码
 *  - 直接重写 file.source 的 script 块（**只替换 export default 段**）
 *  - 标记 file.useRawSource = true，codegen 用 file.source 而非 AST
 *
 * 实现的规则：
 *   C.1  data() {...} → const x = ref(...)/reactive(...)
 *   C.2  props: {...} → const props = defineProps<{...}>()
 *   C.3  methods: {...} → 普通 function
 *   C.4  computed: {...} → const x = computed(() => ...)
 *   C.5  watch: {...} → watch(source, cb, opts)
 *   C.6  生命周期：mounted() → onMounted(() => ...)，beforeDestroy → onBeforeUnmount 等
 *   C.7  <script setup> 标志
 *   C.8  自动补 import
 *   C.9  this.xxx 替换为解构后的变量
 *   C.10 this.$xxx 替换（$listeners/$children/$refs/$store/$route/$emit/$on/$bus/$nextTick/$scopedSlots/$message/$notify/$msgbox/$alert/$confirm/$loading）
 *   C.11 this.$watch 替换为 watch()
 *   C.12 this.props 引用替换为 props.xxx
 *   C.13 保留 export default 外的 imports / 顶级函数
 *
 * 限制（标 review）：
 *   - 嵌套回调里的 this 需要人工确认
 *   - render 函数 / 异步组件
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import _babelParser from '@babel/parser'
import { convertOptionsToSetup } from './options-to-setup.js'

// ESM-safe wrapper: babel parser has different structure under different entry points
const _babelParserObj: any = (_babelParser as any).default || _babelParser
const _babelParserParse: (code: string, opts?: any) => any =
  _babelParserObj.parse || _babelParserObj.default?.parse || _babelParserObj

const plugin: TransformPlugin = {
  name: 'composition',
  description:
    'Convert Vue2 Options API (data/props/methods/computed/watch/lifecycle) to Vue3 <script setup> with ref/reactive/defineProps/computed/watch/onMounted/etc.',
  priority: 0,

  fileKinds: ['vue'],

  transform(ctx: TransformContext) {
    if (!ctx.file.sfc?.script)
    return

    // iter-051: this.$parent + iter-054: Vue 2 移除的 instance API + mixins 字段
    // 全部移到 convertOptionsToSetup 里 (line 1510+ 之后) 推 result.reviewItems, 避免与 plugin transform 重复.
    // 这里不再重复.

    // iter-046: <script setup> 已经有 script, 但里面可能直接用 props.X / emit('X', ...) 而没
    //   defineProps / defineEmits. 在这里扫描一下, 缺啥补啥 (不重写 setup body, 只插入声明)
    if (ctx.file.sfc.script.attrs?.setup) {
      maybeInjectDefinePropsEmitsForExistingSetup(ctx)
      ctx.utils.manualReview('已存在 <script setup>，跳过 Options→Composition 转换 (但已扫描 props.X / emit() 注入 defineProps / defineEmits)')
      return
    }

    // 0. CRITICAL: resync sfc.script.loc from current file.source first.
    //    Earlier plugins (elementui icon.ts, etc.) may have inserted imports
    //    into file.source without updating sfc loc, so a stale loc points at
    //    template content (and babel parse fails on it).
    resyncScriptLoc(ctx.file)

    const result = convertOptionsToSetup(ctx.file, ctx)
    if (!result.changed)
    return

    // 1. set file.useRawSource = true so codegen uses file.source directly
    ctx.file.useRawSource = true

    const source = ctx.file.source
    const scriptInnerStart = ctx.file.sfc.script.loc.start.offset
    const scriptInnerEnd = ctx.file.sfc.script.loc.end.offset

    const beforeInner = source.substring(0, scriptInnerStart)
    const scriptOpenStart = beforeInner.lastIndexOf('<script')
    if (scriptOpenStart < 0) {
      ctx.utils.manualReview('无法定位 <script> 标签，composition 转换失败')
      return
    }
    const afterInner = source.substring(scriptInnerEnd)
    const closeTagRelEnd = afterInner.indexOf('</script>')
    if (closeTagRelEnd < 0) {
      ctx.utils.manualReview('无法定位 </script> 结束，composition 转换失败')
      return
    }
    const closeTagAbsEnd = scriptInnerEnd + closeTagRelEnd + '</script>'.length

    // 3. 提取 script 内部文本
const scriptInner = source.substring(scriptInnerStart, scriptInnerEnd)

    // 3.5 detect template $route/$router/$store/$emit/$listeners/$scopedSlots usage
    //    sets result.*Used = true so setup injects corresponding const declarations
    detectTemplateGlobals(source, result)

    // 4. locate `export default { ... }` block - prefer fresh babel AST offset
    //    (more accurate than regex brace match, especially when code has
    //    template literal `${...}` which fools regex)
    const exportMatch = findExportDefaultBlockByFreshAst(scriptInner)
      || findExportDefaultBlock(scriptInner)
    if (!exportMatch) {
      ctx.utils.manualReview('未找到 export default { ... } 段，composition 转换失败')
      return
    }

    // 5. build new script block
    const newScript = buildNewScript(scriptInner, exportMatch, result)

    // 5.5 process nested Vue.extend({...}) top-level constants
    //     e.g. `const BaseWidget = Vue.extend({...})` -> `const BaseWidget = defineComponent({...})` (Vue3-compatible, supports TS inference)
    const finalScript = replaceVueExtendInScript(newScript)

    // [DBG-COMPO-IMPORT] dump finalScript's first 600 chars
    if (process.env.DBG_COMPO_IMPORT && /headTop|login|adminSet|tendency|visitorPie/.test(ctx.file.path)) {
      console.log(`[DBG-COMPO-IMPORT] ${ctx.file.path}\n--- newScript (first 800 chars) ---\n${newScript.slice(0, 800)}\n--- finalScript (first 800 chars) ---\n${finalScript.slice(0, 800)}\n--- scriptInner (first 600 chars) ---\n${scriptInner.slice(0, 600)}\n--- end ---`)
    }

    // 6. replace script in file.source
    ctx.file.source =
      source.substring(0, scriptOpenStart) +
      finalScript +
      source.substring(closeTagAbsEnd)

    // 6.5 模板重写：把 $route/$router/$store/$emit/$listeners/$scopedSlots 替换为 setup 暴露的别名
    // 必须在 script 替换之后做，模板里的这些引用在 Vue2 模板是合法的，但 Vue3 + <script setup> 需要改名
    ctx.file.source = rewriteTemplateInPlace(ctx.file.source, result)

    // 7. sync sfc.script
    const scriptBlock = ctx.file.sfc.script
    scriptBlock.content = newScript
    scriptBlock.loc.start.offset = scriptOpenStart
    scriptBlock.loc.end.offset = scriptOpenStart + newScript.length
    if (scriptBlock.attrs) {
      scriptBlock.attrs.setup = true
    }

    // 8. review / warnings
    for (const r of result.reviewItems) ctx.utils.manualReview(r)
    for (const w of result.warnings) ctx.utils.manualReview(w)

    ctx.utils.markChanged(
      `[composition] → <script setup> (${result.vueImports.size} imports, ${result.setupCode.split('\n').length} lines)`,
    )
  },
}

interface ExportMatch {
  start: number
  end: number
  objStart: number
  objEnd: number
}

/**
 * Re-derive sfc.script.loc and .content from current file.source.
 * Earlier plugins (elementui icon, vxe-table, etc.) may have inserted imports
 * into file.source via `file.source = ...` without syncing sfc loc offsets,
 * leaving sfc.script.loc stale. Recompute by regex so this plugin always
 * sees the correct script-block range.
 */
function resyncScriptLoc(file: any): void {
  if (!file?.sfc?.script) return
  const source: string = file.source
  const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
  if (!scriptOpenMatch || scriptOpenMatch.index === undefined) return
  const scriptOpenIdx = scriptOpenMatch.index
  const scriptOpenEnd = scriptOpenIdx + scriptOpenMatch[0].length
  const scriptCloseIdx = source.indexOf('</script>', scriptOpenEnd)
  if (scriptCloseIdx < 0) return
  file.sfc.script.loc.start.offset = scriptOpenEnd
  file.sfc.script.loc.end.offset = scriptCloseIdx
  file.sfc.script.content = source.slice(scriptOpenEnd, scriptCloseIdx)
}

/**
 * iter-046: 对已存在的 `<script setup>` 文件, 扫描 setup body 中对 props.X / emit('X', ...) 的
 *   引用, 如果缺 defineProps / defineEmits 就插入 (从引用推断 prop 名字 + event 名字).
 *
 * 适用场景:
 *   - 用户写组件时直接用 <script setup>, 没 defineProps / defineEmits
 *   - 父级用 v-model 传 prop, 子级靠 props.foo 接收 — 没 declare props 时 props 是 undefined, 报错
 *   - 子级 emit('update:xxx', ...) 没 declare, 报 emit is not a function
 *
 * 策略:
 *   1. 扫 setup body, 找所有 `props.X` 引用, X 加入 propNames
 *   2. 扫 setup body, 找所有 `emit('X', ...)` 字符串字面量, X 加入 emitNames
 *   3. 如果 propNames 非空 + 文件里没 defineProps, 注入 `const props = defineProps({ X: null, Y: null, ... })`
 *   4. 如果 emitNames 非空 + 文件里没 defineEmits, 注入 `const emit = defineEmits(['X', 'Y', ...])`
 *   5. 注入位置: 文件第一个 import 之后 (避免被放在文件头前)
 *
 * 限制: 我们不试图推断 prop type (JS setup 没法用泛型), 只插 null 占位 — 用户手改.
 */
function maybeInjectDefinePropsEmitsForExistingSetup(ctx: TransformContext): void {
  const { file, utils } = ctx
  const source = file.source
  if (!source) return

  // 1. 找 <script setup> 块的范围
  const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
  if (!scriptOpenMatch || scriptOpenMatch.index === undefined) return
  const scriptOpenEnd = scriptOpenMatch.index + scriptOpenMatch[0].length
  const scriptCloseIdx = source.indexOf('</script>', scriptOpenEnd)
  if (scriptCloseIdx < 0) return
  const scriptInner = source.substring(scriptOpenEnd, scriptCloseIdx)

  // 2. 找 setup body — 跳过 import 语句, 找顶层非 import 代码
  //    简化: 我们就扫整段 scriptInner, 跳过 import line
  const linesForScan = scriptInner
    .split('\n')
    .filter((l) => !/^\s*import\b/.test(l))
    .join('\n')

  // 3. 收集 prop 名字: `props.X` 形式
  const propNames = new Set<string>()
  for (const m of linesForScan.matchAll(/\bprops\.([a-zA-Z_]\w*)\b/g)) {
    // 排除 `props.something` 里的 something 是 builtin (props.constructor, props.toString 等)
    if (m[1] !== 'constructor' && m[1] !== 'toString' && m[1] !== 'hasOwnProperty' &&
        m[1] !== 'valueOf' && m[1] !== '__proto__' && m[1] !== '__defineGetter__' &&
        m[1] !== '__defineSetter__' && m[1] !== '__lookupGetter__' && m[1] !== '__lookupSetter__') {
      propNames.add(m[1])
    }
  }

  // 4. 收集 emit 事件名: `emit('X', ...)` 字符串字面量
  const emitNames = new Set<string>()
  for (const m of linesForScan.matchAll(/\bemit\s*\(\s*(['"`])([^'"`]+)\1/g)) {
    emitNames.add(m[2])
  }

  // 5. 检查文件是否已有 defineProps / defineEmits
  const hasDefineProps = /\bdefineProps\s*[(<]/.test(scriptInner)
  const hasDefineEmits = /\bdefineEmits\s*[(<]/.test(scriptInner)

  // 6. 准备要插入的代码
  const insertLines: string[] = []
  if (propNames.size > 0 && !hasDefineProps) {
    const entries = Array.from(propNames).sort().map((n) => `${n}: null`).join(', ')
    insertLines.push(`const props = defineProps({ ${entries} })`)
    utils.manualReview(
      `iter-046: 检测到 setup body 引用 props.${Array.from(propNames).join(', ')}, 但文件没 declare defineProps。` +
      `\n已自动注入 const props = defineProps({ ${entries} })。请补 type/default (e.g. ${Array.from(propNames)[0]}: { type: String, default: '' })。`,
    )
  }
  if (emitNames.size > 0 && !hasDefineEmits) {
    const evs = Array.from(emitNames).sort().map((n) => `'${n}'`).join(', ')
    insertLines.push(`const emit = defineEmits([${evs}])`)
    utils.manualReview(
      `iter-046: 检测到 setup body 引用 emit('${Array.from(emitNames).join("', '")}'), 但文件没 declare defineEmits。` +
      `\n已自动注入 const emit = defineEmits([${evs}])。`,
    )
  }

  if (insertLines.length === 0) return

  // 7. 插入位置: 最后一个 import 之后, 第一个非 import 之前
  const lastImportMatch = [...scriptInner.matchAll(/^[ \t]*import\b[^\n]+/gm)].pop()
  if (lastImportMatch && lastImportMatch.index !== undefined) {
    const insertPos = scriptOpenEnd + lastImportMatch.index + lastImportMatch[0].length
    const newSource =
      source.substring(0, insertPos) +
      '\n\n' + insertLines.join('\n') +
      source.substring(insertPos)
    file.source = newSource
    file.useRawSource = true
    utils.markChanged(`[composition:setup] 注入 defineProps/defineEmits (${propNames.size} props, ${emitNames.size} events)`)
  } else {
    // 没 import — 加在 setup 顶部
    const newSource =
      source.substring(0, scriptOpenEnd) +
      '\n' + insertLines.join('\n') + '\n' +
      source.substring(scriptOpenEnd)
    file.source = newSource
    file.useRawSource = true
    utils.markChanged(`[composition:setup] 注入 defineProps/defineEmits (${propNames.size} props, ${emitNames.size} events)`)
  }
}

function findExportDefaultBlock(scriptText: string): ExportMatch | null {
  // locate "export default" keyword position
  const re = /export\s+default\s*/g
  const m = re.exec(scriptText)
  if (!m)
  return null
  const start = m.index
  // locate `{` position
  let i = m.index + m[0].length
  while (i < scriptText.length && /\s/.test(scriptText[i])) i++
  if (scriptText[i] !== '{')
  return null
  const objStart = i
  // brace-match for matching `}`, handling template literal `${...}` to avoid false positives
  const objEnd = findMatchingClose(scriptText, objStart)
  if (objEnd < 0)
  return null
  // end is objEnd + 1 (include the closing `}`)
  // skip semicolons and newlines
  let end = objEnd + 1
  while (end < scriptText.length && /[\s;]/.test(scriptText[end])) end++
  return { start, end, objStart, objEnd }
}

function findExportDefaultBlockFromAst(
  _scriptInner: string,
): ExportMatch | null {
  // AST approach is unreliable (scriptAst is mutated by previous plugins, node offsets don't align with original source)
  // Fall back to regex approach, but regex misjudges template literal `${...}` braces
  // Now: re-parse clean scriptInner with _babelParserParse, then use AST offset (does not depend on file.scriptAst)
  return findExportDefaultBlockByFreshAst(_scriptInner)
}

/**
 * 独立 babel parse scriptInner, 用 AST 节点 offset 找 export default.
 * 解决 template literal 内的 `${...}` 花括号问题.
 */
function findExportDefaultBlockByFreshAst(scriptInner: string): ExportMatch | null {
  if (!scriptInner) return null
  let ast: any
  try {
    ast = _babelParserParse(scriptInner, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: ['typescript'],
    })
  } catch (e) {
    // babel parse 失败: 退回 regex
    return null
  }
  const stmts: any[] = (ast.program?.body) || []
  for (const stmt of stmts) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration
      if (!decl || decl.type !== 'ObjectExpression') return null
      // babel node offset is relative to the input string (i.e. scriptInner)
      const start = stmt.start
      const end = decl.end
      const objStart = decl.start
      const objEnd = decl.end - 1
      return { start, end, objStart, objEnd }
    }
  }
  return null
}

function findMatchingClose(text: string, openOffset: number): number {
  const open = text[openOffset]
  if (open !== '{' && open !== '[' && open !== '(') return -1
  const close = open === '{' ? '}' : open === '[' ? ']' : ')'
  let depth = 1
  let inString: string | null = null
  let inLineComment = false
  let inBlockComment = false
  for (let i = openOffset + 1; i < text.length; i++) {
    const ch = text[i]
    const next = i + 1 < text.length ? text[i + 1] : ''
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }
    if (ch === open) depth++
    if (ch === close) {
      depth--
      if (depth === 0)
      return i
    }
  }
  return -1
}

function buildNewScript(
  scriptInner: string,
  exportMatch: ExportMatch,
  result: { setupCode: string; vueImports: Set<string>; extraImports: string[] },
): string {
  const beforeExport = scriptInner.substring(0, exportMatch.start)
  const afterExport = scriptInner.substring(exportMatch.end)

  const lines: string[] = ['<script setup>']

  // collect imports to preserve (deduplicated)
const allImports = mergeImports(beforeExport, result.extraImports)
if (allImports.length > 0) { for (const imp of allImports) lines.push(imp)
    lines.push('')
  }

  // vue imports
if (result.vueImports.size > 0) { const sorted = [...result.vueImports].sort()
    lines.push(`import { ${sorted.join(', ')} } from 'vue'`)
    lines.push('')
  }

  // setup code
  lines.push(result.setupCode)

  // preserve afterExport too (e.g. top-level helper functions / code after Vue.extend)
const trimmed = afterExport.trim()
if (trimmed) {
    lines.push('')
    lines.push(trimmed)
  }

  lines.push('</script>')
  return lines.join('\n')
}

/** 合并 beforeExport 的 import 和 extraImports（去重） */
function mergeImports(beforeText: string, extras: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  // 1. import statements in beforeText
  //    note: script may mix \r\n (Windows) and \n (Unix) line endings
  //    注意: 用 [^\n]+ 而不是 [^;]+ 避免贪婪匹配吞掉后续行
  const importRe = /^[ \t]*import\s+[^\n]+$/gm
  let m: RegExpExecArray | null
  while ((m = importRe.exec(beforeText))) {
    const imp = m[0].replace(/\r$/, '').trim()
    if (!seen.has(imp)) {
      seen.add(imp)
      result.push(imp)
    }
  }

  // 2. extras (extra imports generated by composition plugin)
  for (const imp of extras) {
    if (!seen.has(imp)) {
      seen.add(imp)
      result.push(imp)
    }
  }

  return result
}

/**
 * 在 template 块里检测 $route/$router/$store/$emit/$listeners/$scopedSlots 引用，
 * 同步更新 result 标志位，让 setup 注入对应的 const。
 */
function detectTemplateGlobals(source: string, result: ReturnType<typeof convertOptionsToSetup>) {
  const templateMatch = source.match(/<template[^>]*>([\s\S]*?)<\/template>/i)
  if (!templateMatch) return
  const tpl = templateMatch[1]

  // 排除 <script> 里的：但我们只查 template 块，天然排除了 script
  // 但要小心：template 里如果出现 `\$xxx` 形式（转义），其实只是字面量
  // 这里简化：用 \b\$xxx\b 在 template 内容里检测
if (/\$route\b/.test(tpl)) {
    result.routeUsed = true
  }
  if (/\$router\b/.test(tpl)) {
    result.routerUsed = true
  }
  if (/\$store\b/.test(tpl)) {
    result.storeUsed = true
  }
  if (/\$emit\b/.test(tpl)) {
    result.emitUsed = true
  }
  // Vuex state 名：检测 template 是否直接引用了 mapState 出来的名字
  for (const name of result.vuexStateNames) {
    if (new RegExp(`\\b${name}\\b`).test(tpl)) {
      // 在 template 中被引用：把 setup 注入 store 但不修改 state 引用方式
      // 实际在 rewriteTemplateInPlace 中会把 adminInfo → store.adminInfo
    }
  }
  // Vuex action 名：很少在 template 直接调用，但 watch 可能在 script，事件处理器可能在 template
  for (const name of result.vuexActionNames) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(tpl)) {
      // 同上
    }
  }
}

/**
 * 在 source 字符串中重写 <template> 块：
 *  - $route.xxx → route.xxx
 *  - $router(...) → router(...)
 *  - $store.xxx → store.xxx  （注意：Pinia 迁移后可能要改 store.xxx，但这里只做最小改动）
 *  - $emit('foo', x) → emit('foo', x)
 *  - $listeners → $attrs（Vue3 合并）
 *  - $scopedSlots → $slots
 * 只处理 <template>...</template> 块；script/style 块不动。
 */
function rewriteTemplateInPlace(source: string, result: ReturnType<typeof convertOptionsToSetup>): string {
  const re = /(<template[^>]*>)([\s\S]*?)(<\/template>)/i
  const m = re.exec(source)
  if (!m)
  return source
  const tpl = m[2]
  let newTpl = tpl

  if (result.routeUsed) {
    newTpl = newTpl.replace(/\$route\b/g, 'route')
  }
  if (result.routerUsed) {
    newTpl = newTpl.replace(/\$router\b/g, 'router')
  }
  if (result.storeUsed) {
    newTpl = newTpl.replace(/\$store\b/g, 'store')
  }
  if (result.emitUsed) {
    newTpl = newTpl.replace(/\$emit\b/g, 'emit')
  }
  // $listeners / $scopedSlots 总是替换（这俩是 template 上下文）
  if (/\$listeners\b/.test(newTpl)) {
    newTpl = newTpl.replace(/\$listeners\b/g, '$attrs')
  }
  if (/\$scopedSlots\b/.test(newTpl)) {
    newTpl = newTpl.replace(/\$scopedSlots\b/g, '$slots')
  }

  // 处理 data 字段与 import 冲突的重命名: 在 template 中直接引用字段名时也要改
  // 必须在 $xxx 替换之后做, 且要在早期 return 检查之前
  if (result.dataFieldRenames && result.dataFieldRenames.size > 0) {
    for (const [oldName, newName] of result.dataFieldRenames) {
      // 单词边界, 避免误匹配
      const re = new RegExp(`\\b${oldName}\\b`, 'g')
      newTpl = newTpl.replace(re, newName)
    }
  }

  // 处理 template ref 与 data 字段重名: 重命名 ref="xxx" -> ref="xxxRef"
  if (result.refRenames && result.refRenames.size > 0) {
    for (const [oldName, newName] of result.refRenames) {
      const re = new RegExp(`(ref=")${oldName}(")`, 'g')
      newTpl = newTpl.replace(re, `$1${newName}$2`)
    }
  }

  if (newTpl === tpl)
  return source

  // 处理 Vuex 映射的 state 名：在 template 中直接引用 state 字段（adminInfo.xxx）
  // 需替换为 store.xxx
if (result.vuexStateNames.size > 0) { for (const stateName of result.vuexStateNames) {
      // 单词边界，避免误匹配（比如 adminInfo2 不应被匹配）
const re = new RegExp(`\\b${stateName}\\b`, 'g')
      newTpl = newTpl.replace(re, `store.${stateName}`)
    }
  }
  // 处理 Vuex 映射的 action 名：在 template 中 action 一般不直接调用，但万一是事件处理器
if (result.vuexActionNames.size > 0) { for (const actionName of result.vuexActionNames) { const re = new RegExp(`\\b${actionName}\\s*\\(`, 'g')
      newTpl = newTpl.replace(re, `store.dispatch('${actionName}',`)
    }
  }

  return source.substring(0, m.index) + m[1] + newTpl + m[3] + source.substring(m.index + m[0].length)
}

/**
 * 把脚本里的 `const X = Vue.extend({...})` 顶层调用替换成 `const X = defineComponent({...})`。
 * 避免在 Vue3 + <script setup> 里出现 Vue.extend (Vue3 没有 Vue.extend API)。
 *
 * 关键: 只替换实际调用 (后面跟 `(`), 不替换注释里的 "Vue.extend" 字样。
 * 用平衡括号扫描, 避免误匹配嵌套的对象。
 */
function replaceVueExtendInScript(script: string): string {
  // 匹配 "Vue.extend(" 形式, 但确保是独立的 token (前面不是标识符字符)
  // 避免匹配 "myVue.extend" 或 "Vue.extended" 这类
  const re = /(^|[^A-Za-z0-9_$.])Vue\.extend\s*\(/gm
  let out = ''
  let searchFrom = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(script)) !== null) {
    const matchStart = m.index + m[1].length  // start of "Vue.extend" (including m[1] prefix char)
    const matchEnd = matchStart + 'Vue.extend'.length
    out += script.slice(searchFrom, m.index) + m[1]
    // 从 ( 开始, 找匹配的 )
    // 这里必须同时计数 ( 和 { (因为 Vue.extend({...}) 的参数是对象字面量,
    // 对象里有 methods: { fn() { ... } } 这种嵌套的 { 必须被正确处理;
    // 单纯计数 () 在 Vue.extend({data() { return {a:1}}}) 上会错配)
    let openParen = matchEnd
    while (openParen < script.length && /\s/.test(script[openParen])) openParen++
    if (script[openParen] !== '(') {
      // 不是调用, 保留原样
      out += 'Vue.extend'
      searchFrom = matchEnd
      re.lastIndex = matchEnd
      continue
    }
    let parenDepth = 1
    let braceDepth = 0
    let bracketDepth = 0
    let i = openParen + 1
    let inStr: string | null = null
    while (i < script.length && parenDepth > 0) {
      const c = script[i]
      if (inStr) {
        if (c === '\\') { i += 2; continue }
        if (c === inStr) inStr = null
        i++; continue
      }
      if (c === "'" || c === '"' || c === '`') { inStr = c; i++; continue }
      if (c === '/' && script[i + 1] === '/') {
        const eol = script.indexOf('\n', i)
        i = eol < 0 ? script.length : eol
        continue
      }
      if (c === '/' && script[i + 1] === '*') {
        const end = script.indexOf('*/', i + 2)
        i = end < 0 ? script.length : end + 2
        continue
      }
      if (c === '(') parenDepth++
      else if (c === ')') {
        parenDepth--
        if (parenDepth === 0) break
      }
      else if (c === '{') braceDepth++
      else if (c === '}') braceDepth--
      else if (c === '[') bracketDepth++
      else if (c === ']') bracketDepth--
      i++
    }
    if (parenDepth !== 0) {
      // 不平衡, 退回原样
      out += 'Vue.extend'
      searchFrom = matchEnd
      re.lastIndex = matchEnd
      continue
    }
    // 现在 i 指向匹配的 ) . 把整个 Vue.extend(args) 替换为 defineComponent(args)
    // args 从 openParen 开始 (含括号) 到 i+1 (含闭括号)
    const argsText = script.substring(openParen, i + 1)
    out += 'defineComponent' + argsText
    searchFrom = i + 1
    re.lastIndex = i + 1
  }
  if (searchFrom < script.length) out += script.slice(searchFrom)
  return out
}

registerPlugin(plugin)
export default plugin
