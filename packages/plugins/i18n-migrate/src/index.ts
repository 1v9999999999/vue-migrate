/**
 * @vue-migrate/plugin-i18n-migrate
 *
 * iter-121: vue-i18n v8 → v9 migration
 *
 * Vue I18n 9 has breaking changes from v8:
 *   - this.$t('key') → useI18n().t('key')  (or keep $t via plugin)
 *   - this.$i18n.locale = 'zh' → useI18n().locale.value = 'zh'  (locale is ref)
 *   - Vue.use(VueI18n) → app.use(i18n)
 *   - import VueI18n from 'vue-i18n' → import { createI18n } from 'vue-i18n'
 *   - v-t="'key'" directive removed in v9
 *
 * 实现：
 *   - Script AST: babel traverse 检测 this.$t / $tc / $i18n.t / $i18n.locale / Vue.use(VueI18n) / default import
 *   - Template: 字符串级 replace {{ $t(...) }} → {{ t(...) }}, 但只在有 useI18n import 时才自动改
 *     (没 useI18n 时, 我们不知道用户的 t 名字是什么, 标 review 让用户决定)
 *
 * 关键设计：
 *   - 已经 import useI18n 的文件, 不会有 this.$t (composition 插件会转换), 直接跳过
 *   - 没 import useI18n 的文件, 标 review 让用户自己迁移
 *   - I18nV9.vue (已经 setup + useI18n) 是 no-op
 *
 * Priority: 30 (在 composition=0 之后跑, 这样 composition 已经处理过 options API;
 *             在 vue3-template=9 之前或之后都行, 30 让它排在前面对外暴露)
 *             实际 priority 倒序跑 (高的先跑), 所以 30 比 9 大, 30 先跑。
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import { migrateI18nScript } from './rules/i18n-script.js'
import { applyTemplateTransform } from './rules/i18n-template.js'

const plugin: TransformPlugin = {
  name: 'i18n-migrate',
  description:
    'iter-121: vue-i18n v8 → v9 — detect $t / $tc / $i18n.t / $i18n.locale / Vue.use(VueI18n) / default import, emit review hints to migrate to useI18n() composition API. Auto-rewrites template $t when useI18n import is present.',
  priority: 30,

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    if (!ctx.file.scriptAst && ctx.file.kind !== 'vue') return

    // 1. Script AST: 检测 v8 模式 + 决定 hasUseI18n
    const scriptResult = ctx.file.scriptAst
      ? migrateI18nScript(ctx)
      : { hasUseI18n: false, hasVueI18nImport: false, reviewItems: [], modifications: 0 }

    // push script review items
    for (const r of scriptResult.reviewItems) {
      ctx.utils.manualReview(r)
    }

    // 2. Template: 根据 hasUseI18n 决定自动改还是 review
    if (ctx.file.kind === 'vue') {
      applyTemplateTransform(ctx, scriptResult.hasUseI18n, 'vue-i18n v8 → v9: $t → t')
    }

    if (scriptResult.reviewItems.length > 0) {
      ctx.log?.(`[i18n-migrate] ${ctx.file.relativePath} — ${scriptResult.reviewItems.length} v8 i18n pattern(s) found`)
    }
  },
}

registerPlugin(plugin)
export default plugin
