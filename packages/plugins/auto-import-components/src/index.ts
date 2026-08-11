/**
 * @vue-migrate/plugin-auto-import-components
 *
 * iter-049a P1 #16/#17/#18: 扫 <template> 里的 custom tag, 检查 <script setup> 是否 import,
 * 缺的就自动 import.
 *
 * 适用场景 (iter-048 B 阶段 bug):
 *   - views/tab/index.vue 用 <tab-pane> 但没 import → "Unknown custom element" 警告
 *   - views/excel/upload-excel.vue 用 <upload-excel-component> 但没 import → 整个页面空白
 *   - views/profile/components/Activity.vue 用 <Share /> 但没 import → 图标空白
 *
 * 工作方式:
 *   1) 解析 <template> 内所有 tag name (用 babel 解析 template 块, 拿到 <JSXElement> openingElement.name)
 *   2) 解析 <script> 块的 ImportDeclaration + 默认 setup 已经 import 的名字
 *   3) 已知跳过集: HTML 原生 + Vue3 内置 + Element Plus 全局 + SVG
 *   4) 对每个 missing tag, 推断可能的 .vue 路径:
 *      - 同目录 components/{Tag}.vue          (e.g. tab-pane → ./components/TabPane.vue)
 *      - 同目录 components/{Tag-kebab->Pascal}.vue
 *      - src/components/{Tag-kebab->Pascal}/{Tag-kebab->Pascal}.vue
 *      - src/components/{Tag-kebab->Pascal}/index.vue
 *      - 当前目录下 {Tag-kebab->Pascal}.vue
 *   5) 找到存在的 → 注入 import; 找不到 → manualReview
 *
 * 实现策略:
 *   - 改 file.source 直接重写 script 块 (与 composition 类似)
 *   - 标记 file.useRawSource = true
 *   - 在注入 import 后, 调 manualReview 让用户确认路径
 *   - 已在 script setup 里的不重复加
 *
 * Priority: -10 (在 composition 之后跑, 补 composition 丢的 import)
 *   - composition 转换时, 原版 `import TabPane from './components/TabPane'` 在新 <script setup> 里有时会被丢
 *     (因为 composition 严格按 export default 段 + beforeExport 重写 script, beforeExport 里的 imports
 *     是从原 source 提的, 但 iter-048 B 阶段如果 source 已经被前面的 plugin 改过, beforeExport 可能
 *     不含原 imports, 导致 setup 顶部的 import 段空)
 *   - auto-import-components 跑在 composition 之后, 看到的是 setup 后的 source, 没 import 的 tag 会被补
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { parse as parseSfc } from '@vue/compiler-sfc'

/** HTML 原生 + SVG + Vue 3 内置 + Element Plus 全局 — 这些 tag 不需要 import */
const KNOWN_TAGS = new Set<string>([
  // HTML 原生
  'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer', 'main', 'section', 'article', 'aside', 'nav',
  'form', 'input', 'textarea', 'button', 'select', 'option', 'label', 'fieldset', 'legend',
  'video', 'audio', 'source', 'canvas', 'iframe', 'object', 'embed', 'area', 'map',
  'br', 'hr', 'pre', 'code', 'em', 'strong', 'b', 'i', 'u', 's', 'sub', 'sup', 'small', 'big',
  'dl', 'dt', 'dd', 'figure', 'figcaption', 'blockquote', 'q', 'cite', 'abbr', 'time', 'mark',
  // Vue 3 内置
  'template', 'slot', 'component', 'keep-alive', 'transition', 'transition-group', 'teleport', 'suspense', 'fragment',
  // SVG
  'svg', 'path', 'circle', 'rect', 'g', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'mask', 'clipPath', 'filter',
  'use', 'symbol', 'image', 'foreignObject', 'marker', 'view',
  // Element Plus 全局 (el- 前缀跳过 — 全部 set, 简化)
  'el-button', 'el-button-group', 'el-input', 'el-input-number', 'el-textarea',
  'el-select', 'el-option', 'el-option-group', 'el-cascader', 'el-cascader-panel',
  'el-switch', 'el-slider', 'el-radio', 'el-radio-group', 'el-radio-button',
  'el-checkbox', 'el-checkbox-group', 'el-checkbox-button',
  'el-form', 'el-form-item', 'el-form-renderer',
  'el-table', 'el-table-column', 'el-table-filter-panel',
  'el-tag', 'el-tabs', 'el-tab-pane', 'el-alert', 'el-badge', 'el-card', 'el-collapse', 'el-collapse-item',
  'el-dropdown', 'el-dropdown-menu', 'el-dropdown-item',
  'el-menu', 'el-menu-item', 'el-submenu', 'el-menu-item-group',
  'el-dialog', 'el-drawer', 'el-popover', 'el-tooltip', 'el-popconfirm', 'el-popper',
  'el-pagination', 'el-page-header',
  'el-upload', 'el-upload-dragger', 'el-upload-list',
  'el-tree', 'el-tree-node',
  'el-progress', 'el-loading', 'el-spinner', 'el-skeleton', 'el-skeleton-item',
  'el-notification', 'el-message', 'el-message-box',
  'el-breadcrumb', 'el-breadcrumb-item',
  'el-steps', 'el-step',
  'el-rate', 'el-color-picker', 'el-transfer', 'el-carousel', 'el-carousel-item',
  'el-image', 'el-image-viewer', 'el-avatar', 'el-empty',
  'el-affix', 'el-backtop', 'el-anchor', 'el-anchor-link', 'el-link', 'el-divider',
  'el-result', 'el-watermark', 'el-config-provider', 'el-icon',
  'el-row', 'el-col', 'el-container', 'el-header', 'el-aside', 'el-main', 'el-footer',
  'el-space', 'el-segmented', 'el-tour', 'el-tour-step',
  'el-descriptions', 'el-descriptions-item', 'el-empty',
  'el-scrollbar', 'el-infinite-scroll', 'el-virtual-list',
  // 一些原项目常见全局 (svg-icon 在 main.js 注册)
  'svg-icon',
])

/** kebab-case → PascalCase: 'tab-pane' → 'TabPane', 'upload-excel-component' → 'UploadExcelComponent' */
export function kebabToPascal(s: string): string {
  return s
    .split('-')
    .filter((p) => p.length > 0)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
}

/**
 * 从 template 块提取所有 custom tag 名 (粗略 regex 扫描, 跳过已知 KNOWN_TAGS)
 *  - 匹配 <Tag ...>  或  <Tag/>
 *  - 不匹配 v-for 等指令
 */
export function extractTemplateTags(source: string): string[] {
  const tmplMatch = source.match(/<template[^>]*>([\s\S]*?)<\/template>/i)
  if (!tmplMatch) return []
  const tpl = tmplMatch[1]
  // 提取 tag: <Tag (但跳过 <el-icon> 内的 Share 这种已经在 el-icon 内的)
  // 简单: 匹配 <([a-z][a-z0-9-]*)
  const tagRe = /<\s*([a-z][a-z0-9-]*)\b/gi
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(tpl)) !== null) {
    const tag = m[1].toLowerCase()
    found.add(tag)
  }
  return [...found]
}

/** 从 script 块提取已 import 的所有名字 (default + named) */
export function extractScriptImports(source: string): Set<string> {
  const scriptMatch = source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)
  if (!scriptMatch) return new Set()
  const scriptInner = scriptMatch[1]
  const names = new Set<string>()

  // 逐行处理: import 语句通常一行一条. 跳过 side-effect import (没 binding clause + 没 from)
  // 例: `import './waves.css'` 跳过; `import X from './x'` 加 X; `import { A, B as C } from './y'` 加 A, C
  for (const rawLine of scriptInner.split(/\r?\n/)) {
    const line = rawLine.trim()
    // 跳过注释行
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue
    // 必须以 import 开头
    if (!/^import\b/.test(line)) continue
    // 必须有 from — 否则是 side-effect (import './foo.css')
    if (!/\bfrom\b/.test(line)) continue
    // 提取 binding clause: 去掉 import 前缀和 from '...' 后缀
    // 例: import { A, B as C } from 'y'  →  binding = { A, B as C }
    // 例: import X from 'y'              →  binding = X
    // 例: import * as X from 'y'         →  binding = * as X
    // 例: import X, { A } from 'y'       →  binding = X, { A }
    const m = line.match(/^import\s+([\s\S]+?)\s+from\s+['"][^'"]+['"]\s*;?\s*$/)
    if (!m) continue
    const clause = m[1].trim()
    if (!clause) continue
    // 解析 clause
    const braceMatch = clause.match(/\{([^}]*)\}/)
    if (braceMatch) {
      const parts = braceMatch[1].split(',')
      for (const p of parts) {
        const trimmed = p.trim()
        if (!trimmed) continue
        const asMatch = trimmed.match(/^(.+?)\s+as\s+(\w+)$/)
        const name = asMatch ? asMatch[2] : trimmed.replace(/\s+/g, '')
        if (name) names.add(name)
      }
    }
    const beforeBrace = clause.split('{')[0].trim()
    const tokens = beforeBrace.split(',').map((t) => t.trim()).filter(Boolean)
    for (const t of tokens) {
      if (t.startsWith('*')) {
        const asM = t.match(/as\s+(\w+)/)
        if (asM) names.add(asM[1])
      } else {
        names.add(t)
      }
    }
  }
  return names
}

/** 推断 tag 的 .vue 路径, 返回 [可能路径, ...] (按优先级排序) */
export function inferComponentPaths(
  fromFile: string,
  ctxRoot: string,
  tag: string,
): string[] {
  const pascal = kebabToPascal(tag)
  // 标准化 separator: 统一成 / (Windows 兼容,existsSync 也接受)
  const normCtxRoot = ctxRoot.replace(/\\/g, '/').replace(/\/$/, '')
  const normFromFile = fromFile.replace(/\\/g, '/')
  const fromDir = dirname(normFromFile)
  let normRel: string
  if (fromDir.startsWith(normCtxRoot + '/')) {
    normRel = fromDir.slice(normCtxRoot.length + 1)
  } else {
    // 不在 ctxRoot 下 (e.g. 是绝对路径但 separator mismatch), 用 basename 倒推
    normRel = fromDir
  }
  normRel = normRel.replace(/^\//, '')

  // 候选 Pascal 变体 (适应 <upload-excel-component> → UploadExcel / 去掉 -component 后缀的命名)
  // 例: <upload-excel-component> → UploadExcelComponent (原始), UploadExcel (去 -component), Upload
  const pascalVariants = new Set<string>([pascal])
  for (const suffix of ['Component', 'Item', 'Panel', 'Group', 'Container', 'Wrapper', 'View']) {
    if (pascal.endsWith(suffix)) {
      const trimmed = pascal.slice(0, -suffix.length)
      if (trimmed.length > 0) pascalVariants.add(trimmed)
    }
  }
  // 例: <app-main> → AppMain (原始), App
  if (/^[A-Z][a-z]+$/.test(pascal) === false) {
    // 多个 Pascal 段: <foo-bar-baz> → 试试去掉最后一段 (FooBar)
    const parts = pascal.split(/(?=[A-Z])/).filter((p) => p.length > 0)
    if (parts.length > 1) {
      pascalVariants.add(parts.slice(0, -1).join(''))
    }
  }

  // 候选路径 (相对 ctxRoot):
  // 路径深度从浅到深, 找到任意一个就优先返回
  const candidates: string[] = []
  for (const p of pascalVariants) {
    // 1) 当前目录 components/{P}.vue
    candidates.push(join(normRel, 'components', `${p}.vue`).replace(/\\/g, '/'))
    // 2) 上一级 components/{P}.vue
    candidates.push(join(normRel, '..', 'components', `${p}.vue`).replace(/\\/g, '/'))
    // 3) 当前目录 components/{P}/{P}.vue
    candidates.push(join(normRel, 'components', p, `${p}.vue`).replace(/\\/g, '/'))
    // 4) 上一级 components/{P}/{P}.vue
    candidates.push(join(normRel, '..', 'components', p, `${p}.vue`).replace(/\\/g, '/'))
    // 5) 当前目录 components/{P}/index.vue
    candidates.push(join(normRel, 'components', p, 'index.vue').replace(/\\/g, '/'))
    // 6) 上一级 components/{P}/index.vue
    candidates.push(join(normRel, '..', 'components', p, 'index.vue').replace(/\\/g, '/'))
    // 7) 上二级 components/{P}/index.vue (适配 src/views/xxx/*.vue → src/components/XXX/index.vue)
    candidates.push(join(normRel, '..', '..', 'components', p, 'index.vue').replace(/\\/g, '/'))
    // 8) 上二级 components/{P}.vue
    candidates.push(join(normRel, '..', '..', 'components', `${p}.vue`).replace(/\\/g, '/'))
    // 9) 上二级 components/{P}/{P}.vue
    candidates.push(join(normRel, '..', '..', 'components', p, `${p}.vue`).replace(/\\/g, '/'))
    // 10) 同目录 {P}.vue
    candidates.push(join(normRel, `${p}.vue`).replace(/\\/g, '/'))
  }
  // kebab 形式 (e.g. upload-excel, file-tree) — 有些项目文件直接用 kebab
  candidates.push(join(normRel, 'components', `${tag}.vue`).replace(/\\/g, '/'))
  candidates.push(join(normRel, '..', 'components', `${tag}.vue`).replace(/\\/g, '/'))
  candidates.push(join(normRel, '..', '..', 'components', `${tag}.vue`).replace(/\\/g, '/'))

  // 验证存在 — 只返回存在的 (按 candidates 顺序)
  const out: string[] = []
  for (const c of candidates) {
    const abs = normCtxRoot + '/' + c
    if (existsSync(abs)) {
      out.push(c)
    }
  }
  return out
}

/** 从推断的路径生成 import 路径 (相对 fromFile) */
export function pathToImport(
  fromFile: string,
  ctxRoot: string,
  sourceRel: string,
): string {
  // sourceRel 是相对 ctxRoot 的路径, 要转成相对 fromFile 的 import 路径
  // 用绝对路径然后 relative(fromDir, sourceAbs)
  const fromDir = dirname(fromFile)
  const sourceAbs = join(ctxRoot, sourceRel)
  let rel = relative(fromDir, sourceAbs).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel
  return rel
}

const plugin: TransformPlugin = {
  name: 'auto-import-components',
  description:
    'Scan <template> for custom tags; if used but not imported in <script setup>, auto-inject import. Resolves P1 #16 (tab-pane), #17 (upload-excel-component), #18 (Share icon), and many other missing imports.',
  priority: -10,
  fileKinds: ['vue'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    const source = file.source
    if (!source) return

    // 1) 提取 template tags
    const tags = extractTemplateTags(source)
    if (process.env.DBG_AUTO_IMPORT) {
      console.log(`[DBG-AUTO-IMPORT] ${file.relativePath} template tags:`, tags.filter((t) => !KNOWN_TAGS.has(t)))
    }
    if (tags.length === 0) return

    // 2) 提取已 import 的名字
    const imported = extractScriptImports(source)
    if (process.env.DBG_AUTO_IMPORT) {
      console.log(`[DBG-AUTO-IMPORT] ${file.relativePath} imported:`, [...imported])
    }

    // 3) 找 missing (used in template but not imported + not in KNOWN_TAGS)
    const missing: { tag: string; pascal: string; srcRel: string; importPath: string }[] = []
    const unknown: string[] = []

    for (const tag of tags) {
      if (KNOWN_TAGS.has(tag)) continue
      const pascal = kebabToPascal(tag)
      if (imported.has(pascal) || imported.has(tag)) continue
      // 推断路径
      const cands = inferComponentPaths(file.path, ctx.project.root, tag)
      // 第一个候选就是我们要的
      const first = cands[0]
      if (process.env.DBG_AUTO_IMPORT) {
        console.log(`[DBG-AUTO-IMPORT] tag=${tag} pascal=${pascal} fromFile=${file.path} ctx.root=${ctx.project.root} cands=`, cands)
      }
      if (first) {
        // 用 ctx.root 算 import 路径
        const importPath = pathToImport(file.path, ctx.project.root, first)
        missing.push({ tag, pascal, srcRel: first, importPath })
      } else {
        unknown.push(tag)
      }
    }

    if (missing.length === 0 && unknown.length === 0) {
      if (process.env.DBG_AUTO_IMPORT) {
        console.log(`[DBG-AUTO-IMPORT] ${file.relativePath} no missing or unknown`)
      }
      // 2b) 即使没 .vue 路径, 还要检查 Element Plus icons — PascalCase tag (e.g. Share, Document) → @element-plus/icons-vue
      maybeAddIconsVueImport(tags, imported, file, utils)
      return
    }

    // 4) 注入 import 到 script 块
    if (missing.length > 0) {
      const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
      if (!scriptOpenMatch || scriptOpenMatch.index === undefined) return
      const scriptOpenEnd = scriptOpenMatch.index + scriptOpenMatch[0].length
      const scriptCloseIdx = source.indexOf('</script>', scriptOpenEnd)
      if (scriptCloseIdx < 0) return
      const scriptInner = source.substring(scriptOpenEnd, scriptCloseIdx)

      // 去重 + 合并同名 import
      const grouped = new Map<string, string[]>()  // importPath -> [name, ...]
      for (const m of missing) {
        const arr = grouped.get(m.importPath) || []
        if (!arr.includes(m.pascal)) arr.push(m.pascal)
        grouped.set(m.importPath, arr)
      }

      // 构造新 import 行
      const newImportLines: string[] = []
      for (const [importPath, names] of grouped) {
        if (names.length === 1) {
          newImportLines.push(`import ${names[0]} from '${importPath}'`)
        } else {
          newImportLines.push(`import { ${names.join(', ')} } from '${importPath}'`)
        }
      }

      // 找最后一个 import 语句, 在其后插入
      const lastImportMatch = [...scriptInner.matchAll(/^[ \t]*import\s+[^\n]+/gm)].pop()
      let insertPos: number
      if (lastImportMatch && lastImportMatch.index !== undefined) {
        insertPos = scriptOpenEnd + lastImportMatch.index + lastImportMatch[0].length
      } else {
        // 没 import, 加在 <script> 之后
        insertPos = scriptOpenEnd
      }

      const before = source.substring(0, insertPos)
      const after = source.substring(insertPos)
      const injectText = '\n' + newImportLines.join('\n')
      file.source = before + injectText + after
      file.useRawSource = true
      utils.markChanged(`[auto-import] 注入 ${missing.length} 个 import: ${missing.map((m) => m.pascal).join(', ')}`)
      utils.manualReview(
        `[auto-import-components] 已在 ${file.relativePath} 注入 import ${missing.map((m) => `${m.pascal} from '${m.importPath}'`).join('; ')}。` +
        `请确认路径正确 (推断自 template 用法 + 同目录 components/ 扫描)。`,
      )
    }

    // 5) 找不到的 tag — manual review
    if (unknown.length > 0) {
      utils.manualReview(
        `[auto-import-components] ${file.relativePath} 模板里用了 <${unknown.join('>, <')}> 但无法推断 .vue 路径。` +
        `请手写 import, 或在 main.js 用 app.component() 全局注册。`,
      )
    }

    // 2b) Element Plus icons: 任何 PascalCase tag (e.g. Share, Document) → 试从 @element-plus/icons-vue import
    maybeAddIconsVueImport(tags, imported, file, utils)
  },
}

/**
 * 检测 template 里所有 PascalCase tag (e.g. Share, Document, Clock, CaretBottom) 是不是 Element Plus icons,
 * 如果是 + 没 import, 加 `import { Name } from '@element-plus/icons-vue'`
 */
function maybeAddIconsVueImport(
  tags: string[],
  imported: Set<string>,
  file: any,
  utils: any,
): void {
  // PascalCase 检测: 首字母大写, 其余不含 - (因为我们的 extractTemplateTags 都 lowercase 了)
  // 但 extractTemplateTags 用了 toLowerCase(), 我们用原始 source 重新提取
  const source = file.source
  if (!source) return
  const tmplMatch = source.match(/<template[^>]*>([\s\S]*?)<\/template>/i)
  if (!tmplMatch) return
  const tpl = tmplMatch[1]
  // 找所有 PascalCase tag (不 lowercase): <Share /> <Document /> <Clock /> ...
  const pascalRe = /<\s*([A-Z][a-zA-Z0-9]+)\b/g
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = pascalRe.exec(tpl)) !== null) {
    found.add(m[1])
  }
  if (found.size === 0) return

  // 过滤: 缺哪些没 import 的
  const needed = [...found].filter((n) => !imported.has(n))
  if (needed.length === 0) return

  // 构造新 import 行
  const newImportLine = `import { ${needed.join(', ')} } from '@element-plus/icons-vue'`

  // 找 script 块
  const scriptOpenMatch = source.match(/<script\b[^>]*>/i)
  if (!scriptOpenMatch || scriptOpenMatch.index === undefined) return
  const scriptOpenEnd = scriptOpenMatch.index + scriptOpenMatch[0].length
  const scriptCloseIdx = source.indexOf('</script>', scriptOpenEnd)
  if (scriptCloseIdx < 0) return
  const scriptInner = source.substring(scriptOpenEnd, scriptCloseIdx)

  // 找最后一个 import
  const lastImportMatch = [...scriptInner.matchAll(/^[ \t]*import\s+[^\n]+/gm)].pop()
  let insertPos: number
  if (lastImportMatch && lastImportMatch.index !== undefined) {
    insertPos = scriptOpenEnd + lastImportMatch.index + lastImportMatch[0].length
  } else {
    insertPos = scriptOpenEnd
  }

  const before = source.substring(0, insertPos)
  const after = source.substring(insertPos)
  file.source = before + '\n' + newImportLine + after
  file.useRawSource = true
  utils.markChanged(`[auto-import:icons-vue] 注入 ${needed.length} 个 icon: ${needed.join(', ')}`)
  utils.manualReview(
    `[auto-import-components] 已在 ${file.relativePath} 注入 ${newImportLine} (推测自 template 里的 PascalCase tag, 大概率是 @element-plus/icons-vue 的 icon 组件)。`,
  )
}

registerPlugin(plugin)
export default plugin

// 暴露给单测
export const _testable = {
  extractTemplateTags,
  extractScriptImports,
  inferComponentPaths,
  kebabToPascal,
  pathToImport,
  KNOWN_TAGS,
}
