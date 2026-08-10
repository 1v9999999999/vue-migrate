/**
 * @vue-migrate/plugin-3rd-party-imports
 *
 * iter-045b: 3rd-party 库 import 形式适配。
 *
 * 当 3rd-party 库从 CJS / 旧 ESM 升级到新 ESM, 原 `import X from 'pkg'` 可能
 * 失效或降级到 interop 默认值。本插件把这些 default import 改成 namespace import。
 *
 * 当前覆盖：
 *   - echarts: 4.x → 5.x (原生 ESM, default 在 Vite 5 + strict mode 下可能不导出)
 *   - screenfull: 4.x → 6.x (同样 ESM 升级, 建议 namespace import)
 *
 * Priority: 7（在 composition 之后、import-cleaner 之前跑；这样 import-cleaner
 *           后续能基于 namespace 形式统计引用）
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import { fixEchartsImports } from './rules/echarts.js'
import {
  fixDefaultToNamespace,
  type DefaultToNamespaceRule,
} from './rules/import-default-to-namespace.js'

const DEFAULT_TO_NAMESPACE_RULES: DefaultToNamespaceRule[] = [
  {
    name: 'screenfull',
    localName: 'screenfull',
    reason: 'screenfull v6 ESM 升级, namespace import 更稳',
  },
]

const plugin: TransformPlugin = {
  name: '3rd-party-imports',
  description:
    'iter-045b: Adapt 3rd-party library import forms after Vue 3 upgrade (echarts v5 ESM, screenfull v6 ESM, etc.).',
  priority: 7,
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    if (!ctx.file.scriptAst) return
    // echarts 是高频库, 单独 rule 提供更精准的提示
    const r1 = fixEchartsImports(ctx)
    // screenfull 等其它 3rd-party 走通用规则
    const r2 = fixDefaultToNamespace(ctx, DEFAULT_TO_NAMESPACE_RULES)
    // 写回 file.source（plugin 改 AST 后必须 sync）
    if (r1.changed || r2.changed) {
      ctx.syncScriptAstToSource()
    }
  },
}

registerPlugin(plugin)
export default plugin
