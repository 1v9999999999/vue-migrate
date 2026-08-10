/**
 * 规则 E.6, E.27: el-icon-xxx class / icon prop 转新版 icon 组件
 *
 * ElementUI 用 `class="el-icon-search"` 或 `icon="el-icon-search"` 形式
 * Element Plus 用 `<el-icon><Search /></el-icon>` 形式
 *
 * 转换策略：
 *   - 简单情况：class="el-icon-xxx" → 标 review（建议手动改成 el-icon 组件）
 *   - 自动：icon="el-icon-xxx" → 改用 el-icon 包裹的占位，并标 review
 */

import {
  scanAllElements,
  findAttr,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import {
  applyEdits,
  type TextEdit,
} from '../../../vue3-template/src/utils/template-editor'
import { replaceTemplateContent } from '../utils/sfc-source.js'

export interface IconTransformResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
  iconNames: string[]  // iter-036: 收集转换用的 icon component names (CaretTop/Plus/Search 等), 用于自动加 import
}

const ELEMENT_ICON_MAP: Record<string, string> = {
  'el-icon-info': 'Info',
  'el-icon-success': 'SuccessFilled',
  'el-icon-warning': 'Warning',
  'el-icon-error': 'CircleClose',
  'el-icon-question': 'QuestionFilled',
  'el-icon-search': 'Search',
  'el-icon-edit': 'Edit',
  'el-icon-delete': 'Delete',
  'el-icon-add': 'Plus',
  'el-icon-close': 'Close',
  'el-icon-arrow-up': 'ArrowUp',
  'el-icon-arrow-down': 'ArrowDown',
  'el-icon-arrow-left': 'ArrowLeft',
  'el-icon-arrow-right': 'ArrowRight',
  'el-icon-view': 'View',
  'el-icon-refresh': 'Refresh',
  'el-icon-share': 'Share',
  'el-icon-upload': 'Upload',
  'el-icon-download': 'Download',
  'el-icon-star-on': 'Star',
  'el-icon-star-off': 'StarFilled',
  'el-icon-good': 'Select',
  'el-icon-bad': 'CloseBold',
  'el-icon-loading': 'Loading',
  'el-icon-check': 'Check',
  'el-icon-tickets': 'Tickets',
  'el-icon-sold-out': 'SoldOut',
  'el-icon-sort': 'Sort',
  'el-icon-sort-up': 'SortUp',
  'el-icon-sort-down': 'SortDown',
  'el-icon-d-caret': 'ArrowDown',
  'el-icon-date': 'Calendar',
  'el-icon-message': 'Message',
  'el-icon-menu': 'Menu',
  'el-icon-more': 'MoreFilled',
  'el-icon-picture': 'Picture',
  'el-icon-phone': 'Phone',
  'el-icon-user': 'User',
  'el-icon-location': 'Location',
  'el-icon-printer': 'Printer',
  'el-icon-setting': 'Setting',
  'el-icon-time': 'Clock',
  'el-icon-bell': 'Bell',
  'el-icon-document': 'Document',
  'el-icon-folder': 'Folder',
  'el-icon-home': 'HomeFilled',
}

function getIconComponentName(elIconClass: string): string {
  // 先查表
  if (ELEMENT_ICON_MAP[elIconClass]) return ELEMENT_ICON_MAP[elIconClass]
  // fallback: 去掉前缀，转 PascalCase
  const name = elIconClass.replace(/^el-icon-/, '')
  return name
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('')
}

export function transformIcons(template: string): IconTransformResult {
  const all = scanAllElements(template)
  const reviewItems: string[] = []
  const changes: string[] = []
  const edits: TextEdit[] = []
  const iconNames: string[] = []  // iter-036

  // 1. 处理 <i class="el-icon-xxx"> 形式
  // Dedup: only add one review per icon class per file
  const seenIconClasses = new Set<string>()

  for (const el of all) {
    if (el.tagName !== 'i') continue
    // 找 class 属性
    const classAttr = findAttr(el, 'class')
    if (!classAttr || typeof classAttr.value !== 'string') continue
    const classes = classAttr.value.split(/\s+/).filter(Boolean)
    const elIconClass = classes.find((c) => c.startsWith('el-icon-'))
    if (!elIconClass) continue

    const componentName = getIconComponentName(elIconClass)
    iconNames.push(componentName)
    const otherClasses = classes.filter((c) => c !== elIconClass)
    // 提取除 class 外的 attributes 文本（保留 v-if / v-else / @click 等）
    const attrTexts: string[] = []
    for (const a of el.attrs) {
      if (a.name === 'class') continue
      if (a.start === a.end) {
        attrTexts.push(a.name)
      } else {
        attrTexts.push(a.raw || `${a.name}="${a.value}"`)
      }
    }
    // 把其他 class 合并到 el-icon 的 class 上
    if (otherClasses.length > 0) {
      const existingClassIdx = attrTexts.findIndex((s) => s.startsWith('class='))
      const newClassStr = `class="${otherClasses.join(' ')}"`
      if (existingClassIdx >= 0) {
        attrTexts[existingClassIdx] = newClassStr
      } else {
        attrTexts.unshift(newClassStr)
      }
    }
    const otherAttrStr = attrTexts.length > 0 ? ' ' + attrTexts.join(' ') : ''
    // 整个 <i ...></i> 替换为 <el-icon ...otherAttrs><Xxx /></el-icon>
    // 收集到 edits，统一由 applyEdits 右到左处理（避免前一次 splice 导致 offset 失效）
    const newTag = `<el-icon${otherAttrStr}><${componentName} /></el-icon>`
    edits.push({ start: el.start, end: el.end, replacement: newTag })
    changes.push(`<i class="${elIconClass}"> → <el-icon><${componentName} /></el-icon>`)
    if (otherClasses.length > 0 && !seenIconClasses.has(elIconClass)) {
      seenIconClasses.add(elIconClass)
      reviewItems.push(
        `<i class="${elIconClass} ..."> 已自动转 <el-icon ...><${componentName} /></el-icon>，其他 class 已合并到 el-icon 上。请检查样式。`,
      )
    }
  }

  // 2. 处理 <el-button icon="el-icon-xxx"> 形式
  // 每个 (el, attr) 是一个独立 splice：右到左处理时按 attr offset 排
  for (const el of all) {
    if (!el.tagName.startsWith('el-')) continue
    const iconAttr = findAttr(el, 'icon')
    if (!iconAttr || typeof iconAttr.value !== 'string') continue
    const iconName = iconAttr.value
    if (!iconName.startsWith('el-icon-')) continue

    const componentName = getIconComponentName(iconName)
    iconNames.push(componentName)
    // 用与 editor 相同的算法：算出 removeStart / logicalEnd，把 splice 编码为 TextEdit
    const edit = computeRemoveAttrEdit(template, el, iconAttr)
    if (edit) edits.push(edit)
    changes.push(`${el.tagName} icon="${iconName}" → removed (use el-icon 包裹的子组件)`)
    reviewItems.push(
      `<${el.tagName} icon="${iconName}"> → 在 children 里加 <el-icon><${componentName} /></el-icon>。Vue3 需手动调整按钮结构。`,
    )
  }

  if (edits.length === 0) {
    return { out: template, changed: false, changes, reviewItems, iconNames }
  }

  return { out: applyEdits(template, edits), changed: true, changes, reviewItems, iconNames }
}

/**
 * 复刻 central editor 中 replaceAttribute 的算法，但返回 TextEdit（而不是
 * 重新 splice 整个 source），这样多个 edit 可以统一在 applyEdits 里右到左处理。
 */
function computeRemoveAttrEdit(
  source: string,
  el: any,
  attr: ParsedAttr,
): TextEdit | null {
  const absStart = el.tagNameEnd + attr.start
  const absEnd = el.tagNameEnd + attr.end
  const tail = el.selfClosing ? ' />' : '>'

  const hasLeft = el.attrs.some((a: ParsedAttr) => a !== attr && a.start < attr.start)
  const hasRight = el.attrs.some((a: ParsedAttr, i: number) => {
    if (a !== attr) return i > el.attrs.indexOf(attr)
    return false
  })
  // 上面的 hasRight 实现有 bug。重新写。
  // 找到 attr 在 attrs 里的 index
  const idx = el.attrs.indexOf(attr)
  const hasRightFixed = idx >= 0 && idx < el.attrs.length - 1

  const isBooleanAttr =
    absEnd > absStart &&
    (source[absEnd - 1] === ' ' || source[absEnd - 1] === '\t')

  let removeStart = absStart
  if (
    !isBooleanAttr &&
    removeStart > el.tagNameEnd &&
    (source[removeStart - 1] === ' ' || source[removeStart - 1] === '\t')
  ) {
    removeStart--
  }

  if (hasRightFixed) {
    return { start: removeStart, end: absEnd, replacement: '' }
  }
  if (hasLeft && isBooleanAttr) {
    const start = removeStart > el.tagNameEnd ? removeStart - 1 : removeStart
    return { start, end: el.openEnd + 1, replacement: tail }
  }
  if (hasLeft) {
    return { start: removeStart, end: el.openEnd + 1, replacement: tail }
  }
  return { start: el.tagNameEnd, end: el.openEnd + 1, replacement: tail }
}

export function applyIconTransform(ctx: any, markMessage: string): void {
  if (!ctx.file.kind || ctx.file.kind !== 'vue') return
  let template: string | null = ctx.file.sfc?.template?.content ?? null
  if (template === null) return

  const result = transformIcons(template)
  // 跨 file 去重：同一 icon name 的 review 整个 project 只发 1 次
  // (vue-migrate 转换对每个 file 是独立的；同一 icon 在多个 file 用属正常)
  const projectSent = ((ctx.project as any).__iconReviewSent ||= new Set<string>()) as Set<string>
  const filtered = result.reviewItems.filter((r) => {
    // 提取 icon name: 同时支持 class="el-icon-xxx" 和 icon="el-icon-xxx" 两种模式
    const m = r.match(/(?:class|icon)="(el-icon-[\w-]+)/)
    if (!m) return true  // 非 icon review 不过滤
    if (projectSent.has(m[1])) return false
    projectSent.add(m[1])
    return true
  })
  for (const r of filtered) ctx.utils.manualReview(r)
  if (!result.changed) return

  const replaced = replaceTemplateContent(ctx.file, result.out, markMessage)
  if (replaced.changed) {
    ctx.utils.markChanged(markMessage)
    // iter-036: 自动加 `import { Icon1, Icon2, ... } from '@element-plus/icons-vue'`
    //   之前转换出 <CaretTop /> 但用户必须手动加 import, 这步自动化省心
    if (result.iconNames.length > 0) {
      addElementPlusIconsImport(ctx.file, result.iconNames)
    }
  }
}

/**
 * iter-036: 在 .vue 的 <script> 块里加 `import { I1, I2, ... } from '@element-plus/icons-vue'`
 *   - 如果已存在 named import 从 '@element-plus/icons-vue', 合并 names
 *   - 否则插入新 import 在第一个 import 后
 *
 * 注意: 直接修改 file.scriptAst 是不够的,composition plugin (priority 0, 最后跑)
 *   会设 file.useRawSource=true 然后 codegen 直接输出 file.source,忽略 scriptAst。
 *   所以这里要**直接改 file.source 字符串**。
 */
function addElementPlusIconsImport(file: any, newNames: string[]): void {
  const ICONS_PKG = '@element-plus/icons-vue'
  const unique = Array.from(new Set(newNames))
  const source: string = file.source
  if (!source) return

  const importLine = `import { ${unique.join(', ')} } from '${ICONS_PKG}';`

  // 已存在: 合并到现有 named import
  const existingRegex = /import\s*\{\s*([^}]*?)\s*\}\s*from\s*['"]@element-plus\/icons-vue['"]\s*;?/
  const m = source.match(existingRegex)
  if (m) {
    const have = new Set<string>(
      m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    const addList = unique.filter((n) => !have.has(n))
    if (addList.length === 0) return  // 都有了
    const newSpec = [...m[1].split(',').map((s) => s.trim()).filter(Boolean), ...addList].join(', ')
    const newImport = `import { ${newSpec} } from '${ICONS_PKG}';`
    file.source = source.replace(existingRegex, newImport)
    return
  }
  // 不存在: 插入到第一个 import 之后
  // 找 <script ...> 后第一个 import 声明的位置
  const scriptOpenMatch = source.match(/<script[^>]*>/)
  if (!scriptOpenMatch) {
    // 没 script 块, 在文件最前面加
    file.source = importLine + '\n' + source
    return
  }
  // 找 script 块后第一个 'import ' 行的开头
  const afterScript = source.indexOf(scriptOpenMatch[0]) + scriptOpenMatch[0].length
  // 跳过 \n 找到下一行
  let insertPos = afterScript
  while (insertPos < source.length && source[insertPos] !== 'i') {
    // 简单: 找 'import ' 关键字
    if (source.startsWith('import ', insertPos)) break
    insertPos++
  }
  if (insertPos >= source.length) {
    // 没 import 关键字, 整个 script 块开头
    insertPos = afterScript
    // 跳过 \n
    while (insertPos < source.length && (source[insertPos] === '\n' || source[insertPos] === '\r')) {
      insertPos++
    }
  }
  file.source = source.slice(0, insertPos) + importLine + '\n' + source.slice(insertPos)
}
