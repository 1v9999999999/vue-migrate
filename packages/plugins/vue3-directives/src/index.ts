/**
 * @vue-migrate/plugin-vue3-directives
 *
 * Process Vue2 -> Vue3 custom directives, filters, template rules.
 *
 * Rules:
 *   - 6.1  directive lifecycle: bind -> beforeMount, inserted -> mounted
 *   - 6.2  directive update / componentUpdated -> updated (conflict -> manual review)
 *   - 2.3  template filter pipe: {{ x | f | g(a) }} -> {{ g(f(x), a) }}
 *   - 2.3  filters: { ... } option detected + warn (no auto rewrite)
 *   - 5.1  keycode numeric modifier removed
 *   - 5.3  v-if + v-for same node warning
 *   - 5.4  :value + @input -> v-model
 *   - 5.5  keep-alive :include string -> array
 *   - 6.x  install(Vue) -> install(app)
 *   - iter-048a F6: in transform phase, scan directive files + main.js,
 *           auto-inject import + .use() chain in main.js
 */

import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import { relative as pathRelative, dirname } from 'node:path'
import {
  registerPlugin,
  type TransformPlugin,
  type FileNode,
} from '@vue-migrate/core'

import { applyDirectiveHookRename } from './rules/directive-hooks'
import { applyTemplateFilterRewrite } from './rules/template-filters'
import { applyKeycodeRemoval } from './rules/template-keycode'
import { applyVIfVForWarning } from './rules/template-vif-vfor'
import { applyValueInputToVModel } from './rules/template-value-input'
import { applyKeepAliveIncludeArray } from './rules/template-keep-alive'
import { applyFiltersOptionWarning } from './rules/filters-option'
import { applyDirectiveInstallRewrite } from './rules/directive-install-rewrite'
import { applyDirectiveVnodeBindingRewrite } from './rules/directive-vnode-binding'
import {
  extractDirectiveName,
  toPascalCase,
} from './rules/directive-auto-register.js'

const traverse = (_traverse as any).default || _traverse
const generate = (_generate as any).default || _generate

// iter-122b: 早 return 检测 — 源文件里完全没有 vue3-directives 关心的 pattern
//   关心的 pattern: ① directive hooks (bind/inserted/update/unbind/componentUpdated)
//                   ② vnode.context 引用
//                   ③ install(Vue) 形式
//                   ④ filters: { ... } option
//                   ⑤ template filter {{ x | f }}
//                   ⑥ keycode (e.g. .enter.13)
//                   ⑦ v-if + v-for on same node
//                   ⑧ :value + @input (要变 v-model)
//                   ⑨ keep-alive :include
//   这 9 类 pattern 都不匹配, 9 个 rule 全是空跑, 直接跳过
const HAS_DIRECTIVE_PATTERN_RE = /\b(?:bind|inserted|update|componentUpdated|unbind)\s*[:(]|\bvnode\.context|\binstall\s*\(\s*Vue|\bfilters\s*:\s*\{|\{\{[^}]*\|\s*[A-Za-z_$][\w$]*\s*[\}\)]|\.(?:enter|tab|delete|esc|space|up|down|left|right|13|27|32|37|38|39|40|46)\b|v-if[^>]*v-for|v-for[^>]*v-if|:value=.*@input=|<keep-alive[^>]*:include/

const plugin: TransformPlugin = {
  name: 'vue3-directives',
  description:
    'Migrate Vue2 custom directive hooks, template filters, keycode modifiers, v-if+v-for, :value+@input, keep-alive :include, install(Vue)->install(app), window.Vue guard cleanup, vnode.context->binding.instance, and auto-register directive plugins in main.js (iter-048a F6).',
  priority: 30, // after vue2-compat (10)

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx) {
    const { file, utils } = ctx

    // iter-122b: 早 return — 没有任何 vue3-directives 关心的 pattern, 9 个 rule 全是空跑
    //   master 195 估算 60-70% 文件 (简单业务组件) 不含这些 pattern, 节省 ~70ms
    if (!HAS_DIRECTIVE_PATTERN_RE.test(file.source)) return

    // script AST rules
    if (file.scriptAst) {
      applyDirectiveHookRename(file, utils)
      applyDirectiveVnodeBindingRewrite(file, utils)
      applyDirectiveInstallRewrite(file, utils)
      applyFiltersOptionWarning(file, utils)
    }

    // template rules
    if (file.kind === 'vue') {
      applyTemplateFilterRewrite(ctx)
      applyKeycodeRemoval(ctx)
      applyVIfVForWarning(ctx)
      applyValueInputToVModel(ctx)
      applyKeepAliveIncludeArray(ctx)
    }

    // iter-110: sync AST → file.source (避免 useRawSource 模式下 AST 改动丢失)
    //   3 个 script rule (applyDirectiveHookRename / applyDirectiveVnodeBindingRewrite /
    //   applyDirectiveInstallRewrite) 改 AST: directive hook bind→beforeMount, vnode.context
    //   →binding.instance, install(Vue)→install(app). 这些都是 AST 改动. 若该文件后续被
    //   store-bridge / vue-router-v4 / composition 设 useRawSource=true, 改动丢失.
    if (file.scriptAst && file.changed) {
      try { utils.syncScriptAstToSource() } catch (e: any) {
        ctx.log(`[vue3-directives] syncScriptAstToSource failed: ${e.message}`)
      }
    }

    // F6: directive auto-register moved to separate plugin (directive-auto-register-plugin.ts)
    // priority 5 to run after vue3-entry (9)
  },
}

registerPlugin(plugin)
export default plugin
import './directive-auto-register-plugin.js'
