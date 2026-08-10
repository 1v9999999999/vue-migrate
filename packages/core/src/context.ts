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
