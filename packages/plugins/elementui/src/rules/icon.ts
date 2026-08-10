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
import { replaceTemplateContent } from '../utils/sfc-source.js'

export interface IconTransformResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
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
  let out = template

  // 1. 处理 <i class="el-icon-xxx"> 形式
  type Edit = { start: number; end: number; replacement: string; desc: string }
  const edits: Edit[] = []

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
    const newTag = `<el-icon${otherAttrStr}><${componentName} /></el-icon>`
    edits.push({
      start: el.start,
      end: el.end,
      replacement: newTag,
      desc: `<i class="${elIconClass}"> → <el-icon><${componentName} /></el-icon>`,
    })
    if (otherClasses.length > 0 && !seenIconClasses.has(elIconClass)) {
      seenIconClasses.add(elIconClass)
      reviewItems.push(
        `<i class="${elIconClass} ..."> 已自动转 <el-icon ...><${componentName} /></el-icon>，其他 class 已合并到 el-icon 上。请检查样式。`,
      )
    }
  }

  // 2. 处理 <el-button icon="el-icon-xxx"> 形式
  for (const el of all) {
    if (!el.tagName.startsWith('el-')) continue
    const iconAttr = findAttr(el, 'icon')
    if (!iconAttr || typeof iconAttr.value !== 'string') continue
    const iconName = iconAttr.value
    if (!iconName.startsWith('el-icon-')) continue

    const componentName = getIconComponentName(iconName)
    // 移除 icon 属性
    const attrTextStartInTpl = el.tagNameEnd
    const absStart = attrTextStartInTpl + iconAttr.start
    const absEnd = attrTextStartInTpl + iconAttr.end
    edits.push({
      start: absStart,
      end: absEnd,
      replacement: '',  // 移除 icon 属性
      desc: `${el.tagName} icon="${iconName}" → removed (use el-icon 包裹的子组件)`,
    })
    reviewItems.push(
      `<${el.tagName} icon="${iconName}"> → 在 children 里加 <el-icon><${componentName} /></el-icon>。Vue3 需手动调整按钮结构。`,
    )
  }

  if (edits.length === 0) {
    return { out: template, changed: false, changes, reviewItems }
  }

  // 按 start 降序替换
  edits.sort((a, b) => b.start - a.start)
  for (const edit of edits) {
    if (edit.replacement === '') {
      // 移除属性，同时移除可能的 leading 空格
      let removeStart = edit.start
      if (out[removeStart - 1] === ' ' || out[removeStart - 1] === '\t') {
        removeStart--
      }
      out = out.slice(0, removeStart) + out.slice(edit.end)
    } else {
      out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end)
    }
    changes.push(edit.desc)
  }

  return { out, changed: true, changes, reviewItems }
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
  }
}
