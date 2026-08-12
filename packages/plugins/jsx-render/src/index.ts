/**
 * @vue-migrate/plugin-jsx-render
 *
 * iter-120: Add JSX/TSX support and h() signature migration
 *
 * 负责规则：
 *   - h() 签名迁移 (render(h) 函数):
 *       Vue 2: h('div', { attrs: {...}, on: {...}, domProps: {...} }, children)
 *       Vue 3: h('div', { ...mergedProps }, children)
 *   - <template functional> 移除 functional 属性
 *     (Vue 3 functional 仍支持, 但要通过 options.functional: true + 显式 import h)
 *
 * 关键点：
 *   - 处理 .tsx / .jsx 文件 (fileKinds: ['tsx', 'jsx', 'vue', 'ts', 'js'])
 *   - 对 .tsx: 仅处理 h() 签名, JSX 语法原样保留
 *     (babel generator 支持 JSX, 不需要特殊处理)
 *   - 对 .vue 中的 <script>: 跟 vue3-template 的 script 处理一致,
 *     检测 render(h) 函数中 h() 调用
 *   - 不修改 JSX AST (e.g. <div class="container" />), 因为 babel 内部
 *     JSX 已经转成 h() 调用形式 (但属性语法可能不同)
 *   - 优先级 = 8 (在 vue3-template=9 之后, composition=0 之前)
 *     这样 vue3-template 已处理完 template 和 $scopedSlots,
 *     jsx-render 处理 h() 签名, 后续 plugin 看结果
 */

import { registerPlugin, type TransformPlugin, type TransformContext } from '@vue-migrate/core'
import { migrateRenderFnH } from './rules/render-fn-h.js'
import { migrateFunctionalTemplate } from './rules/functional-template.js'
import { reviewTsxClassComponent } from './rules/tsx-class-wrap.js'

const plugin: TransformPlugin = {
  name: 'jsx-render',
  description:
    'iter-120: Migrate h() signature (attrs/domProps/on → flat form) in render(h) functions. Handle <template functional>. Add review for TSX class components with JSX. Supports .tsx, .jsx, .vue, .ts, .js files.',
  priority: 8, // run after vue3-template (9)
  fileKinds: ['tsx', 'jsx', 'vue', 'ts', 'js'],

  transform(ctx: TransformContext) {
    const { file, utils, log } = ctx
    const messages: string[] = []

    // ========== 1. h() 签名迁移 (render(h) 函数) ==========
    if (file.scriptAst) {
      try {
        const result = migrateRenderFnH(file.scriptAst)
        if (result.modifications > 0) {
          messages.push(...result.changes)
          for (const r of result.reviewItems) utils.manualReview(r)
          utils.markChanged('h() signature migrated to Vue 3 merged form')
        }
      } catch (e: any) {
        log(`migrateRenderFnH failed: ${e.message}`)
      }
    }

    // ========== 2. <template functional> 处理 ==========
    if (file.kind === 'vue') {
      try {
        const result = migrateFunctionalTemplate(file)
        if (result.modifications > 0) {
          messages.push(...result.changes)
          for (const r of result.reviewItems) utils.manualReview(r)
          utils.markChanged('<template functional> → <template>')
        }
      } catch (e: any) {
        log(`migrateFunctionalTemplate failed: ${e.message}`)
      }
    }

    // ========== 3. TSX class component (review only) ==========
    if (file.kind === 'tsx' || file.kind === 'jsx') {
      try {
        const result = reviewTsxClassComponent(file)
        if (result.modifications > 0) {
          for (const r of result.reviewItems) utils.manualReview(r)
          messages.push(...result.changes)
        }
      } catch (e: any) {
        log(`reviewTsxClassComponent failed: ${e.message}`)
      }
    }

    if (messages.length > 0) {
      log(messages.join('; '))
    }
  },
}

registerPlugin(plugin)
export default plugin
