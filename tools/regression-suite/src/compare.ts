/**
 * compare.ts
 *
 * 单文件 hash 比对 + 错误检测
 * 把 golden file copy 到临时目录 -> 跑 vue-migrate --only-changed -> 读输出 -> SHA-256
 */

import { readFile, copyFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import type { GoldenFile } from './select-golden.js'

export interface FileComparison {
  path: string
  expectedHash: string
  actualHash: string
  matches: boolean
  hasError: boolean
  reviewCount: number
  /** 错误消息(若有) */
  error?: string
  /** 实际跑过的毫秒数 */
  durationMs: number
  /** 实际输出文本(可选, 供调试) */
  actualOutput?: string
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex')
}

export interface CompareOptions {
  repoRoot: string
  /** 单文件超时, 默认 30s */
  timeoutMs?: number
  /** 是否保留临时目录(默认 false, 仅 debug) */
  keepTmp?: boolean
  /** 调试日志 */
  log?: (s: string) => void
}

/**
 * 跑单个 golden file 的 transform, 返回归一化输出
 */
async function runOne(
  fileAbsPath: string,
  expectedFname: string,
  opts: CompareOptions,
): Promise<{ output: string | null; error: string | null; reviewCount: number; durationMs: number }> {
  const start = Date.now()
  const tmpIn = await mkdtemp(join(tmpdir(), 'vm-reg-comp-in-'))
  const tmpOut = await mkdtemp(join(tmpdir(), 'vm-reg-comp-out-'))
  const timeoutMs = opts.timeoutMs ?? 30_000
  const log = opts.log ?? (() => {})

  try {
    await copyFile(fileAbsPath, join(tmpIn, expectedFname))
  } catch (e: any) {
    return { output: null, error: `copy fail: ${e.message}`, reviewCount: 0, durationMs: Date.now() - start }
  }

  const cliEntry = join(opts.repoRoot, 'packages', 'cli', 'src', 'index.ts')
  const tsxCli = join(opts.repoRoot, 'packages', 'cli', 'node_modules', 'tsx', 'dist', 'cli.mjs')

  return await new Promise((resolveP) => {
    const child = spawn('node', [
      tsxCli,
      cliEntry,
      'transform',
      tmpIn,
      '-o', tmpOut,
      '--only-changed',
    ], { cwd: opts.repoRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    let stdout = ''
    let reviewCount = 0
    // 解析 stdout 里的"需人工: N"
    const reviewRe = /需人工[:\s]+(\d+)/

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
    }, timeoutMs)

    child.stdout?.on('data', d => {
      const s = d.toString()
      stdout += s
      const m = s.match(reviewRe)
      if (m) reviewCount = parseInt(m[1], 10)
    })
    child.stderr?.on('data', d => stderr += d.toString())

    child.on('close', (code) => {
      clearTimeout(timer)
      const durationMs = Date.now() - start
      if (code !== 0) {
        return resolveP({
          output: null,
          error: `exit=${code} stderr=${stderr.slice(-300)}`,
          reviewCount: 0,
          durationMs,
        })
      }
      const outPath = join(tmpOut, expectedFname)
      if (!existsSync(outPath)) {
        // "没改" 不是错误, 而是有效结果: 输出 = 空内容
        // 这跟 baseline 中 expectedHash="" 对齐
        return resolveP({
          output: '',
          error: null,
          reviewCount,
          durationMs,
        })
      }
      readFile(outPath, 'utf-8').then(content => {
        const normalized = content.replace(/\r\n/g, '\n')
        resolveP({ output: normalized, error: null, reviewCount, durationMs })
      }).catch((e) => {
        resolveP({ output: null, error: `read fail: ${e.message}`, reviewCount, durationMs })
      })
    })

    child.on('error', (e) => {
      clearTimeout(timer)
      resolveP({ output: null, error: `spawn fail: ${e.message}`, reviewCount: 0, durationMs: Date.now() - start })
    })
  }).then(async (r) => {
    if (!opts.keepTmp) {
      // 异步清理, 不 await
      rm(tmpIn, { recursive: true, force: true }).catch(() => {})
      rm(tmpOut, { recursive: true, force: true }).catch(() => {})
    }
    return r
  })
}

/**
 * 找到 golden file 在磁盘上的实际位置
 * 优先 baselines/golden/<path>, 否则回退到 examples/<path>
 */
export function resolveGoldenPath(golden: GoldenFile, repoRoot: string): string {
  const candidate1 = join(repoRoot, 'baselines', 'golden', golden.path)
  if (existsSync(candidate1)) return candidate1
  return join(repoRoot, 'examples', golden.path)
}

export async function compareFile(
  golden: GoldenFile,
  opts: CompareOptions,
): Promise<FileComparison> {
  const log = opts.log ?? (() => {})
  const start = Date.now()
  const fileAbsPath = resolveGoldenPath(golden, opts.repoRoot)
  const expectedFname = basename(fileAbsPath)
  log(`  [compare] ${golden.path}`)

  const r = await runOne(fileAbsPath, expectedFname, opts)
  if (r.error) {
    return {
      path: golden.path,
      expectedHash: golden.expectedHash,
      actualHash: '',
      matches: false,
      hasError: true,
      reviewCount: r.reviewCount,
      error: r.error,
      durationMs: Date.now() - start,
    }
  }

  // 空 output(没被任何 plugin 改) -> actualHash = '' 与 baseline 语义对齐
  // 非空 -> SHA-256(normalized output)
  const actualHash = r.output === '' ? '' : sha256(r.output!)
  return {
    path: golden.path,
    expectedHash: golden.expectedHash,
    actualHash,
    matches: actualHash === golden.expectedHash,
    hasError: false,
    reviewCount: r.reviewCount,
    durationMs: Date.now() - start,
  }
}
