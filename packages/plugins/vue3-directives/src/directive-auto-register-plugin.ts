/**
 * iter-048a F6: Auto-register directive .use() in main.js
 *
 * 拆出来单独 plugin,priority 5(在 vue3-entry 9 之后跑)。
 * 这样 vue3-entry 已经构造好 createApp chain,我们往里加 .use(DirectiveXxx)。
 */

import {
  registerPlugin,
  type TransformPlugin,
} from '@vue-migrate/core'

import {
  isMainFile,
  collectDirectivesFromProject,
  injectDirectivesIntoMainAst,
} from './directive-auto-register-plugin-helpers.js'

const plugin: TransformPlugin = {
  name: 'directive-auto-register',
  description:
    'iter-048a F6: scan project for src/directive/xxx/index.js files with install field, and auto-inject import + .use() chain in main.js. Runs at priority 5, after vue3-entry (9) so the createApp chain is already built.',
  priority: 5, // after vue3-entry (9) which builds the createApp chain

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx) {
    const { file, utils } = ctx
    if (!isMainFile(file)) return

    const directives = collectDirectivesFromProject(ctx.project)
    if (directives.length === 0) return

    const injected = injectDirectivesIntoMainAst(file, directives, ctx.project)
    if (injected > 0) {
      utils.markChanged(`[F6] auto-injected ${injected} directive .use() to main.js`)
      console.log(`\n[directive-auto-register] ${file.relativePath} injected ${injected} directive .use() to main.js`)

      // iter-110: sync AST → file.source (避免 useRawSource 模式下 AST 改动丢失)
      //   main.js 同时被 vue-router-v4 (priority 9) / vuex-pinia (priority 9) /
      //   store-bridge (priority -1) 改并设 useRawSource=true. 如果 directive-auto-register
      //   之后又改 AST 注入 directive import + .use() chain, 这些改动会丢.
      try { utils.syncScriptAstToSource() } catch (e: any) {
        ctx.log(`[directive-auto-register] syncScriptAstToSource failed: ${e.message}`)
      }
    }
  },
}

registerPlugin(plugin)
export default plugin
