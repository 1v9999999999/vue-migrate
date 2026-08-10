/**
 * runner.ts
 *
 * 跑整套 golden set, 聚合结果, 检测 regression.
 *   - matches: 本轮 hash 与 expected 相同
 *   - regressions: 上次通过 (matches=true) 但这次不通过
 *   - improvements: 上次不通过但这次通过
 *   - unchanged: 两次都不通过
 *   - newPassRate = matches / total
 *   - passRate    = (matches + 上一轮已通过的) / total
 *                  其中"上一轮已通过的"取 prev suite 中 matches=true 的文件
 *                  但只在 current 中也实际跑了(防止 scheduler 跳过某些文件)
 *
 * 当 newPassRate 相对 prev 的 newPassRate 下降 > 5% 时, 抛 RegressionError.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { performance } from 'node:perf_hooks'

import type { GoldenManifest, GoldenFile } from './select-golden.js'
import { compareFile, type FileComparison } from './compare.js'

export interface SuiteResult {
  total: number
  matches: number
  regressions: number
  improvements: number
  unchanged: number
  durationMs: number
  perFile: FileComparison[]
  newPassRate: number        // matches / total
  passRate: number           // (matches + 上一轮已通过的) / total
  /** baseline manifest 的元信息 */
  manifest: {
    version: number
    createdAt: string
  }
  /** prev 对比基线信息(若有) */
  prev?: {
    newPassRate: number
    passRate: number
  }
}

export class RegressionError extends Error {
  readonly metric: {
    from: number
    to: number
    delta: number
  }
  readonly regressions: number
  readonly improvements: number
  readonly failedFiles: string[]

  constructor(
    message: string,
    metric: { from: number; to: number; delta: number },
    regressions: number,
    improvements: number,
    failedFiles: string[],
  ) {
    super(message)
    this.name = 'RegressionError'
    this.metric = metric
    this.regressions = regressions
    this.improvements = improvements
    this.failedFiles = failedFiles
  }
}

export interface RunSuiteOptions {
  /** 仓库根, 用于解析 baselines/golden/ 和 packages/cli/ */
  repoRoot: string
  /** 是否并行(默认 false, 顺序跑避免磁盘抖动) */
  parallel?: boolean
  /** 进度日志 */
  log?: (s: string) => void
  /** pass-rate 下降阈值, 默认 0.05 */
  regressionThreshold?: number
}

/** 上一轮 suite 的输出文件结构 */
interface PrevSuite {
  total: number
  matches: number
  newPassRate: number
  passRate: number
  perFile: Array<{ path: string; matches: boolean }>
}

async function loadPrev(prevResultPath: string | undefined): Promise<PrevSuite | null> {
  if (!prevResultPath) return null
  try {
    const raw = await readFile(prevResultPath, 'utf-8')
    return JSON.parse(raw) as PrevSuite
  } catch (e: any) {
    return null
  }
}

export async function runSuite(
  goldenPath: string,
  _outputDir: string,
  prevResultPath: string | undefined,
  opts: RunSuiteOptions,
): Promise<SuiteResult> {
  const log = opts.log ?? (() => {})
  const start = performance.now()

  // 1. 加载 manifest
  const manifestRaw = await readFile(goldenPath, 'utf-8')
  const manifest = JSON.parse(manifestRaw) as GoldenManifest
  log(`[runner] manifest version=${manifest.version} createdAt=${manifest.createdAt} files=${manifest.files.length}`)

  // 2. 加载 prev
  const prev = await loadPrev(prevResultPath)
  if (prev) {
    log(`[runner] prev newPassRate=${prev.newPassRate.toFixed(3)} passRate=${prev.passRate.toFixed(3)}`)
  } else {
    log(`[runner] no prev result`)
  }

  // 3. 顺序跑每个文件
  const perFile: FileComparison[] = []
  for (let i = 0; i < manifest.files.length; i++) {
    const f = manifest.files[i]
    const idx = `${i + 1}/${manifest.files.length}`
    log(`[runner] [${idx}] ${f.path}`)
    try {
      const r = await compareFile(f, {
        repoRoot: opts.repoRoot,
        log: () => {},
      })
      perFile.push(r)
      const tag = r.hasError ? 'ERR' : r.matches ? 'OK' : 'DIFF'
      log(`  [${idx}] ${tag} hash=${r.actualHash.slice(0, 10)}...${r.error ? ` (${r.error.slice(0, 80)})` : ''}`)
    } catch (e: any) {
      perFile.push({
        path: f.path,
        expectedHash: f.expectedHash,
        actualHash: '',
        matches: false,
        hasError: true,
        reviewCount: 0,
        error: e.message,
        durationMs: 0,
      })
      log(`  [${idx}] exception: ${e.message}`)
    }
  }

  const total = manifest.files.length
  const matches = perFile.filter(p => p.matches).length
  const newPassRate = total > 0 ? matches / total : 0

  // 4. 与 prev 对比算 regression / improvement / unchanged (纯函数)
  const diff = diffAgainstPrev(perFile, prev)
  const { regressions, improvements, unchanged, failedFiles } = diff

  // passRate = (matches + 上一轮已通过的) / total
  // 但只在 current 中也实际跑了(防止 missing 文件算分)
  let passRate = newPassRate
  if (prev) {
    const prevPassed = prev.perFile.filter(p => p.matches).length
    // matches 已经是 current 中通过的; 加 prev 中通过但当前未跑(没有意义, 跳过)
    // 简化: passRate = newPassRate(在没有文件差异时一致)
    passRate = newPassRate
    void prevPassed  // 暂时不双计数, 以避免语义混乱
  }

  const durationMs = performance.now() - start

  const result: SuiteResult = {
    total,
    matches,
    regressions,
    improvements,
    unchanged,
    durationMs,
    perFile,
    newPassRate,
    passRate,
    manifest: { version: manifest.version, createdAt: manifest.createdAt },
    prev: prev ? { newPassRate: prev.newPassRate, passRate: prev.passRate } : undefined,
  }

  // 5. regression detection (纯函数)
  if (prev) {
    const threshold = opts.regressionThreshold ?? 0.05
    const err = checkRegressionThreshold(prev.newPassRate, newPassRate, {
      regressions,
      improvements,
      unchanged,
      failedFiles,
      threshold,
    })
    if (err) throw err
  }

  return result
}

/** 持久化 suite 结果 */
export async function saveSuiteResult(
  result: SuiteResult,
  outputPath: string,
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8')
}

// ──────────────── 纯函数 (供单测) ────────────────

/**
 * 对比当前与上一轮结果, 计算 regressions / improvements / unchanged.
 * pure function, 无 IO, 便于单测.
 */
export function diffAgainstPrev(
  current: FileComparison[],
  prev: PrevSuite | null,
): {
  regressions: number
  improvements: number
  unchanged: number
  failedFiles: string[]
} {
  let regressions = 0
  let improvements = 0
  let unchanged = 0
  const failedFiles: string[] = []

  if (!prev) {
    for (const cur of current) {
      if (!cur.matches) {
        regressions++
        failedFiles.push(cur.path)
      }
    }
    return { regressions, improvements, unchanged, failedFiles }
  }

  const prevMap = new Map<string, boolean>()
  for (const p of prev.perFile) prevMap.set(p.path, p.matches)

  for (const cur of current) {
    const wasMatch = prevMap.get(cur.path)
    if (wasMatch === undefined) {
      // 新文件: 通过 → improvement, 失败 → regression
      if (cur.matches) improvements++
      else { regressions++; failedFiles.push(cur.path) }
      continue
    }
    if (wasMatch && !cur.matches) {
      regressions++
      failedFiles.push(cur.path)
    } else if (!wasMatch && cur.matches) {
      improvements++
    } else if (!wasMatch && !cur.matches) {
      unchanged++
    }
  }

  return { regressions, improvements, unchanged, failedFiles }
}

/**
 * 阈值检查: prev - current > threshold 时返回 RegressionError, 否则 null.
 */
export function checkRegressionThreshold(
  prevPassRate: number,
  currentPassRate: number,
  ctx: {
    regressions: number
    improvements: number
    unchanged: number
    failedFiles: string[]
    threshold: number
  },
): RegressionError | null {
  const delta = prevPassRate - currentPassRate
  if (delta > ctx.threshold) {
    const msg = `Regression detected: passRate dropped ${(delta * 100).toFixed(2)}% ` +
                `(from ${(prevPassRate * 100).toFixed(2)}% to ${(currentPassRate * 100).toFixed(2)}%, ` +
                `threshold=${(ctx.threshold * 100).toFixed(1)}%). ` +
                `regressions=${ctx.regressions} improvements=${ctx.improvements} unchanged=${ctx.unchanged}. ` +
                `Failed: ${ctx.failedFiles.slice(0, 5).join(', ')}${ctx.failedFiles.length > 5 ? ` (+${ctx.failedFiles.length - 5} more)` : ''}`
    return new RegressionError(
      msg,
      { from: prevPassRate, to: currentPassRate, delta },
      ctx.regressions,
      ctx.improvements,
      ctx.failedFiles,
    )
  }
  return null
}
