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
export function parseFile(file: FileNode): void {
  // Vue 文件：解析 script 块
  if (file.kind === 'vue') {
    const scriptBlock = file.sfc?.script
    if (scriptBlock) {
      file.scriptAst = parseScript(scriptBlock.content, isTypeScript(file))
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
  for (const file of ctx.files.values()) {
    try {
      parseFile(file)
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
