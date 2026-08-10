/**
 * 规则 E.5, E.6, E.13, E.16, E.17, E.25, E.27, E.31: template 端转换
 *
 *   E.5 / E.13: size="medium" / "mini" → "default" / "small"
 *   E.6: class="el-icon-xxx" → 新的 icon class 名（class 形式）
 *   E.16: <el-dialog :visible.sync="x"> → <el-dialog v-model="x">
 *   E.17: <el-drawer :visible.sync="x"> → <el-drawer v-model="x">
 *   E.25: <el-submenu> → <el-sub-menu>
 *   E.27: <el-button icon="el-icon-xxx"> → 标 review（需要改用 icon 组件）
 *   E.31: <el-pagination :current-page.sync="x"> → :current-page="x" + watch
 *
 * 复用 vue3-template 的 replaceTemplateContent 工具（通过 sfc.template.loc），
 * 写法一致。
 */

import {
  scanAllElements,
  findAttr,
  findDirective,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { replaceTemplateContent } from '../utils/sfc-source.js'

export interface ElementUITemplateResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

const SIZE_REMAP: Record<string, string> = {
  medium: 'default',
  mini: 'small',
}

/** ElementUI 子组件重命名映射（kebab-case → kebab-case） */
const COMPONENT_RENAME: Record<string, string> = {
  'el-submenu': 'el-sub-menu',
  'el-menu-item-group': 'el-menu-item-group', // 不变
}

/** 哪些组件支持 :visible.sync → v-model 替换 */
const VISIBLE_SYNC_COMPONENTS = new Set([
  'el-dialog',
  'el-drawer',
  'el-popover',
  'el-tooltip',
  'el-select',
  'el-dropdown',
])

/** 处理整个 template 字符串，返回新版本 */
export function transformElementUITemplate(template: string): ElementUITemplateResult {
  const all = scanAllElements(template)
  const reviewItems: string[] = []
  const changes: string[] = []
  let out = template

  // 收集所有需要修改的位置（按 offset 降序）
  type Edit = { start: number; end: number; replacement: string; desc: string }
  const edits: Edit[] = []

  for (const el of all) {
    const tag = el.tagName.toLowerCase()

    // 1. 组件重命名（el-submenu → el-sub-menu）
    //    要替换整个开标签（含 <）和闭标签（含 </）
    if (COMPONENT_RENAME[tag] && COMPONENT_RENAME[tag] !== tag) {
      // 开标签：<el-submenu ...> → <el-sub-menu ...>
      // el.openStart 是 '<' 位置，el.openEnd 是 '>' 位置（exclusive）
      edits.push({
        start: el.openStart,
        end: el.openStart + 1 + el.tagName.length,  // < + tagName 长度
        replacement: '<' + COMPONENT_RENAME[tag],
        desc: `<${el.tagName} → <${COMPONENT_RENAME[tag]}`,
      })
      // 闭标签：</el-submenu> → </el-sub-menu>
      if (el.closeStart >= 0) {
        edits.push({
          start: el.closeStart,
          end: el.closeStart + 2 + el.tagName.length,  // </ + tagName
          replacement: '</' + COMPONENT_RENAME[tag],
          desc: `</${el.tagName}> → </${COMPONENT_RENAME[tag]}>`,
        })
      }
    }

    // 2. :visible.sync → v-model（仅限支持的组件）
    if (VISIBLE_SYNC_COMPONENTS.has(tag)) {
      const visibleSync = findDirective(el, 'bind', 'sync')
      if (visibleSync) {
        // 检查是否是 visible prop
        const rawName = visibleSync.rawName
        if (rawName === ':visible.sync' || rawName === 'v-bind:visible.sync' || rawName === ':visible.sync') {
          const attrTextStartInTpl = el.tagNameEnd
          const absStart = attrTextStartInTpl + visibleSync.start
          const absEnd = attrTextStartInTpl + visibleSync.end
          const valueStr = typeof visibleSync.value === 'string' ? visibleSync.value : 'true'
          edits.push({
            start: absStart,
            end: absEnd,
            replacement: `v-model="${valueStr}"`,
            desc: `<${tag} :visible.sync="${valueStr}"> → <${tag} v-model="${valueStr}">`,
          })
        } else if (rawName === '.sync' || rawName.endsWith('.sync')) {
          // 其他 .sync（如 pagination 的 :current-page.sync）
          // 标 review，提示用户手动改
          reviewItems.push(
            `<${tag} ${rawName}="${visibleSync.value}">：Vue3 中 .sync 改用 v-model:propName，请手动调整`,
          )
        }
      }
    }

    // 2.5: el-pagination 的 :current-page.sync 特殊处理
    // 避免被 vue3-template 的 vbind-sync 错误处理（attr.start 算错）
    if (tag === 'el-pagination') {
      const allSync = el.attrs.filter(a => a.isDirective && a.modifiers.includes('sync'))
      for (const syncAttr of allSync) {
        // 提取 prop name（去掉 : 和 .sync）
        const propName = syncAttr.name
        if (propName === 'bind') {
          // :current-page.sync → rawName = :current-page.sync
          // 提取 current-page
          const m = syncAttr.rawName.match(/^[v:@]([^.]+)\.sync$/)
          if (m) {
            const prop = m[1]
            const valueStr = typeof syncAttr.value === 'string' ? syncAttr.value : 'true'
            const attrTextStartInTpl = el.tagNameEnd
            const absStart = attrTextStartInTpl + syncAttr.start
            const absEnd = attrTextStartInTpl + syncAttr.end
            edits.push({
              start: absStart,
              end: absEnd,
              replacement: `v-model:${prop}="${valueStr}"`,
              desc: `<el-pagination :${prop}.sync="${valueStr}"> → v-model:${prop}="${valueStr}"`,
            })
          }
        }
      }
    }

    // 3. size="medium" / size="mini" → "default" / "small"
    const sizeAttr = findAttr(el, 'size')
    if (sizeAttr && typeof sizeAttr.value === 'string') {
      const v = sizeAttr.value.replace(/['"]/g, '')
      if (SIZE_REMAP[v]) {
        const attrTextStartInTpl = el.tagNameEnd
        const absStart = attrTextStartInTpl + sizeAttr.start
        const absEnd = attrTextStartInTpl + sizeAttr.end
        edits.push({
          start: absStart,
          end: absEnd,
          replacement: `size="${SIZE_REMAP[v]}"`,
          desc: `<${tag} size="${v}"> → size="${SIZE_REMAP[v]}"`,
        })
      }
    }

    // 4. icon="el-icon-xxx" 已经在 icon.ts 里 review (有 cross-file dedup), 这里跳过
    //    避免重复 review
  }

  if (edits.length === 0) {
    return { out: template, changed: false, changes, reviewItems }
  }

  // 按 start 降序，从后往前替换
  edits.sort((a, b) => b.start - a.start)
  for (const edit of edits) {
    out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end)
    changes.push(edit.desc)
  }

  return { out, changed: true, changes, reviewItems }
}

/** 在 ctx 里跑整个 template 转换 pipeline */
export function applyTemplateTransform(ctx: any, markMessage: string): void {
  if (!ctx.file.kind || ctx.file.kind !== 'vue') return

  // 优先用 file.sfc.template.content；fallback 用正则
  let template: string | null = ctx.file.sfc?.template?.content ?? null
  if (template === null) return

  const result = transformElementUITemplate(template)
  if (!result.changed) {
    // 没有 changes 但可能有 reviewItems
    for (const r of result.reviewItems) ctx.utils.manualReview(r)
    return
  }

  for (const r of result.reviewItems) ctx.utils.manualReview(r)

  const replaced = replaceTemplateContent(ctx.file, result.out, markMessage)
  if (replaced.changed) {
    ctx.utils.markChanged(markMessage)
  }
}

function capitalize(s: string): string {
  return s.replace(/(^|-)(.)/g, (_, __, c) => c.toUpperCase())
}
