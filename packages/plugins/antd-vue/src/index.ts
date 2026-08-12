/**
 * @vue-migrate/plugin-antd-vue
 *
 * iter-121: ant-design-vue 1.x (Vue 2) → 2.x (Vue 3)
 *
 * 实现:
 *   - 自动改: <a-form-model> → <a-form>
 *   - 标 review:
 *       - v-decorator 指令
 *       - <a-modal @click="..."> (没 @ok/@cancel)
 *       - <a-tree-select :replaceFields="...">
 *       - this.$form.createForm(this)
 *       - form.validateFields((err, values) => ...) 回调
 *       - this.$confirm/$info/$success/$error/$warning/$modal
 *
 * 关键决策：
 *   - 只在检测到 ant-design-vue import 或 a-* 组件时才跑
 *   - 优先级 26 (与 elementui 25 相近, 但只动 a-* 不冲突)
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import { scanAllElementsLite } from './utils/template-scanner.js'
import { renameFormModel } from './rules/form-model.js'
import { reviewVDecorator } from './rules/v-decorator.js'
import { reviewModalEvents } from './rules/modal-events.js'
import { migrateAntdScript } from './rules/antd-script.js'
import { replaceTemplateContent } from './utils/sfc-source.js'

const plugin: TransformPlugin = {
  name: 'antd-vue',
  description:
    'iter-121: ant-design-vue 1.x (Vue 2) → 2.x (Vue 3) — auto-rename <a-form-model> to <a-form>; review v-decorator, <a-modal> @click, this.$form.createForm, form.validateFields callback, this.$confirm/$info/etc.',
  priority: 26,

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    // 快速过滤: 没有任何 antd 痕迹就不动
    const src = ctx.file.source
    const hasAntdHints = /ant-design-vue|a-form-model|a-modal|a-tree-select|a-form\b|v-decorator|this\.\$form|this\.\$confirm|this\.\$info/i.test(src)
    if (!hasAntdHints) return

    // ========== 1. Script AST: this.$form / validateFields / $confirm etc. ==========
    if (ctx.file.scriptAst) {
      const r = migrateAntdScript(ctx.file.scriptAst)
      for (const review of r.reviewItems) {
        ctx.utils.manualReview(review)
      }
      if (r.reviewItems.length > 0) {
        ctx.log?.(`[antd-vue] ${ctx.file.relativePath} — ${r.reviewItems.length} v1.x pattern(s) found`)
      }
    }

    // ========== 2. Template: rename + reviews ==========
    if (ctx.file.kind === 'vue') {
      let template: string | null = ctx.file.sfc?.template?.content ?? null
      if (template === null) return

      const elements = scanAllElementsLite(template)

      // 2.1 自动改: <a-form-model> → <a-form>
      const renameResult = renameFormModel(template, elements)
      if (renameResult.changed) {
        const replaced = replaceTemplateContent(ctx.file, renameResult.out, 'a-form-model → a-form')
        if (replaced.changed) {
          ctx.utils.markChanged('a-form-model → a-form')
          template = renameResult.out
        }
      }

      // 2.2 v-decorator review
      const vDecoratorReviews = reviewVDecorator(elements)
      for (const r of vDecoratorReviews) ctx.utils.manualReview(r)

      // 2.3 a-modal @click 拆分 review
      const modalReviews = reviewModalEvents(elements)
      for (const r of modalReviews) ctx.utils.manualReview(r)

      // 2.4 <a-tree-select :replaceFields="..."> review
      for (const el of elements) {
        if (el.tagName.toLowerCase() !== 'a-tree-select' && el.tagName.toLowerCase() !== 'a-cascader') continue
        for (const attr of el.attrs) {
          const r = attr.rawName.toLowerCase()
          if (r === ':replacefields' || r === 'v-bind:replacefields' || r === 'replacefields' ||
              r === ':replace-fields' || r === 'v-bind:replace-fields' || r === 'replace-fields') {
            ctx.utils.manualReview(
              `<${el.tagName} :replaceFields="..."> — ant-design-vue 2.x 改名为 :fieldNames`,
            )
          }
        }
      }
    }
  },
}

registerPlugin(plugin)
export default plugin
