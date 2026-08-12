/**
 * iter-121: vue-i18n v8 → v9 脚本端规则
 *
 * 检测 (script AST 端):
 *   1. this.$t('key', { x: 1 }) / this.$tc('key')   → review
 *   2. this.$i18n.locale = 'zh'                     → review (locale 是 ref)
 *   3. this.$i18n.t(...)                            → review
 *   4. Vue.use(VueI18n)                            → review (要改 app.use(i18n))
 *   5. import VueI18n from 'vue-i18n'              → review (default import 改成 named createI18n)
 *
 * 设计原则：
 *   - 只发 review，不自动改 (i18n 改动涉及多文件 + 用户业务选择太多)
 *   - 检查 import 是否有 useI18n, 已有则跳过 review (v9 已就绪)
 *   - 跟 composition plugin 协作：composition 之前会 this.$t → t() (如果加了 useI18n),
 *     所以 i18n-migrate 跑在 composition 之后, 看到 this.$t 即说明 composition 没改
 *     (通常是因为没 useI18n import, 需要用户手动迁移)
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

export interface I18nScriptResult {
  /** 是否找到 useI18n 引入 (v9 已就绪) */
  hasUseI18n: boolean
  /** 是否找到 vue-i18n import (任意形式) */
  hasVueI18nImport: boolean
  /** review 项列表 */
  reviewItems: string[]
  /** 改动数 */
  modifications: number
}

/**
 * 检查 file 的 ImportDeclaration, 找出 useI18n / vue-i18n 情况
 */
function inspectImports(ast: any): { hasUseI18n: boolean; hasVueI18nImport: boolean; hasVueI18nDefault: boolean } {
  let hasUseI18n = false
  let hasVueI18nImport = false
  let hasVueI18nDefault = false

  traverse(ast, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      if (node.source.value !== 'vue-i18n') return

      hasVueI18nImport = true
      for (const spec of node.specifiers) {
        if (t.isImportSpecifier(spec)) {
          const importedName = (spec.imported as any)?.name
          if (importedName === 'useI18n') hasUseI18n = true
          if (importedName === 'createI18n') hasUseI18n = true // 隐式: 用了 createI18n 算 v9 已迁移
        }
        if (t.isImportDefaultSpecifier(spec)) {
          hasVueI18nDefault = true
        }
      }
    },
  })

  return { hasUseI18n, hasVueI18nImport, hasVueI18nDefault }
}

export function migrateI18nScript(ctx: TransformContext): I18nScriptResult {
  if (!ctx.file.scriptAst) {
    return { hasUseI18n: false, hasVueI18nImport: false, reviewItems: [], modifications: 0 }
  }

  const { hasUseI18n, hasVueI18nImport, hasVueI18nDefault } = inspectImports(ctx.file.scriptAst)
  const reviewItems: string[] = []
  let modifications = 0

  // 已经 import 了 useI18n, 说明用户已经在 v9 路径上, 不会再有 this.$t
  // (composition 插件已经处理过)。但保险起见再扫一遍 this.$t, 因为有些文件
  // composition 没改 (例如 file-level skip lock) 但用户其实想用 v9 写。
  if (hasUseI18n) {
    return { hasUseI18n, hasVueI18nImport, reviewItems, modifications }
  }

  // 没 import useI18n 才需要检测 v8 模式
  traverse(ctx.file.scriptAst, {
    // 1. this.$t / this.$tc / this.$i18n.t / this.$i18n.tc / Vue.use(VueI18n) 统一在 CallExpression 处理
    CallExpression(path: any) {
      const node = path.node
      const callee = node.callee
      if (!t.isMemberExpression(callee)) return

      // 路径 A: this.$t / this.$tc
      if (
        t.isThisExpression(callee.object) &&
        t.isIdentifier(callee.property)
      ) {
        const name = callee.property.name
        if (name === '$t' || name === '$tc') {
          reviewItems.push(
            `this.${name}(...) — vue-i18n v9 需用 useI18n() 替代: const { t } = useI18n() (注意 v9 没有 $tc, plural 用 t('key', n))`,
          )
          modifications++
          return
        }
        if (name === 'use') {
          // Vue.use(...) — 检查参数
          // 但 callee.object 是 this, 不是 Vue, 不是我们要的
          return
        }
      }

      // 路径 B: this.$i18n.t / this.$i18n.tc
      if (
        t.isMemberExpression(callee.object) &&
        t.isThisExpression((callee.object as any).object) &&
        t.isIdentifier((callee.object as any).property) &&
        ((callee.object as any).property.name === '$i18n') &&
        t.isIdentifier(callee.property)
      ) {
        const name = (callee.property as any).name
        if (name === 't' || name === 'tc') {
          reviewItems.push(
            `this.$i18n.${name}(...) — vue-i18n v9 推荐用 useI18n().${name}(...) 替代 (this.$i18n 仍兼容, 但 setup 写法更 idiom)`,
          )
          modifications++
          return
        }
      }

      // 路径 C: Vue.use(VueI18n)
      if (
        t.isIdentifier(callee.object) &&
        (callee.object as any).name === 'Vue' &&
        t.isIdentifier(callee.property) &&
        (callee.property as any).name === 'use'
      ) {
        const arg = node.arguments[0]
        if (arg && t.isIdentifier(arg)) {
          const argName = (arg as any).name
          if (/^(Vue)?I18n$/i.test(argName)) {
            reviewItems.push(
              `Vue.use(${argName}) — vue-i18n v9 不再需要 Vue.use, 改用 app.use(i18n) (其中 i18n = createI18n({...}))`,
            )
            modifications++
            return
          }
        }
      }
    },

    // 2. this.$i18n.locale = 'zh'
    AssignmentExpression(path: any) {
      const node = path.node
      const left = node.left
      if (!t.isMemberExpression(left)) return
      // left.object 应该是 this.$i18n, left.property 是 locale
      const obj = left.object
      if (!t.isMemberExpression(obj)) return
      if (!t.isThisExpression(obj.object)) return
      if (!t.isIdentifier(obj.property)) return
      if (obj.property.name !== '$i18n') return
      if (!t.isIdentifier(left.property)) return
      if (left.property.name !== 'locale') return

      reviewItems.push(
        `this.$i18n.locale = '...' — vue-i18n v9 中 locale 是 ref: useI18n().locale.value = '...'`,
      )
      modifications++
    },

    // 3. import VueI18n from 'vue-i18n'  (default import 模式)
    ImportDeclaration(path: any) {
      const node = path.node
      if (!t.isStringLiteral(node.source)) return
      if (node.source.value !== 'vue-i18n') return
      // 检查是否有 default specifier
      const hasDefault = node.specifiers.some((s: any) => t.isImportDefaultSpecifier(s))
      if (hasDefault) {
        // 进一步: 没有 named import createI18n 才报
        const hasCreateI18n = node.specifiers.some(
          (s: any) => t.isImportSpecifier(s) && (s.imported as any)?.name === 'createI18n',
        )
        if (!hasCreateI18n) {
          reviewItems.push(
            `import VueI18n from 'vue-i18n' — vue-i18n v9 改成 named import: import { createI18n } from 'vue-i18n'; const i18n = createI18n({...})`,
          )
          modifications++
        }
      }
    },
  })

  // VueI18n default import 但用户没真用到 — 不强求
  // hasVueI18nDefault 仅用于日志, 不影响 review 决定

  return { hasUseI18n, hasVueI18nImport, reviewItems, modifications }
}
