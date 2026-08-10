/**
 * Context —— 单文件处理时的 transform 上下文
 */

import { parseFile as parseFileImpl } from './parser.js'
import type {
  FileNode,
  ProjectContext,
  TransformContext,
  TransformUtils,
} from './types.js'
import { syncScriptAstToSource as syncScriptAstToSourceImpl } from './sync-script-ast.js'

export function createTransformContext(
  file: FileNode,
  project: ProjectContext,
): TransformContext {
  let changed = false
  let lastMessage = ''

  const utils: TransformUtils = {
    reparse() {
      try {
        parseFileImpl(file)
      } catch (e: any) {
        lastMessage = `reparse failed: ${e.message}`
      }
    },
    syncScriptAstToSource() {
      try {
        syncScriptAstToSourceImpl(file)
        lastMessage = `synced scriptAst → file.source`
      } catch (e: any) {
        lastMessage = `sync failed: ${e.message}`
      }
    },
    markChanged(msg?: string) {
      changed = true
      if (msg) lastMessage = msg
    },
    manualReview(reason: string) {
      file.transforms.push({
        plugin: 'manual-review',
        message: reason,
        changed: false,
      })
      project.stats.manualReviewRequired++
    },
  }

  const ctx: TransformContext = {
    file,
    project,
    utils,
    log: (msg: string) => {
      lastMessage = msg
    },
    // iter-038: 同步 scriptAst → file.source
    // 一些 plugin 改 file.scriptAst（elementui, vue3-types 等）后没写回
    // file.source。当 composition / import-cleaner 跑 raw source 路径时，
    // 这些改动会丢失。`syncScriptAstToSource` 重新 generate scriptAst
    // 替换 file.source 里的 <script> 块。
    syncScriptAstToSource: () => {
      try {
        syncScriptAstToSourceImpl(file)
        lastMessage = `synced scriptAst → file.source`
      } catch (e: any) {
        lastMessage = `sync failed: ${e.message}`
      }
    },
  }

  // 把内部状态挂到 ctx 上（用 Symbol 避免污染）
  ;(ctx as any).__changed = false
  ;(ctx as any).__lastMessage = ''

  const origMarkChanged = utils.markChanged
  utils.markChanged = (msg) => {
    origMarkChanged(msg)
    ;(ctx as any).__changed = true
    ;(ctx as any).__lastMessage = msg || lastMessage || 'changed'
  }

  return ctx
}
