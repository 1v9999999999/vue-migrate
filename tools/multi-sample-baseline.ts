/**
 * tools/multi-sample-baseline.ts
 *
 * 对 samples/INDEX.json 里所有 sample 跑 baseline-comparator，
 * 合并成 multi-sample baseline，写到 baselines/iter-001/multi-sample.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const TSX = join(ROOT, 'tools', 'baseline-comparator', 'node_modules', '.bin', 'tsx.cmd')
const BASELINE_CLI = join(ROOT, 'tools', 'baseline-comparator', 'src', 'index.ts')

interface SampleEntry {
  org: string
  repo: string
  shortSha: string
  localPath: string
  stars: number
  size: string
  framework: string
  state: string
  router: boolean
  typescript: boolean
  fileCount: number
  vueFileCount: number
  collectedAt: string
}

interface Index {
  entries: SampleEntry[]
}

interface Comparison {
  ourRun: { ok: boolean; metrics: { reviewCount: number; changed: boolean; outputValid: boolean } }
  officialRun: { ok: boolean; metrics: { modified: number; reviewCount: number; totalFiles: number } }
  comparison: {
    compileOk: number
    astEquivalent: number
    reviewDelta: number
    semanticDiff: number
    runtimeSafe: number
  }
  durationMs: number
}

async function main() {
  const idxPath = join(ROOT, 'samples', 'INDEX.json')
  const index: Index = JSON.parse(await readFile(idxPath, 'utf8'))
  console.log(`[multi] found ${index.entries.length} samples`)

  const outDir = join(ROOT, 'baselines', process.env.ITER_ID || 'iter-001', 'multi-sample')
  await mkdir(outDir, { recursive: true })

  const results: Array<{
    sample: SampleEntry
    comparison: Comparison
  }> = []

  for (const entry of index.entries) {
    const workDir = join(outDir, 'work-' + entry.repo)
    console.log(`\n[multi] ===== ${entry.repo} =====`)
    console.log(`[multi]   sample: ${entry.localPath}`)
    console.log(`[multi]   work:   ${workDir}`)

    // 跑 baseline-comparator，--json 输出 json
    const res = spawnSync(
      'cmd.exe',
      ['/c', TSX, BASELINE_CLI, 'run', '--sample', entry.localPath, '--work', workDir, '--json'],
      { encoding: 'utf8', cwd: ROOT, windowsHide: true },
    )
    if (res.status !== 0) {
      console.error(`[multi]   ❌ exit code ${res.status}`)
      console.error(`[multi]   stderr: ${res.stderr.slice(0, 300)}`)
      continue
    }
    // 输出末尾 JSON
    const jsonStart = res.stdout.lastIndexOf('JSON:')
    const jsonStr = jsonStart >= 0 ? res.stdout.slice(jsonStart + 5) : res.stdout
    let parsed: Comparison
    try {
      parsed = JSON.parse(jsonStr.trim())
    } catch (e) {
      console.error(`[multi]   ❌ JSON parse failed: ${e}`)
      continue
    }
    results.push({ sample: entry, comparison: parsed })
    console.log(
      `[multi]   ✓ compileOk=${parsed.comparison.compileOk.toFixed(3)} ast=${parsed.comparison.astEquivalent.toFixed(3)} sem=${parsed.comparison.semanticDiff.toFixed(3)} rt=${parsed.comparison.runtimeSafe.toFixed(3)} rev=${parsed.comparison.reviewDelta}`,
    )
  }

  // 汇总
  const summary = {
    totalSamples: results.length,
    samples: results,
    aggregate: {
      avgCompileOk: avg(results.map((r) => r.comparison.comparison.compileOk)),
      avgAstEquivalent: avg(results.map((r) => r.comparison.comparison.astEquivalent)),
      avgSemanticDiff: avg(results.map((r) => r.comparison.comparison.semanticDiff)),
      avgRuntimeSafe: avg(results.map((r) => r.comparison.comparison.runtimeSafe)),
      totalReviewDelta: results.reduce((s, r) => s + r.comparison.comparison.reviewDelta, 0),
      totalFiles: results.reduce(
        (s, r) => s + (r.comparison.officialRun.metrics.totalFiles || 0),
        0,
      ),
    },
  }

  const summaryPath = join(outDir, 'summary.json')
  await writeFile(summaryPath, JSON.stringify(summary, null, 2))
  console.log(`\n[multi] ✓ wrote ${summaryPath}`)
  console.log(`\n[multi] Aggregate:`)
  console.log(`  avgCompileOk:      ${summary.aggregate.avgCompileOk.toFixed(3)}`)
  console.log(`  avgAstEquivalent:  ${summary.aggregate.avgAstEquivalent.toFixed(3)}`)
  console.log(`  avgSemanticDiff:   ${summary.aggregate.avgSemanticDiff.toFixed(3)}`)
  console.log(`  avgRuntimeSafe:    ${summary.aggregate.avgRuntimeSafe.toFixed(3)}`)
  console.log(`  totalReviewDelta:  ${summary.aggregate.totalReviewDelta}`)
  console.log(`  totalFiles:        ${summary.aggregate.totalFiles}`)
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
