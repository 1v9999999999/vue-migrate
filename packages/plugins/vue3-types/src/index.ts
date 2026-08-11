/**
 * @vue-migrate/plugin-vue3-types
 *
 * TypeScript 类型补全 (P3 / 规则 4.1~4.8)
 *
 * MVP 实现：
 *   ✅ 规则 4.1 — `data()` 返回值类型推断
 *   ✅ 规则 4.2 — `props:` 类型推断 + 缓存到 typeCache
 *   ✅ 规则 4.8 — 统计 newTypesInferred
 *   ⏸ 规则 4.3 — `this.xxx` 反查类型 (MVP 仅做 TODO 标注)
 *   ⏸ 规则 4.4 — `this.$refs.xxx` → ref<InstanceType<...>>() (识别 + TODO)
 *   ⏸ 规则 4.5 — `this.$store` → useXxxStore() (识别 + TODO)
 *   ⏸ 规则 4.6 — `this.$route` → useRoute() (识别 + TODO)
 *   ⏸ 规则 4.7 — JS → TS (MVP 跳过：JSDoc 仍可提供类型提示)
 *
 * 输出策略 ("方式 A" — 保守)：
 *   - TS 脚本  → 在 data() 方法上加 `: { count: number; ... }` 返回类型
 *   - JS 脚本  → 在 data / props 上方加 JSDoc 块（IDE 仍可识别）
 *   - props    → 总是加 JSDoc 块（因为 Options API 没法转 defineProps）
 *
 * 重要的 fileKinds: `['vue', 'ts', 'tsx']`，**不处理 .js**。
 */

import { registerPlugin, type TransformPlugin, type TransformContext } from '@vue-migrate/core'
import { transformDataTypes } from './rules/infer-data.js'
import { transformPropsTypes } from './rules/infer-props.js'
import { markAccessorsAsTodo } from './rules/mark-todos.js'
import { inferThisTypes } from './rules/infer-this.js'
import { isFileTs } from './utils.js'

const plugin: TransformPlugin = {
  name: 'vue3-types',
  description:
    'Infer TypeScript types from data() and props in Vue2 Options API; add return-type / JSDoc annotations; mark $refs/$store/$route as TODO; annotate this.xxx in methods/computed.',
  priority: 5, // run after vue2-compat (10) and vue3-entry (will use similar priority)

  // 只处理 vue / ts / tsx；JS 文件没有类型信息，跳过
  fileKinds: ['vue', 'ts', 'tsx'],

  transform(ctx: TransformContext) {
    const { file, utils, project } = ctx
    if (!file.scriptAst) return

    // Phase 1 - infer data() return type
    try {
      transformDataTypes(ctx)
    } catch (e: any) {
      ctx.log(`data inference failed: ${e.message}`)
    }

    // Phase 2 - infer props: type
    try {
      transformPropsTypes(ctx)
    } catch (e: any) {
      ctx.log(`props inference failed: ${e.message}`)
    }

    // Phase 3 - infer this.xxx type (add JSDoc on methods/computed)
    try {
      inferThisTypes(ctx)
    } catch (e: any) {
      ctx.log(`this inference failed: ${e.message}`)
    }

    // Phase 4 — 标记 this.$refs / $store / $route 为 TODO
    try {
      markAccessorsAsTodo(ctx)
    } catch (e: any) {
      ctx.log(`TODO marker failed: ${e.message}`)
    }

    // 简要诊断
    const ts = isFileTs(file)
    ctx.log(
      `[vue3-types] processed ${file.relativePath} (${ts ? 'TS' : 'JS'}); ` +
        `typeCache size: ${project.typeCache.get(file.path)?.size || 0}`,
    )

    // iter-110: sync AST → file.source (避免 useRawSource 模式下 JSDoc 注释丢失)
    //   4 个 sub-rule 全用 attachJSDoc 改 node.leadingComments, 这些 comments 不会
    //   自动写回 file.source, 如果后续 composition (priority 0) 设 useRawSource=true,
    //   codegen 会忽略 scriptAst 直接输出 file.source, 所有 JSDoc 注释丢失.
    if (file.kind === 'vue' && file.scriptAst && file.changed) {
      try { ctx.utils.syncScriptAstToSource() } catch (e: any) {
        ctx.log(`[vue3-types] syncScriptAstToSource failed: ${e.message}`)
      }
    }
  },
}

registerPlugin(plugin)
export default plugin
