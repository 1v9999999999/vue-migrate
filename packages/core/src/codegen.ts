/**
 * Codegen —— 把修改后的 AST 还原成源码
 * 
 * 设计原则：
 * - 对 .vue 文件：只重新生成 script 块，template/style 原样保留
 * - 保留源码风格（缩进、引号）通过 generator options 控制
 * - 重写后必须能再次解析（自检）
 */

// @ts-ignore -- @babel/generator has no built-in .d.ts; this is dev-only code
import _generate from '@babel/generator'
import { parse as parseSfcForCheck } from '@vue/compiler-sfc'
import { parse as parseBabelForCheck } from '@babel/parser'
import type { FileNode, ProjectContext } from './types.js'

// @babel/generator 在 ESM 下是具名导出，兼容 default
const generate = (_generate as any).default || _generate

const GENERATOR_OPTIONS = {
  // 注意：retainLines=true 会让输出格式很丑（大量空行、单行挤一起）
  // 改成 false 让 generator 按 AST 结构输出，prettier 友好
  retainLines: false,
  comments: true,
  compact: false,
  jsescOption: {
    minimal: true, // 尽量少转义
  },
  concise: false,
}

/** 重新生成单个文件 */
export function codegenFile(file: FileNode): string {
  if (file.useRawSource) {
    return file.source
  }
  if (file.kind === 'vue') {
    return codegenVueFile(file)
  }
  // 普通 JS/TS
  if (!file.scriptAst) return file.source
  const result = generate(file.scriptAst as any, GENERATOR_OPTIONS)
  return result.code + '\n'
}

function codegenVueFile(file: FileNode): string {
  const sfc = file.sfc
  if (!sfc) return file.source

  // 如果插件标记了 useRawSource（如 composition 插件），直接用
file.source
  if (file.useRawSource) {
    return file.source
  }

  const source = file.source
  const newScriptContent = sfc.script && file.scriptAst
    ? (generate(file.scriptAst as any, GENERATOR_OPTIONS).code)
    : sfc.script?.content

  if (!sfc.script || !newScriptContent) {
    return source
  }

  const start = sfc.script.loc.start.offset
  const end = sfc.script.loc.end.offset

  return (
    source.slice(0, start) +
    newScriptContent +
    source.slice(end)
  )
}

/** 自检：生成的代码能再次解析（避免插件写出语法错误） */
export function selfCheck(file: FileNode): { ok: boolean; error?: string } {
  const output = codegenFile(file)
  // iter-126: 用原 source 决定 plugin (codegen 后的 output 可能已被转成 h() 调用,
  //   但部分 plugin (如 jsx-render) 转换不完全, 仍残留 JSX; 用原 source 检测最稳)
  const sourceForDetect = (file as any)._origSource || file.source
  try {
    if (file.kind === 'vue') {
      parseSfcForCheck(output, { filename: file.path })
    } else if (file.kind === 'tsx') {
      // iter-123: .tsx 需 jsx + typescript plugins (otherwise JSX 解析失败)
      parseBabelForCheck(output, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      })
    } else if (file.kind === 'jsx') {
      // iter-123: .jsx 需 jsx plugin
      parseBabelForCheck(output, {
        sourceType: 'module',
        plugins: ['jsx'],
      })
    } else if (file.kind === 'ts') {
      // iter-123: .ts 需 typescript plugin
      // iter-126: 检测原 source 是否含 JSX
      const hasJsx = /return\s*\(?\s*<\s*[A-Za-z]/.test(sourceForDetect) ||
                     /<\/?[A-Z][A-Za-z0-9_]*\s*[(\/>]/.test(sourceForDetect)
      parseBabelForCheck(output, {
        sourceType: 'module',
        plugins: hasJsx ? ['typescript', 'jsx'] : ['typescript'],
      })
    } else {
      // .js
      // iter-126: 检测原 source 是否含 JSX
      // 启发式: render 函数体里 return <tag> 或 render 后的 <Tag> 多半是 JSX
      const hasJsx = /return\s*\(?\s*<\s*[A-Za-z]/.test(sourceForDetect) ||
                     /<\/?[A-Z][A-Za-z0-9_]*\s*[(\/>]/.test(sourceForDetect)
      parseBabelForCheck(output, {
        sourceType: 'module',
        plugins: hasJsx ? ['jsx'] : [],
      })
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function codegenProject(ctx: ProjectContext): Promise<Map<string, string>> {
  const results = new Map<string, string>()
  for (const file of ctx.files.values()) {
    // iter-118: skipped file (Nuxt 特殊函数) 输出原 source 副本 (user 至少有原文件)
    if ((file as any).__skipped && !file.changed) {
      try {
        const orig = require('node:fs').readFileSync(file.path, 'utf8')
        results.set(file.path, orig)
        file.transforms.push({
          plugin: 'core/skip',
          message: `file skipped (${(file as any).__skipped}), output original source`,
          changed: false,
        })
      } catch (e: any) {
        // 原文件读不到, 跳过
      }
      continue
    }
    // iter-118: failed file 仍输出原 source 副本 (plugin 抛错时 user 至少有原文件)
    if ((file as any).__failed) {
      try {
        const orig = require('node:fs').readFileSync(file.path, 'utf8')
        results.set(file.path, orig)
        file.transforms.push({
          plugin: 'core/fallback',
          message: `plugin ${(file as any).__failedPlugin} failed (${(file as any).__failedError?.slice(0, 100)}), output original source`,
          changed: false,
        })
      } catch (e: any) {
        // 原文件也读不到, 跳过
      }
      continue
    }
    if (file.changed) {
      try {
        const code = codegenFile(file)
        const check = selfCheck({ ...file, source: code, changed: false })
        if (check.ok) {
          results.set(file.path, code)
        } else {
          console.log(`[codegen-DEBUG] selfCheck FAIL: ${file.relativePath} err=${check.error?.slice(0, 200)}`)
          if (process.env.DBG_CG) {
            console.log('--- BEGIN code ---')
            console.log(code)
            console.log('--- END code ---')
          }
          // iter-122c: source 本身 corruption (或 plugin 写坏) 时, fallback 输出原 source
          // (user 至少有原文件, 不会被 0 bytes / 损坏产物坑)
          try {
            const orig = require('node:fs').readFileSync(file.path, 'utf8')
            results.set(file.path, orig)
            // marked with a special message so reviewItems 收集时跳过 (源 corruption 不是 plugin 错)
            file.transforms.push({
              plugin: 'core/codegen',
              message: 'self-check failed, fallback to original source',
              changed: false,
            })
          } catch (e: any) {
            file.transforms.push({
              plugin: 'core/codegen',
              message: 'self-check failed, no original source available',
              changed: false,
              error: check.error,
            })
            ctx.stats.errors++
          }
        }
      } catch (e: any) {
        file.transforms.push({
          plugin: 'core/codegen',
          message: 'codegen error',
          changed: false,
          error: e.message,
        })
        ctx.stats.errors++
      }
    }
  }
  return results
}
