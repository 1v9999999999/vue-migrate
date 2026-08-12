/**
 * @vue-migrate/plugin-ts-decorator
 *
 * iter-119: Convert TypeScript class-based Vue 2 components (vue-property-decorator
 * + vue-class-component + vuex-class) to Vue 3 `<script setup>` form.
 *
 * 背景：composition plugin 只处理 Options API (`export default { ... }`)。
 *       TS class-based components 会被它跳过。本 plugin 在 composition 之前跑,
 *       把 class form 转成 `<script setup>` form, composition 看到 <script setup>
 *       就自动跳过 (走 iter-046 的 defineProps/defineEmits 注入路径)。
 *
 * 支持的 decorator + 写法:
 *   - @Component (vue-class-component)      - 组件注册
 *   - @Prop({...}) (vue-property-decorator) - → const props = defineProps({...})
 *   - @Watch('key')                         - → watch(key, (newVal, oldVal) => {...})
 *   - @Emit('event')                        - → emit + 重新触发 (TODO: manual review)
 *   - @State('user') (vuex-class)           - → const user = computed(() => useStore().state.user)
 *   - @Getter('token') (vuex-class)         - → const token = computed(() => useStore().getters.token)
 *   - @Action('login') (vuex-class)         - → const login = (payload) => useStore().dispatch('login', payload)
 *   - 生命周期方法 (mounted/beforeDestroy 等) - → onMounted/onBeforeUnmount
 *   - getter 方法 (get xxx() { return ... }) - → computed(() => ...)
 *   - 普通方法 (methods)                    - → function (this.xxx → xxx.value)
 *   - class field (count = 0)               - → const count = ref(0)
 *   - class field (name: string = '')       - → const name = ref<string>('')
 *
 * 限制 (manual review):
 *   - @Component({ components: {...} }) - 组件注册,需手动
 *   - @Component({ mixins: [...] })    - mixin 仍需重构
 *   - @Emit 的 method 体内可能 this 调用其他 state
 *   - 复杂继承 (MyComp extends mixins(X, Y))
 *
 * 策略:
 *   priority = 1 (在 composition 0 之前跑, 这样 composition 看到 <script setup> 就 bails)
 *   字符串级别转换 (类似 composition plugin): 重写 file.source 的 script 块
 *   不依赖 traverse, 改用 babel parser (支持 decorators-legacy) AST 读 class 结构
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import * as _babelParser from '@babel/parser'
// @ts-ignore
const _babelParserObj: any = (_babelParser as any).default || _babelParser
const _babelParserParse: (code: string, opts?: any) => any =
  _babelParserObj.parse || _babelParserObj.default?.parse || _babelParserObj

// @ts-ignore
import type * as t from '@babel/types'
import { convertClassComponentToSetup, type ClassComponentResult } from './class-to-setup.js'

/**
 * Quick detection: does the script contain a class component?
 *
 * Triggers we check for (string-based, fast):
 *   - `@Component` decorator
 *   - `extends Vue` (vue-class-component)
 *   - `extends mixins(` (vue-class-component)
 *   - `@Prop` / `@Watch` / `@Emit` (vue-property-decorator)
 *   - `@State` / `@Getter` / `@Action` (vuex-class)
 *
 * We don't strictly require all — if the script looks like it has any of these
 * patterns, we attempt a parse + transform. If the transform yields nothing,
 * we just return.
 */
function looksLikeClassComponent(source: string): boolean {
  if (!source) return false
  return (
    /@Component\b/.test(source) ||
    /@Prop\s*\(/.test(source) ||
    /@Watch\s*\(/.test(source) ||
    /@Emit\s*\(/.test(source) ||
    /@State\s*\(/.test(source) ||
    /@Getter\s*\(/.test(source) ||
    /@Action\s*\(/.test(source) ||
    /@Provide\s*\(/.test(source) ||
    /@Inject\s*\(/.test(source) ||
    /@Ref\s*\(/.test(source) ||
    /\bclass\s+\w+\s+extends\s+(?:Vue|mixins)/.test(source)
  )
}

const plugin: TransformPlugin = {
  name: 'ts-decorator',
  description:
    'iter-119: Convert TypeScript class-based Vue components (vue-property-decorator + vue-class-component + vuex-class) to Vue 3 <script setup> form.',
  priority: 1, // run after this-replacer(5)/vue3-types(5)/vite-compat(5) but BEFORE composition(0)

  fileKinds: ['vue', 'ts', 'tsx'],

  transform(ctx: TransformContext) {
    const { file, utils, log } = ctx

    // iter-118: respect file-level skip lock (Nuxt special functions etc.)
    if ((file as any).__skipped) {
      log(`[ts-decorator] file ${file.relativePath} skipped (${(file as any).__skipped})`)
      return
    }

    // 0. CRITICAL: resync sfc.script.loc from current file.source (composition already does this, we need it too)
    resyncScriptLoc(file)

    // For .vue: check the script block; for .ts/.tsx: check file.source
    let scriptInner: string
    let scriptOuterStart: number  // offset of <script in file.source (for .vue) or 0 (for .ts)
    let scriptOuterEnd: number    // offset of </script> in file.source (for .vue) or file.source.length (for .ts)
    let isVueFile = file.kind === 'vue'

    if (isVueFile) {
      const scriptBlock = file.sfc?.script
      if (!scriptBlock) return
      // Re-derive from current source to avoid stale loc
      const source = file.source
      const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
      if (!scriptOpenMatch || scriptOpenMatch.index === undefined) return
      const scriptOpenEnd = scriptOpenMatch.index + scriptOpenMatch[0].length
      const scriptCloseIdx = source.indexOf('</script>', scriptOpenEnd)
      if (scriptCloseIdx < 0) return
      scriptInner = source.substring(scriptOpenEnd, scriptCloseIdx)
      scriptOuterStart = scriptOpenMatch.index
      scriptOuterEnd = scriptCloseIdx + '</script>'.length
    } else {
      scriptInner = file.source
      scriptOuterStart = 0
      scriptOuterEnd = file.source.length
    }

    // Quick detection: if no class-component markers, bail
    if (!looksLikeClassComponent(scriptInner)) {
      return
    }

    // Already a <script setup>? The iter-046 path in composition will handle
    // defineProps/defineEmits injection. We don't touch script-setup files.
    if (isVueFile) {
      const scriptOpenMatch = file.source.match(/<script\b[^>]*>/i)
      if (scriptOpenMatch && /\bsetup\b/.test(scriptOpenMatch[0])) {
        log(`[ts-decorator] file ${file.relativePath} already has <script setup>, skipping class conversion`)
        return
      }
    }

    // Parse scriptInner with TypeScript + decorators-legacy + classProperties
    // (TS + decorator classes need all three).
    // iter-123: also add 'jsx' for .tsx files (so MyTsx.tsx with JSX render() can be parsed).
    const isTsx = file.kind === 'tsx' ||
      (file.kind === 'vue' && file.sfc?.script?.lang === 'tsx')
    let ast: any
    try {
      ast = _babelParserParse(scriptInner, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: [
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'optionalChaining',
          'nullishCoalescingOperator',
          ...(isTsx ? ['jsx' as const] : []),
        ],
      })
    } catch (e: any) {
      // babel parse failed — probably not a class component after all
      // (e.g. someone wrote `@Component` in a comment, or the syntax is JSX etc.)
      log(`[ts-decorator] parse failed for ${file.relativePath}: ${e.message}`)
      return
    }

    // Find the export default class declaration
    const exportDefaultClass = findExportDefaultClass(ast)
    if (!exportDefaultClass) {
      // Not a class component after all (e.g. `@Component` in import only)
      return
    }

    // Convert
    const isTsLang = isVueFile
      ? (file.sfc?.script?.lang === 'ts' || file.sfc?.script?.lang === 'tsx')
      : (file.kind === 'ts' || file.kind === 'tsx')

    let result: ClassComponentResult
    try {
      result = convertClassComponentToSetup(exportDefaultClass, scriptInner, isTsLang)
    } catch (e: any) {
      // Conversion failed — fall back to manual review
      log(`[ts-decorator] conversion failed for ${file.relativePath}: ${e.message}`)
      utils.manualReview(
        `iter-119: TS class component conversion failed: ${e.message}\n` +
        `请手动拆解 class 为 <script setup> 形式 (e.g. class field → ref, method → function, @State → useStore().state.X)。`,
      )
      return
    }

    if (!result.changed || !result.setupCode) {
      return
    }

    // Build the new <script setup> block
    const newScriptBlock = buildNewScriptBlock(scriptInner, result, isTsLang, isVueFile)

    // Inject review items
    for (const r of result.reviewItems) {
      utils.manualReview(`iter-119: ${r}`)
    }

    // Update file.source
    if (isVueFile) {
      // Replace <script ...>...</script> with new <script setup lang="ts">...</script>
      const source = file.source
      const newSource =
        source.substring(0, scriptOuterStart) +
        newScriptBlock +
        source.substring(scriptOuterEnd)
      file.source = newSource
      file.useRawSource = true

      // Sync sfc.script
      const scriptBlock = file.sfc!.script!
      scriptBlock.content = newScriptBlock
      // Compute new loc — start is the open <script setup ...>, end is the </script>
      const newOpenMatch = newScriptBlock.match(/<script\b[^>]*>/i)
      if (newOpenMatch && newOpenMatch.index !== undefined) {
        scriptBlock.loc.start.offset = scriptOuterStart + newOpenMatch.index
        scriptBlock.content = newScriptBlock.substring(
          newOpenMatch.index + newOpenMatch[0].length,
          newScriptBlock.lastIndexOf('</script>'),
        )
        scriptBlock.loc.end.offset =
          scriptBlock.loc.start.offset + scriptBlock.content.length
        if (scriptBlock.attrs) {
          scriptBlock.attrs.setup = true
        }
      }
    } else {
      // .ts / .tsx file — replace the whole source
      file.source = newScriptBlock
      file.useRawSource = true
    }

    utils.markChanged(
      `[ts-decorator] class → <script setup> (${result.vueImports.size} imports, ${result.setupCode.split('\n').length} lines, ${result.classMembers} members)`,
    )
  },
}

/**
 * Find the export default class declaration. Returns the ClassDeclaration/ClassExpression
 * node, or null if not found.
 */
function findExportDefaultClass(ast: any): t.ClassDeclaration | t.ClassExpression | null {
  const stmts: any[] = ast.program?.body || []
  for (const stmt of stmts) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      const decl = stmt.declaration
      if (decl && (decl.type === 'ClassDeclaration' || decl.type === 'ClassExpression')) {
        return decl
      }
    }
  }
  return null
}

/**
 * Re-derive sfc.script.loc and .content from current file.source.
 * Same logic as composition plugin (we can't depend on the composition plugin
 * having run yet because we run BEFORE it).
 */
function resyncScriptLoc(file: any): void {
  if (!file?.sfc?.script) return
  if (file.kind !== 'vue') return
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
 * Build the new <script setup> block (or .ts file content) by:
 *   1. Preserving user imports (deduped)
 *   2. Adding Vue 3 setup imports (ref, reactive, computed, watch, onMounted, etc.)
 *   3. Adding vuex pinia / vue-router / element imports as needed
 *   4. Emitting the generated setup code
 */
function buildNewScriptBlock(
  scriptInner: string,
  result: ClassComponentResult,
  isTsLang: boolean,
  isVueFile: boolean,
): string {
  // 1. Collect user imports (everything before export default)
  const exportMatch = scriptInner.match(/export\s+default\s+(?:abstract\s+)?class\b/)
  const beforeExport = exportMatch && exportMatch.index !== undefined
    ? scriptInner.substring(0, exportMatch.index)
    : scriptInner

  const userImports: string[] = []
  const importRe = /^[ \t]*import\s+[^\n]+$/gm
  let m: RegExpExecArray | null
  while ((m = importRe.exec(beforeExport)) !== null) {
    const imp = m[0].replace(/\r$/, '').trim()
    if (!userImports.includes(imp)) userImports.push(imp)
  }

  // 2. Build new script
  const lines: string[] = []

  if (isVueFile) {
    lines.push(isTsLang ? '<script setup lang="ts">' : '<script setup>')
  }
  // (For .ts/.tsx files: no <script> wrapper, the whole file IS the module)

  // 2a. User imports (deduped, only if not already added)
  const seenImports = new Set<string>()
  for (const imp of userImports) {
    if (!seenImports.has(imp)) {
      seenImports.add(imp)
      lines.push(imp)
    }
  }

  // 2b. Extra imports (e.g. 'import { useStore } from "vuex"')
  for (const imp of result.extraImports) {
    if (!seenImports.has(imp)) {
      seenImports.add(imp)
      lines.push(imp)
    }
  }

  // 2c. Vue 3 imports
  if (result.vueImports.size > 0) {
    if (userImports.length > 0 || result.extraImports.length > 0) {
      lines.push('')
    }
    const sorted = [...result.vueImports].sort()
    lines.push(`import { ${sorted.join(', ')} } from 'vue'`)
  }

  // 2d. Setup code
  if (lines.length > 0) {
    lines.push('')
  }
  lines.push(result.setupCode)

  if (isVueFile) {
    lines.push('</script>')
  }
  return lines.join('\n')
}

registerPlugin(plugin)
export default plugin
