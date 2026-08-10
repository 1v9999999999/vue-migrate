/**
 * tools/baseline-comparator/src/runner.ts
 *
 * 跑一个样本：
 *   1. 把 sample 复制到 workDir/official/  → 跑 vue-codemod
 *   2. 把 sample 复制到 workDir/our/      → 跑 vue-migrate
 *   3. 对比两边的输出，得到 ComparisonMetrics
 *
 * 超时：单次 sample 10 分钟（默认）。单个子步骤（我们的 / 官方的）有独立超时。
 */

import { spawn } from 'node:child_process'
import { copyFile, mkdir, rm, readdir, readFile, stat } from 'node:fs/promises'
import { existsSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'

import { runOfficialCodemod, readAllFiles } from './run-official.js'
import { compareOutputs, type ComparisonMetrics } from './metrics.js'
import type { FileMetrics } from '../../common/types.js'

export interface SampleComparison {
  samplePath: string
  ourRun: { ok: boolean; metrics: Partial<FileMetrics> & { _rawReport?: string } }
  officialRun: { ok: boolean; metrics: { modified: number; reviewCount: number; totalFiles: number; skippedReason?: string } }
  comparison: ComparisonMetrics
  durationMs: number
  error?: string
}

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..')

/** 复制目录下所有 .vue/.js/.ts 等源文件到 dst（保持相对路径） */
async function copySample(srcDir: string, dstDir: string): Promise<number> {
  await mkdir(dstDir, { recursive: true })
  const SUPPORTED = new Set(['.vue', '.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.scss', '.less', '.html'])
  let count = 0
  async function visit(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('_old_')) continue
      const sp = join(dir, e.name)
      const rel = relative(srcDir, sp)
      const dp = join(dstDir, rel)
      if (e.isDirectory()) {
        await mkdir(dp, { recursive: true })
        await visit(sp)
      } else if (e.isFile()) {
        const dot = e.name.lastIndexOf('.')
        if (dot >= 0 && SUPPORTED.has(e.name.slice(dot).toLowerCase())) {
          await mkdir(dirname(dp), { recursive: true })
          await copyFile(sp, dp)
          count++
        }
      }
    }
  }
  await visit(srcDir)
  return count
}

/** 跑我们的 vue-migrate transform */
async function runOurPipeline(
  sampleDir: string,
  outDir: string,
  timeoutMs: number,
): Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  // 从 vue-migrate 根目录跑（pnpm workspace 依赖要求）
  // CLI: pnpm run dev:cli -- transform <sampleDir> -o <outDir>
  return new Promise((resolveP) => {
    const cliPath = join(ROOT, 'packages', 'cli', 'src', 'index.ts')
    // 用绝对路径的 tsx.cmd (因为 cmd.exe 子进程的 PATH 跟 node 不同)
    const tsxBin = join(ROOT, 'packages', 'cli', 'node_modules', '.bin', 'tsx.cmd')
    const args = [
      tsxBin,
      cliPath,
      'transform',
      sampleDir,
      '-o', outDir,
      '--only-changed', // 不拷贝未改文件，输出目录里只有真正改过的
    ]
    const child = spawn('cmd.exe', ['/c', ...args], {
      cwd: ROOT,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      try { child.kill('SIGKILL') } catch {}
    }, timeoutMs)

    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolveP({ ok: !timedOut && code === 0, stdout, stderr, code, timedOut })
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      resolveP({ ok: false, stdout, stderr: stderr + `\nspawn error: ${e.message}`, code: -1, timedOut })
    })
  })
}

/** 从 vue-migrate 的报告里提取关键数字 */
function parseOurReport(stdout: string, stderr: string, sampleDir: string, outDir: string): Partial<FileMetrics> & { _rawReport: string; _errors: string[] } {
  const full = stdout + '\n' + stderr
  const num = (re: RegExp): number => {
    const m = full.match(re)
    return m ? parseInt(m[1], 10) : 0
  }
  // 报告里是中文：总文件 / 已修改 / 需人工 / 新增类型 / 错误
  const totalFiles = num(/总文件[^\d]*(\d+)/)
  const modified = num(/已修改[^\d]*(\d+)/)
  const reviewCount = num(/需人工[^\d]*(\d+)/)
  const newTypes = num(/新增类型[^\d]*(\d+)/)
  const errors = num(/错误[^\d]*(\d+)/)

  // 找出所有报错条目
  const errorLines: string[] = []
  for (const line of full.split('\n')) {
    if (/(error|Error|失败|失败:)/.test(line) && !/^\s*\[/.test(line)) {
      errorLines.push(line.trim())
    }
  }

  return {
    path: sampleDir,
    sourceValid: true,
    outputValid: errors === 0,
    changed: modified > 0,
    reviewCount,
    bytes: 0,
    lines: 0,
    _rawReport: full,
    _errors: errorLines.slice(0, 20),
  }
}

/** 主入口：跑一个 sample + 出 metrics */
export async function compareOneSample(
  samplePath: string,
  workDir: string,
  opts: { timeoutMs?: number } = {},
): Promise<SampleComparison> {
  const startedAt = Date.now()
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000
  const absSample = resolve(samplePath)
  const absWork = resolve(workDir)

  // 准备目录
  const ourDir = join(absWork, 'our')
  const officialDir = join(absWork, 'official')
  await rm(absWork, { recursive: true, force: true })
  await mkdir(absWork, { recursive: true })

  // 先复制两份（避免任何一边污染另一边）
  let copied = 0
  try {
    copied = await copySample(absSample, ourDir)
    await copySample(absSample, officialDir)
  } catch (e: any) {
    return {
      samplePath: absSample,
      ourRun: { ok: false, metrics: { path: absSample, _rawReport: '', _errors: [] } as any },
      officialRun: { ok: false, metrics: { modified: 0, reviewCount: 0, totalFiles: 0 } },
      comparison: emptyMetrics(),
      durationMs: Date.now() - startedAt,
      error: `failed to copy sample: ${e.message}`,
    }
  }

  // 并行跑两边（节省时间）
  const ourPromise = runOurPipeline(ourDir, ourDir + '.out', timeoutMs)
    .then(async (r) => {
      const m = parseOurReport(r.stdout, r.stderr, absSample, ourDir + '.out')
      return { ...r, metrics: m }
    })

  const officialPromise = runOfficialCodemod(absSample, officialDir, { timeoutMs })
    .catch((e): any => ({
      ok: false,
      fileOutputs: new Map(),
      errors: [{ path: '(global)', error: e.message }],
      totalFiles: copied,
      modified: 0,
      reviewCount: 0,
      packageName: '',
      skippedReason: `exception: ${e.message}`,
    }))

  // 等两边
  const [ourRes, offRes] = await Promise.all([ourPromise, officialPromise])

  // 读取两边的最终输出
  // 我们的：ourDir.out/（因为 --only-changed，只含改过的文件）
  // 官方的：officialDir/（被 in-place 改了）
  // 为了公平对比，我们要把"未改"的文件也补到 our 端（用原始 sample 补）
  const ourFinalDir = ourDir + '.out'
  const ourOutputs = await readAllFiles(ourFinalDir)
  // 把 sample 里 our 没改的文件补回去
  const sampleAll = await readAllFiles(ourDir)
  for (const [k, v] of sampleAll) {
    if (!ourOutputs.has(k)) ourOutputs.set(k, v)
  }
  const offOutputs = offRes.fileOutputs

  // 算 comparison
  const comparison = await compareOutputs(ourOutputs, offOutputs)
  // 覆盖 review 字段
  comparison.reviewCount = ourRes.metrics.reviewCount ?? 0
  comparison.officialReviewCount = offRes.reviewCount ?? 0
  comparison.reviewDelta = comparison.reviewCount - comparison.officialReviewCount

  return {
    samplePath: absSample,
    ourRun: {
      ok: ourRes.ok,
      metrics: ourRes.metrics,
    },
    officialRun: {
      ok: offRes.ok,
      metrics: {
        modified: offRes.modified,
        reviewCount: offRes.reviewCount,
        totalFiles: offRes.totalFiles,
        ...(offRes.skippedReason ? { skippedReason: offRes.skippedReason } : {}),
      },
    },
    comparison,
    durationMs: Date.now() - startedAt,
  }
}

function emptyMetrics(): ComparisonMetrics {
  return {
    compileOk: 0,
    astEquivalent: 0,
    reviewCount: 0,
    officialReviewCount: 0,
    reviewDelta: 0,
    semanticDiff: 0,
    runtimeSafe: 0,
    details: {
      totalFiles: 0,
      filesInBoth: 0,
      filesOnlyInOurs: 0,
      filesOnlyInOfficial: 0,
      parseFailed: { ours: [], official: [] },
    },
  }
}

/** 跑一个目录下所有子目录作为样本 */
export async function compareAllSamples(
  samplesDir: string,
  workDir: string,
  opts: { timeoutMs?: number } = {},
): Promise<SampleComparison[]> {
  const abs = resolve(samplesDir)
  const entries = await readdir(abs, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory())
  const out: SampleComparison[] = []
  for (const d of dirs) {
    const samplePath = join(abs, d.name)
    const r = await compareOneSample(samplePath, join(workDir, d.name), opts)
    out.push(r)
  }
  return out
}
