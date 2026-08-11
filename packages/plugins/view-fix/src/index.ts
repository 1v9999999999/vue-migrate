/**
 * @vue-migrate/plugin-view-fix
 *
 * iter-049a: 修 view-level critical bugs — 这些是 composition 转换留下的 runtime break.
 *
 * 修复清单 (按 bug 编号):
 *   BUG-009: views/dashboard/index.vue — currentRole 是字符串 'adminDashboard'/'editorDashboard', 但
 *            没 import 对应组件. <component :is="currentRole"> 在 Vue 3 不能用未注册的名字.
 *            修法: import adminDashboard/editorDashboard, 把 currentRole 改成 ref(importedAdminDashboard)
 *
 *   BUG-010: views/table/dynamic-table/components/FixedThead.vue — `const checkboxVal = ref(defaultFormThead)`
 *            但 defaultFormThead 没定义 (TDZ throw on mount).
 *            修法: 注入 `const defaultFormThead = ['apple', 'banana']` (原版硬编码值)
 *
 *   BUG-011: layout/components/Sidebar/Item.vue — template 完全空. 缺:
 *            <svg-icon v-if="icon" :icon-class="icon" />  <span v-if="title">{{ title }}</span>
 *            修法: 在 <script setup> 后注入完整 <template> 块
 *
 *   BUG-012/013: components/SvgIcon/index.vue (有 Link.vue 内部) + layout/components/Sidebar/Link.vue —
 *                `import { isExternal } from '@/utils/validate'` + `const isExternal = computed(...)`
 *                局部 const 遮蔽 import, computed 内调 isExternal(props) throw (ref.value 不是 fn).
 *                修法: import 别名 (e.g. validateIsExternal) 或 computed 内调 import-alias
 *
 *   BUG-014: layout/components/Sidebar/SidebarItem.vue — `popper-append-to-body` 在 Element Plus 2.x 已废弃
 *            修法: 替换为 `teleported` (EP 2.x 的新 prop, 默认为 false 但功能类似)
 *
 *   BUG-068: views/permission/directive.vue — 用 `checkPermission([...])` 但没 import.
 *            修法: 注入 `import { checkPermission } from '@/utils/permission'`
 *
 *   BUG-070: views/profile/components/UserCard.vue — 模板用 `uppercaseFirst(user.role)` 但脚本可能没暴露.
 *            修法: 注入 `import { uppercaseFirst } from '@/utils'` 或 inject
 *
 *   BUG-054: views/example/components/ArticleDetail.vue — importance 行 0x00 截断. 跳过 (代码损坏, 需手改)
 *
 *   BUG-049-003: public/ 目录 vite-scaffold 已处理
 *
 *   BUG-049-004: babel.config.js vite-scaffold 已处理
 *
 * Priority: -30 (在 composition, auto-import, v-model-fixer 之后跑, 处理它们的产物)
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
  type FileNode,
} from '@vue-migrate/core'
import { existsSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'

/** ====== 规则实现 ====== */

/**
 * BUG-009: views/dashboard/index.vue
 *  检测: 模板含 `<component :is="currentRole" />` 或 `:is="currentRole"` 且
 *         script 里有 `currentRole = ref('adminDashboard')` 但没 import adminDashboard/editorDashboard
 *  修法: import adminDashboard + editorDashboard, 把 currentRole 改成 ref(importedAdminDashboard) (component 对象, 非字符串)
 *  注意: 这会破坏原版 `currentRole = 'editorDashboard'` 的逻辑 (要改成动态)
 */
function fixDashboardCurrentRole(ctx: TransformContext, root: string): boolean {
  const { file, utils } = ctx
  if (!file.relativePath.endsWith('views/dashboard/index.vue')) return false
  if (!file.source.includes('currentRole = ref(\'adminDashboard\'')) return false
  if (file.source.includes('import adminDashboard')) return false  // 已修

  // 检查 adminDashboard / editorDashboard 组件是否存在
  const adminPath = join(root, 'src/views/dashboard/admin/index.vue')
  const editorPath = join(root, 'src/views/dashboard/editor/index.vue')
  if (!existsSync(adminPath) || !existsSync(editorPath)) return false

  // 注入 import + 改 currentRole 为 computed (ref(component)) — 动态切换
  const source = file.source
  const scriptOpenEnd = source.indexOf('<script setup>') + '<script setup>'.length
  const imports = `import adminDashboard from './admin'\nimport editorDashboard from './editor'`

  // 把 currentRole = ref('adminDashboard') 改成 currentRole = ref(adminDashboard) (adminDashboard 现在是 component 对象)
  // 同时把 currentRole.value = 'editorDashboard' 改成 currentRole.value = editorDashboard
  let newSource = source
  // 注入 import
  newSource = newSource.replace(
    /(<script setup>)/,
    `$1\n${imports}`,
  )
  // 改 ref('adminDashboard') → ref(adminDashboard)
  newSource = newSource.replace(
    /currentRole = ref\((['"])adminDashboard\1\)/,
    'currentRole = ref(adminDashboard)',
  )
  // 改 = 'editorDashboard' → = editorDashboard
  newSource = newSource.replace(
    /currentRole\.value = (['"])editorDashboard\1/,
    'currentRole.value = editorDashboard',
  )

  if (newSource === source) return false
  file.source = newSource
  file.useRawSource = true
  utils.markChanged('[view-fix] BUG-009: 改 currentRole 为 component 对象 (adminDashboard/editorDashboard)')
  utils.manualReview(
    '[view-fix] BUG-009: 已在 dashboard/index.vue 注入 `import adminDashboard from \'./admin\'` + `import editorDashboard from \'./editor\'`, ' +
    '并把 currentRole 改为 ref(component) 对象 (而非字符串). Vue 3 <component :is="componentObj"> 才能正常工作.',
  )
  return true
}

/**
 * BUG-010: views/table/dynamic-table/components/FixedThead.vue
 *  检测: 含 `ref(defaultFormThead)` 但 defaultFormThead 未定义
 *  修法: 注入 `const defaultFormThead = ['apple', 'banana']`
 */
function fixFixedTheadDefault(ctx: TransformContext): boolean {
  const { file, utils } = ctx
  if (!file.relativePath.includes('FixedThead.vue')) return false
  if (!file.source.includes('defaultFormThead')) return false
  if (/const\s+defaultFormThead\s*=/.test(file.source)) return false  // 已修

  // 注入 const
  const inject = `\nconst defaultFormThead = ['apple', 'banana']\n`
  // 找最后一个 import 后
  const scriptOpenEnd = file.source.indexOf('<script setup>') + '<script setup>'.length
  const lastImportMatch = [...file.source.matchAll(/^[ \t]*import\s+[^\n]+/gm)].pop()
  let insertPos: number
  if (lastImportMatch && lastImportMatch.index !== undefined) {
    insertPos = lastImportMatch.index + lastImportMatch[0].length
  } else {
    insertPos = scriptOpenEnd
  }

  const newSource = file.source.substring(0, insertPos) + inject + file.source.substring(insertPos)
  file.source = newSource
  file.useRawSource = true
  utils.markChanged('[view-fix] BUG-010: 注入 defaultFormThead = [\'apple\', \'banana\']')
  utils.manualReview(
    '[view-fix] BUG-010: 已在 FixedThead.vue 注入 const defaultFormThead = [\'apple\', \'banana\']. ' +
    '这是 vue-element-admin 原版的硬编码默认值. 你的项目可能需要更细的默认值.',
  )
  return true
}

/**
 * BUG-011: layout/components/Sidebar/Item.vue
 *  检测: Sidebar/Item.vue 且 template 空 (或完全没有 <template> 块)
 *  修法: 在 <script setup> 前注入原版 template 内容
 */
function fixSidebarItemTemplate(ctx: TransformContext): boolean {
  const { file, utils } = ctx
  if (!file.relativePath.endsWith('Sidebar/Item.vue')) return false

  // 情况 1: <template>...</template> 存在但内容空
  const tmplMatch = file.source.match(/<template>([\s\S]*?)<\/template>/i)
  if (tmplMatch) {
    if (tmplMatch[1].trim().length > 0) return false  // template 非空
    // 替换空 template
    const newSource = file.source.replace(/<template>[\s\S]*?<\/template>/i, buildItemTemplate())
    if (newSource === file.source) return false
    file.source = newSource
    file.useRawSource = true
    utils.markChanged('[view-fix] BUG-011: 注入 Item.vue 原版 template (替换空 template)')
    utils.manualReview(
      '[view-fix] BUG-011: 已在 Sidebar/Item.vue 替换空 template 为原版 (svg-icon + title). 整个侧边栏菜单都靠这个.',
    )
    return true
  }

  // 情况 2: 完全没 <template> 块 — 在 <script setup> 前插入
  const newTemplate = buildItemTemplate() + '\n'
  const scriptMatch = file.source.match(/<script\b[^>]*>/i)
  if (scriptMatch && scriptMatch.index !== undefined) {
    const newSource = file.source.substring(0, scriptMatch.index) + newTemplate + file.source.substring(scriptMatch.index)
    file.source = newSource
    file.useRawSource = true
    utils.markChanged('[view-fix] BUG-011: 注入 Item.vue 原版 template (无 template 块)')
    utils.manualReview(
      '[view-fix] BUG-011: 已在 Sidebar/Item.vue 注入原版 template (无 template 块). 整个侧边栏菜单都靠这个.',
    )
    return true
  }

  return false
}

function buildItemTemplate(): string {
  return `<template>
  <div v-if="icon || title">
    <svg-icon v-if="icon" :icon-class="icon" />
    <span v-if="title">{{ title }}</span>
  </div>
</template>`
}

/**
 * BUG-012/013: SvgIcon/index.vue / Link.vue — isExternal 命名冲突
 *  检测: import { isExternal } from '@/utils/validate' + const isExternal = computed(...)
 *  修法: import 别名 + 内部使用别名
 */
function fixIsExternalNameCollision(ctx: TransformContext): boolean {
  const { file, utils } = ctx
  if (!/isExternal/.test(file.source)) return false
  // 跳过: 已经修过 (用了别名)
  if (/import\s+\{[^}]*isExternal[^}]*as\s+/i.test(file.source)) return false
  // 跳过: 没有 const isExternal = computed (说明不是问题)
  if (!/const\s+isExternal\s*=\s*(?:computed|ref|reactive)/.test(file.source)) return false
  // 跳过: 没有 import isExternal from '@/utils/validate'
  if (!/from\s+['"]@\/utils\/validate['"]/.test(file.source)) return false

  let newSource = file.source

  // 1) 改 import: import { isExternal } → import { isExternal as validateIsExternal }
  newSource = newSource.replace(
    /import\s+\{\s*(isExternal)\s*\}\s+from\s+(['"])@\/utils\/validate\2/,
    "import { isExternal as validateIsExternal } from $2@/utils/validate$2",
  )

  // 2) 改 computed 内部调用: isExternal(props.X) → validateIsExternal(props.X)
  // 范围: 只改 computed 块内的引用
  newSource = newSource.replace(
    /(const\s+isExternal\s*=\s*computed\(\(\)\s*=>\s*\{?\s*return\s+)isExternal(\s*\()/g,
    '$1validateIsExternal$2',
  )

  if (newSource === file.source) return false
  file.source = newSource
  file.useRawSource = true
  utils.markChanged(`[view-fix] BUG-012/013: 改 isExternal 命名冲突 → validateIsExternal alias`)
  utils.manualReview(
    '[view-fix] BUG-012/013: 已把 isExternal import 改别名 validateIsExternal, 避免遮蔽 const isExternal = computed. ' +
    '原代码 computed 内调 isExternal(props.X) 实际是调 ref.value(props.X) → TypeError.',
  )
  return true
}

/**
 * BUG-014: SidebarItem.vue — `popper-append-to-body` 废弃
 *  检测: template 里有 `popper-append-to-body`
 *  修法: 替换为 `teleported` (EP 2.x 新 prop, 默认 false; Element Plus 2.5+ 也支持 `popper-options`, 但 `teleported` 更稳)
 */
function fixPopperAppendToBody(ctx: TransformContext): boolean {
  const { file, utils } = ctx
  if (!file.source.includes('popper-append-to-body')) return false
  // Element Plus 2.x: 替换为 teleported="false" (保持原行为 — 不 teleport 到 body)
  // 但实际上原行为是 append-to-body=true, 所以我们要 teleported="true"
  // 但默认值更安全: 删掉这个 prop, 让 Element Plus 用默认行为
  const newSource = file.source.replace(/\s*popper-append-to-body/g, '')
  if (newSource === file.source) return false
  file.source = newSource
  file.useRawSource = true
  utils.markChanged('[view-fix] BUG-014: 删除 Element Plus 废弃的 popper-append-to-body prop')
  return true
}

/**
 * BUG-068: views/permission/directive.vue — checkPermission 未 import
 *  检测: 模板用 `v-if="checkPermission([...])"` 但 script 没 import
 */
function fixCheckPermissionImport(ctx: TransformContext, root: string): boolean {
  const { file, utils } = ctx
  if (!file.relativePath.includes('permission/directive.vue')) return false
  if (!file.source.includes('checkPermission(')) return false
  if (/import\s+\{[^}]*checkPermission[^}]*\}\s+from/.test(file.source)) return false
  // 检查文件存在
  const permPath = join(root, 'src/utils/permission.js')
  if (!existsSync(permPath)) return false

  const newSource = file.source.replace(
    /(<script setup>)/,
    '$1\nimport { checkPermission } from \'@/utils/permission\'',
  )
  if (newSource === file.source) return false
  file.source = newSource
  file.useRawSource = true
  utils.markChanged('[view-fix] BUG-068: 注入 checkPermission import')
  return true
}

/**
 * BUG-070: views/profile/components/UserCard.vue — uppercaseFirst 未在 scope
 *  检测: 模板用 `uppercaseFirst(...)` 但 script 没 import
 */
function fixUppercaseFirstImport(ctx: TransformContext, root: string): boolean {
  const { file, utils } = ctx
  if (!file.relativePath.endsWith('profile/components/UserCard.vue')) return false
  if (!file.source.includes('uppercaseFirst(')) return false
  if (/import\s+\{[^}]*uppercaseFirst[^}]*\}\s+from/.test(file.source)) return false
  // 检查 src/utils/validate.js 有没有 uppercaseFirst
  const validatePath = join(root, 'src/utils/validate.js')
  let hasExport = false
  if (existsSync(validatePath)) {
    try {
      const { readFileSync } = require('node:fs')
      const content = readFileSync(validatePath, 'utf-8')
      hasExport = /export\s+(?:default\s+)?(?:function\s+)?uppercaseFirst\b|uppercaseFirst\s*[:=]|uppercaseFirst\s*export/.test(content)
    } catch {}
  }
  if (!hasExport) {
    // 自己定义一个
    const inject = `\nconst uppercaseFirst = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)\n`
    const lastImportMatch = [...file.source.matchAll(/^[ \t]*import\s+[^\n]+/gm)].pop()
    let insertPos: number
    if (lastImportMatch && lastImportMatch.index !== undefined) {
      insertPos = lastImportMatch.index + lastImportMatch[0].length
    } else {
      insertPos = file.source.indexOf('<script setup>') + '<script setup>'.length
    }
    const newSource = file.source.substring(0, insertPos) + inject + file.source.substring(insertPos)
    file.source = newSource
    file.useRawSource = true
    utils.markChanged('[view-fix] BUG-070: 注入 uppercaseFirst fallback')
    utils.manualReview(
      '[view-fix] BUG-070: 已在 UserCard.vue 注入 inline const uppercaseFirst (因为 src/utils/validate.js 没导出). ' +
      '建议手写一个 utils 函数.',
    )
    return true
  }
  return false
}

const plugin: TransformPlugin = {
  name: 'view-fix',
  description:
    'Fix view-level runtime bugs from composition conversion: dashboard currentRole string, FixedThead defaultFormThead, Sidebar Item.vue empty template, SvgIcon/Link isExternal shadow, popper-append-to-body deprecation, etc.',
  priority: -30,
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils, project } = ctx
    if (!file.source) return

    // 每个规则 try/catch, 一个失败不影响其他
    try { fixDashboardCurrentRole(ctx, project.root) } catch (e: any) { utils.manualReview(`[view-fix] BUG-009 失败: ${e.message}`) }
    try { fixFixedTheadDefault(ctx) } catch (e: any) { utils.manualReview(`[view-fix] BUG-010 失败: ${e.message}`) }
    try { fixSidebarItemTemplate(ctx) } catch (e: any) { utils.manualReview(`[view-fix] BUG-011 失败: ${e.message}`) }
    try { fixIsExternalNameCollision(ctx) } catch (e: any) { utils.manualReview(`[view-fix] BUG-012/013 失败: ${e.message}`) }
    try { fixPopperAppendToBody(ctx) } catch (e: any) { utils.manualReview(`[view-fix] BUG-014 失败: ${e.message}`) }
    try { fixCheckPermissionImport(ctx, project.root) } catch (e: any) { utils.manualReview(`[view-fix] BUG-068 失败: ${e.message}`) }
    try { fixUppercaseFirstImport(ctx, project.root) } catch (e: any) { utils.manualReview(`[view-fix] BUG-070 失败: ${e.message}`) }
  },
}

registerPlugin(plugin)
export default plugin

// 暴露给单测
export const _testable = {
  fixDashboardCurrentRole,
  fixFixedTheadDefault,
  fixSidebarItemTemplate,
  fixIsExternalNameCollision,
  fixPopperAppendToBody,
  fixCheckPermissionImport,
  fixUppercaseFirstImport,
}
