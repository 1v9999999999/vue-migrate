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
 *   - vuedraggable: 2.x → 4.x (v2 default export → v4 named export `draggable`)
 *   - xlsx / jszip: CJS 模块, Vite 5 + strict ESM 下 default 不可用
 *   - file-saver: Vite 5 下有 named `saveAs`, 改 named import
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
import { fixVuedraggableImports } from './rules/vuedraggable.js'
import {
  fixDefaultToNamespace,
  type DefaultToNamespaceRule,
} from './rules/import-default-to-namespace.js'
import {
  fixCjsDefaultToNamed,
  type CjsDefaultToNamedRule,
} from './rules/import-cjs-default-to-named.js'
import { fixElementPlusLibToEs } from './rules/element-plus-lib-to-es.js'

const DEFAULT_TO_NAMESPACE_RULES: DefaultToNamespaceRule[] = [
  // screenfull v6 只有 default export (`export default screenfull`),
  // 不能 namespace import (会变成 screenfull.default.x)
  // 保持 default import 即可, Vite interop 正常
]

/**
 * iter-048a F4: CJS 库 default import 转换
 *  - xlsx/jszip: CJS only, Vite 5 + strict ESM 下 default 不可用 → namespace
 *  - file-saver: Vite 5 下有 named `saveAs`, 改 named import
 */
const CJS_DEFAULT_TO_NAMED_RULES: CjsDefaultToNamedRule[] = [
  {
    name: 'xlsx',
    type: 'namespace',
    reason: 'xlsx 是 CJS 模块,Vite 5 + strict ESM 下 default export 不可用',
  },
  {
    name: 'jszip',
    type: 'namespace',
    reason: 'jszip 是 CJS 模块,Vite 5 + strict ESM 下 default export 不可用',
  },
  {
    name: 'file-saver',
    type: 'named',
    namedImports: { default: 'saveAs' },
    reason: 'file-saver Vite 5 下 default 不可用,但有 named export `saveAs`',
  },
]

/**
 * iter-048: ESM 库 default 改 named (driver.js v1.8 无 default export).
 *  - driver.js v1.8: 只有 named `driver` export, default 不可用
 *  - 用户的代码用 `Driver.xxx()` 不变, 改 import 让 `Driver = driver` 即可
 */
const ESM_DEFAULT_TO_NAMED_RULES: CjsDefaultToNamedRule[] = [
  {
    name: 'driver.js',
    type: 'named',
    namedImports: { default: 'driver' },
    reason: 'driver.js v1.8 已无 default export,只有 named `driver`',
  },
]

const plugin: TransformPlugin = {
  name: '3rd-party-imports',
  description:
    'iter-045b + iter-048a: Adapt 3rd-party library import forms after Vue 3 upgrade (echarts v5 ESM, screenfull v6 ESM, vuedraggable v2→v4 named export, xlsx/jszip/file-saver CJS interop).',
  priority: 7,
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    if (!ctx.file.scriptAst) return
    // echarts 是高频库, 单独 rule 提供更精准的提示
    const r1 = fixEchartsImports(ctx)
    // iter-048a F3: vuedraggable v2 → v4: default → named { draggable }
    const r2 = fixVuedraggableImports(ctx)
    // screenfull 等其它 3rd-party 走通用规则
    const r3 = fixDefaultToNamespace(ctx, DEFAULT_TO_NAMESPACE_RULES)
    // iter-048a F4: CJS 库 default import 转换 (xlsx/jszip/file-saver)
    const r4 = fixCjsDefaultToNamed(ctx, CJS_DEFAULT_TO_NAMED_RULES)
    // iter-048: ESM 库 default 改 named (driver.js 等)
    const r5 = fixCjsDefaultToNamed(ctx, ESM_DEFAULT_TO_NAMED_RULES)
    // iter-048: sub-path 改写 (element-plus v2 路径: lib/ → es/)
    const r6 = fixElementPlusLibToEs(ctx)
    // 写回 file.source（plugin 改 AST 后必须 sync）
    if (r1.changed || r2.changed || r3.changed || r4.changed || r5.changed || r6.changed) {
      ctx.syncScriptAstToSource()
    }
  },
}

registerPlugin(plugin)
export default plugin
