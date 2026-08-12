/**
 * Parser —— 把 script 部分解析成 Babel AST
 *
 * iter-122b: 加 parse cache — 相同内容(按 path+content hash 算)直接复用上次解析结果,
 * 避免 plugin 调 utils.reparse() 时重 parse. 当前 plugin 几乎不调 reparse, 主要是
 * 防御性: 未来 plugin 需要 reparse 时不用重 parse; 同一文件多次跑 pipeline 也省
 * babel parse 时间.
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

/** iter-122b: parse cache.  key = path + content hash + isTs.  value = parsed AST. */
interface CacheEntry {
  code: string
  isTs: boolean
  ast: any
  bytes: number
}

const parseCache = new Map<string, CacheEntry>()

/** 快速 FNV-1a 32-bit hash, 避免依赖 crypto module. */
function fnvHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16)
}

function makeCacheKey(filePath: string, code: string, isTs: boolean): string {
  return `${filePath}::${fnvHash(code)}::${isTs ? 'ts' : 'js'}`
}

/** 解析单个文件的 script */
export function parseFile(file: FileNode, fallbackToTs = false): void {
  // Vue 文件：解析 script 块
  if (file.kind === 'vue') {
    const scriptBlock = file.sfc?.script
    if (scriptBlock) {
      const code = scriptBlock.content
      const isTs = isTypeScript(file)
      // iter-122b: cache lookup — 同一文件同一内容直接复用 AST, 避免 babel 重 parse
      const cacheKey = makeCacheKey(file.path, code, isTs)
      const cached = parseCache.get(cacheKey)
      if (cached && cached.code === code && cached.isTs === isTs) {
        file.scriptAst = cached.ast
        return
      }
      // 1) 先按用户标记的 lang 解析
      try {
        const ast = parseScript(code, isTs)
        file.scriptAst = ast
        parseCache.set(cacheKey, { code, isTs, ast, bytes: code.length })
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
            const ast = parseScript(code, true)
            file.scriptAst = ast
            file.metadata.lang = 'ts'
            parseCache.set(makeCacheKey(file.path, code, true), { code, isTs: true, ast, bytes: code.length })
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
  const isTs = isTypeScript(file)
  const cacheKey = makeCacheKey(file.path, file.source, isTs)
  const cached = parseCache.get(cacheKey)
  if (cached && cached.code === file.source && cached.isTs === isTs) {
    file.scriptAst = cached.ast
    return
  }
  const ast = parseScript(file.source, isTs)
  file.scriptAst = ast
  parseCache.set(cacheKey, { code: file.source, isTs, ast, bytes: file.source.length })
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

/** iter-122b: 暴露给测试 / perf benchmark 用 — 清空 parse cache. */
export function clearParseCache(): void {
  parseCache.clear()
}

/** iter-122b: 暴露给测试 / debug — 获取 cache 状态. */
export function getParseCacheStats(): { size: number; totalBytes: number } {
  let totalBytes = 0
  for (const entry of parseCache.values()) totalBytes += entry.bytes
  return { size: parseCache.size, totalBytes }
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
      // iter-122c: 源 corruption — 锁住文件, 跳过所有后续 plugin
      // (类似 plugin throw recovery, codegen fallback 输出原 source)
      ;(file as any).__failed = true
      ;(file as any).__failedPlugin = 'core/parser'
      ;(file as any).__failedError = e.message
    }
  }
}
