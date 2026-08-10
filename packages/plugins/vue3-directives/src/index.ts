/**
 * @vue-migrate/plugin-vue3-directives
 *
 * 处理 Vue2 → Vue3 的自定义指令 / 过滤器 / 模板相关规则。
 *
 * 实现的规则：
 *   - 6.1  指令生命周期重命名：bind → beforeMount, inserted → mounted
 *   - 6.2  指令 update / componentUpdated → updated（合并，冲突时人工 review）
 *         指令 unbind → unmounted
 *   - 2.3  模板过滤器 `{{ x | f | g(a) }}` → `{{ g(f(x), a) }}`
 *   - 2.3  `filters: { ... }` 选项识别 + 警告（不自动重构）
 *   - 5.1  keycode 数字修饰符移除（`@keyup.13` → `@keyup.enter` 或警告）
 *   - 5.3  v-if + v-for 同节点警告（Vue2/Vue3 优先级相反）
 *   - 5.4  `:value="x" @input="y"` → `v-model="x"`
 *   - 5.5  `<keep-alive :include="'a,b,c'">` → 数组
 *
 * 关键限制 / 已知降级：
 *   - 模板修改通过 transformTemplate() 改 file.source，同时
 *     自动更新 sfc.script.loc 以便 core codegen 正确切 script 块。
 *   - 脚本端 AST 规则改 file.scriptAst，**不**清空，保留给 codegen。
 *   - filter 选项只识别 + 警告，完整重构涉及跨文件 utils 提取，列为 TODO。
 *   - 指令 hook 冲突（同时存在 update + componentUpdated）改名成
 *     `updated_legacy_xxx` + manualReview，需要人工合并。
 */

import { registerPlugin, type TransformPlugin } from '@vue-migrate/core'

import { applyDirectiveHookRename } from './rules/directive-hooks'
import { applyTemplateFilterRewrite } from './rules/template-filters'
import { applyKeycodeRemoval } from './rules/template-keycode'
import { applyVIfVForWarning } from './rules/template-vif-vfor'
import { applyValueInputToVModel } from './rules/template-value-input'
import { applyKeepAliveIncludeArray } from './rules/template-keep-alive'
import { applyFiltersOptionWarning } from './rules/filters-option'
import { applyDirectiveInstallRewrite } from './rules/directive-install-rewrite'
import { applyDirectiveVnodeBindingRewrite } from './rules/directive-vnode-binding'

const plugin: TransformPlugin = {
  name: 'vue3-directives',
  description:
    'Migrate Vue2 custom directive hooks, template filters, keycode modifiers, v-if+v-for, :value+@input, keep-alive :include, install(Vue)→install(app), window.Vue guard cleanup, vnode.context→binding.instance to Vue3 idioms.',
  priority: 30, // 跑在 vue2-compat (10) 之后

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx) {
    const { file, utils } = ctx

    // 脚本端 AST 规则 —— 只在有 scriptAst 时跑
    if (file.scriptAst) {
      applyDirectiveHookRename(file, utils)
      applyDirectiveVnodeBindingRewrite(file, utils)
      applyDirectiveInstallRewrite(file, utils)
      applyFiltersOptionWarning(file, utils)
    }

    // template rules - only run on .vue; modify file.source and sync sfc.script.loc
    if (file.kind === 'vue') {
      applyTemplateFilterRewrite(ctx)
      applyKeycodeRemoval(ctx)
      applyVIfVForWarning(ctx)
      applyValueInputToVModel(ctx)
      applyKeepAliveIncludeArray(ctx)
    }
  },
}

registerPlugin(plugin)
export default plugin
