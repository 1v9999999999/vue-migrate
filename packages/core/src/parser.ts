/**
 * Parser —— 把 script 部分解析成 Babel AST
 */

import { parse } from '@babel/parser'
import type { FileNode, ProjectContext } from './types.js'

const BABEL_OPTIONS_BASE = {
  sourceType: 'module' as const,
  allowImportExportEverywhere: true,
  allowReturnOutsideFunction: true,
  plugins: [
    'decorators-legacy',
    'classProperties',
    'objectRestSpread',
    'optionalChaining',
    'nullishCoalescingOperator',
    'dynamicImport',
  ] as any[],
}

/** 解析单个文件的 script */
export function parseFile(file: FileNode, fallbackToTs = false): void {
  // Vue 文件：解析 script 块
  if (file.kind === 'vue') {
    const scriptBlock = file.sfc?.script
    if (scriptBlock) {
      const code = scriptBlock.content
      // 1) 先按用户标记的 lang 解析
      try {
        file.scriptAst = parseScript(code, isTypeScript(file))
        return
      } catch (e1) {
        // 2) iter-037 fallback: 只在 --ts 开启时 + 是 .vue + 默认 lang=js 时试 TS
        //   iter-035 时默认开启, 误报 + 0 用户明确要 TS fallback
        //   iter-037 改为 opt-in, 默认 false, 用户需明确加 --ts
        if (
          fallbackToTs &&
          !isTypeScript(file) &&
          (file.metadata.lang === 'js' || !file.metadata.lang)
        ) {
          try {
            file.scriptAst = parseScript(code, true)
            file.metadata.lang = 'ts'
            return
          } catch {
            // 也不是 TS, fall through 抛原错
          }
        }
        throw e1
      }
    }
    return
  }
  // 普通 JS/TS
  file.scriptAst = parseScript(file.source, isTypeScript(file))
}

function parseScript(code: string, isTs: boolean): any {
  return parse(code, {
    ...BABEL_OPTIONS_BASE,
    plugins: [
      ...BABEL_OPTIONS_BASE.plugins,
      'jsx',
      ...(isTs ? ['typescript' as const] : []),
    ],
  })
}

function isTypeScript(file: FileNode): boolean {
  if (file.metadata.lang === 'ts' || file.metadata.lang === 'tsx') return true
  if (file.kind === 'ts' || file.kind === 'tsx') return true
  if (file.kind === 'vue' && file.sfc?.script?.lang === 'ts') return true
  return false
}

/** 入口 */
export async function parseProject(ctx: ProjectContext): Promise<void> {
  const fallbackToTs = ctx.config?.fallbackToTs ?? false  // iter-037
  for (const file of ctx.files.values()) {
    try {
      parseFile(file, fallbackToTs)
    } catch (e: any) {
      file.transforms.push({
        plugin: 'core/parser',
        message: 'parse failed',
        changed: false,
        error: e.message,
      })
    }
  }
}
