#!/usr/bin/env node
/**
 * tools/regression-suite/src/index.ts
 *
 * CLI 入口:
 *   select  选金标
 *   run     跑整套, 算 pass-rate
 *   report  从已存的结果出 pretty 报告
 */

import { resolve, dirname, join, relative } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, mkdir } from 'node:fs/promises'

import { selectGoldenSet, type GoldenManifest } from './select-golden.js'
import { runSuite, saveSuiteResult, RegressionError, type SuiteResult } from './runner.js'

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..', '..', '..')
// 上面的 dirname 是 .../tools/regression-suite/src, 向上 3 级到 repo root
// 在 Windows 上 import.meta.url 是 file:///D:/..., 需要去掉前导 /
const urlPath = new URL(import.meta.url).pathname
// 兼容: 直接用 process.argv[1] 所在目录更稳
const realRepoRoot = (() => {
  // 假设 cwd 是 repo root(从 npm scripts 跑是这样)
  // 优先 cwd, 然后尝试向上找 packages/cli
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'packages', 'cli', 'src', 'index.ts'))) return cwd
  // 否则用 import.meta.url 推断
  // path 在 Windows 上形如 /D:/Projects/.../tools/regression-suite/src/index.ts
  const cleaned = urlPath.replace(/^\//, '').replace(/^([A-Za-z]):/, '$1:')
  const srcDir = dirname(cleaned)
  return resolve(srcDir, '..', '..', '..')
})()

const log = (s: string) => console.log(s)

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        out[key] = true
      } else {
        out[key] = next
        i++
      }
    } else if (!out['_positional']) {
      out['_positional'] = a
    }
  }
  return out
}

async function cmdSelect(args: Record<string, string | boolean>) {
  const examples = (args['examples'] as string) ?? 'examples/'
  const out = (args['out'] as string) ?? 'baselines/golden.json'
  const target = parseInt((args['target'] as string) ?? '100', 10)
  const examplesAbs = resolve(realRepoRoot, examples)
  const outAbs = resolve(realRepoRoot, out)

  log(`[select] examples=${examplesAbs}`)
  log(`[select] out=${outAbs}`)
  log(`[select] target=${target}`)

  const manifest = await selectGoldenSet(examplesAbs, outAbs, target, {
    repoRoot: realRepoRoot,
    log,
  })

  log('')
  log('━'.repeat(64))
  log('  Golden Set Selected')
  log('━'.repeat(64))
  log(`  total files:    ${manifest.files.length}`)
  log(`  bucket:         small=${manifest.bucketStats.small} medium=${manifest.bucketStats.medium} large=${manifest.bucketStats.large}`)
  log(`  probe runs:     ${manifest.probeRuns}`)
  log(`  coverage tags:  ${Object.keys(manifest.tagStats).length}`)
  log('')
  log('  Top tags:')
  for (const [t, n] of Object.entries(manifest.tagStats).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    log(`    ${t.padEnd(20)} ${n}`)
  }
  log('━'.repeat(64))
}

async function cmdRun(args: Record<string, string | boolean>) {
  const golden = (args['golden'] as string) ?? 'baselines/golden.json'
  const work = (args['work'] as string) ?? 'work/'
  const prev = args['prev'] as string | undefined
  const goldenAbs = resolve(realRepoRoot, golden)
  const workAbs = resolve(realRepoRoot, work)
  const prevAbs = prev ? resolve(realRepoRoot, prev) : undefined
  const outFile = join(workAbs, 'suite-result.json')

  await mkdir(workAbs, { recursive: true })

  log(`[run] golden=${goldenAbs}`)
  log(`[run] work=${workAbs}`)
  log(`[run] prev=${prevAbs ?? '(none)'}`)

  try {
    const result = await runSuite(goldenAbs, workAbs, prevAbs, {
      repoRoot: realRepoRoot,
      log,
    })
    await saveSuiteResult(result, outFile)
    log('')
    log('━'.repeat(64))
    log('  Suite Complete')
    log('━'.repeat(64))
    log(`  total:        ${result.total}`)
    log(`  matches:      ${result.matches}  (${(result.newPassRate * 100).toFixed(2)}%)`)
    log(`  regressions:  ${result.regressions}`)
    log(`  improvements: ${result.improvements}`)
    log(`  unchanged:    ${result.unchanged}`)
    log(`  duration:     ${(result.durationMs / 1000).toFixed(1)}s`)
    log(`  output:       ${outFile}`)
    log('━'.repeat(64))
    printFailures(result, 20)
  } catch (e: any) {
    if (e instanceof RegressionError) {
      // 把结果也存下来(部分结果)
      const partialResult: SuiteResult = {
        total: 0, matches: 0, regressions: e.regressions, improvements: e.improvements,
        unchanged: 0, durationMs: 0, perFile: [], newPassRate: e.metric.to, passRate: e.metric.to,
        manifest: { version: 1, createdAt: new Date().toISOString() },
        prev: { newPassRate: e.metric.from, passRate: e.metric.from },
      }
      try {
        await saveSuiteResult(partialResult, outFile)
      } catch {}
      console.error('')
      console.error('━'.repeat(64))
      console.error('  ✗ REGRESSION DETECTED')
      console.error('━'.repeat(64))
      console.error(e.message)
      console.error('━'.repeat(64))
      process.exit(2)
    } else {
      console.error('[run] error:', e.message)
      console.error(e.stack)
      process.exit(1)
    }
  }
}

function printFailures(result: SuiteResult, limit: number) {
  const failed = result.perFile.filter(p => !p.matches)
  if (failed.length === 0) {
    log('')
    log('  ✓ all golden files match baseline')
    log('')
    return
  }
  log('')
  log(`  Failed files (${failed.length}, showing first ${limit}):`)
  for (const f of failed.slice(0, limit)) {
    const tag = f.hasError ? 'ERR ' : 'DIFF'
    log(`    [${tag}] ${f.path}`)
    if (f.error) {
      log(`           ${f.error.slice(0, 200)}`)
    } else {
      log(`           expected=${f.expectedHash.slice(0, 12)}  actual=${f.actualHash.slice(0, 12)}`)
    }
  }
  log('')
}

async function cmdReport(args: Record<string, string | boolean>) {
  const result = (args['result'] as string) ?? 'work/suite-result.json'
  const resultAbs = resolve(realRepoRoot, result)
  if (!existsSync(resultAbs)) {
    console.error(`[report] file not found: ${resultAbs}`)
    process.exit(1)
  }
  const raw = await readFile(resultAbs, 'utf-8')
  const data = JSON.parse(raw) as SuiteResult
  const pretty = !!args['pretty']

  log('')
  log('╔' + '═'.repeat(62) + '╗')
  log('║  Vue Migrate — Regression Suite Report' + ' '.repeat(22) + '║')
  log('╚' + '═'.repeat(62) + '╝')
  log('')
  log(`  manifest:  v${data.manifest?.version ?? '?'}  (created ${data.manifest?.createdAt ?? '?'})`)
  log(`  total:     ${data.total}`)
  log(`  matches:   ${data.matches}  → newPassRate = ${(data.newPassRate * 100).toFixed(2)}%`)
  log(`  passRate:  ${(data.passRate * 100).toFixed(2)}%`)
  log(`  regressions:  ${data.regressions}`)
  log(`  improvements: ${data.improvements}`)
  log(`  unchanged:    ${data.unchanged}`)
  log(`  duration:     ${(data.durationMs / 1000).toFixed(1)}s`)
  if (data.prev) {
    const delta = data.newPassRate - data.prev.newPassRate
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '='
    log(`  vs prev:   ${arrow} ${(delta * 100).toFixed(2)}pp (was ${(data.prev.newPassRate * 100).toFixed(2)}%)`)
  }
  log('')

  if (pretty || true) {
    printFailures(data, 50)
  }
}

const sub = process.argv[2]
const args = parseArgs(process.argv.slice(3))

;(async () => {
  try {
    if (sub === 'select') {
      await cmdSelect(args)
    } else if (sub === 'run') {
      await cmdRun(args)
    } else if (sub === 'report') {
      await cmdReport(args)
    } else {
      console.error('Usage:')
      console.error('  tsx tools/regression-suite/src/index.ts select --examples <dir> --out <json> --target <N>')
      console.error('  tsx tools/regression-suite/src/index.ts run --golden <json> [--work <dir>] [--prev <json>]')
      console.error('  tsx tools/regression-suite/src/index.ts report --result <json> [--pretty]')
      process.exit(1)
    }
  } catch (e: any) {
    console.error('[fatal]', e.message)
    console.error(e.stack)
    process.exit(1)
  }
})()
