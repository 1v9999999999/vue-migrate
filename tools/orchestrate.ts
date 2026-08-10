/**
 * tools/orchestrate.ts
 *
 * 单次迭代的主流程 orchestrator：
 * 1. 读取样本列表（来自 samples/INDEX.json）
 * 2. 对每个样本运行 vue-migrate transform
 * 3. 解析输出报告
 * 4. 计算每个文件的 metrics
 * 5. 与上一轮对比生成 delta
 * 6. 输出 iteration report 到 baselines/{date}/
 *
 * 用法：
 *   tsx tools/orchestrate.ts --input <sample-path-or-dir> [--output <report-dir>] [--id <iteration-id>]
 */

import { spawn } from 'node:child_process'
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, basename, resolve, dirname } from 'node:path'
import type {
  IterationReport,
  FileMetrics,
  SampleMetrics,
  IssueTicket,
} from './common/types.js'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..')

interface OrchestrateOptions {
  input: string
  output: string
  id: string
  compareWith?: string
  filterPath?: string
}

async function parseArgs(): Promise<OrchestrateOptions> {
  const args = process.argv.slice(2)
  const opts: Partial<OrchestrateOptions> = {
    id: new Date().toISOString().replace(/[:.]/g, '-').replace(/T/, '_').substring(0, 19),
    output: join(ROOT, 'baselines'),
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--input' && args[i + 1]) {
      opts.input = resolve(args[++i])
    } else if (arg === '--output' && args[i + 1]) {
      opts.output = resolve(args[++i])
    } else if (arg === '--id' && args[i + 1]) {
      opts.id = args[++i]
    } else if (arg === '--compare-with' && args[i + 1]) {
      opts.compareWith = resolve(args[++i])
    } else if (arg === '--filter' && args[i + 1]) {
      opts.filterPath = args[++i]
    }
  }
  if (!opts.input) {
    console.error('Usage: tsx tools/orchestrate.ts --input <sample> [--output <dir>] [--id <id>]')
    process.exit(1)
  }
  return opts as OrchestrateOptions
}

interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

function runVueMigrate(input: string, output: string): Promise<RunResult> {
  return new Promise((resolveP) => {
    // 直接调 tsx packages/cli/src/index.ts，绕过 pnpm run 的 arg forwarding 问题
    const tsxBin = join(ROOT, 'packages', 'cli', 'node_modules', '.bin', 'tsx.cmd')
    const cliEntry = join(ROOT, 'packages', 'cli', 'src', 'index.ts')
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'cmd.exe' : tsxBin
    const args = isWin
      ? ['/c', tsxBin, cliEntry, 'transform', input, '-o', output]
      : [cliEntry, 'transform', input, '-o', output]
    const child = spawn(cmd, args, {
      cwd: ROOT,
      env: { ...process.env, FORCE_COLOR: '0' },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (data) => (stdout += data.toString()))
    child.stderr?.on('data', (data) => (stderr += data.toString()))
    child.on('close', (code) => resolveP({ stdout, stderr, exitCode: code ?? 1 }))
    child.on('error', (e) => resolveP({ stdout, stderr: stderr + '\n' + e.message, exitCode: 1 }))
  })
}

/**
 * 解析 vue-migrate 输出报告，提取每个文件的 metrics
 */
function parseReport(stdout: string, stderr: string): {
  failures: Array<{ path: string; error: string }>
  reviewByFile: Map<string, number>
  errorByFile: Map<string, string>
  totalFiles: number
  modified: number
  reviewCount: number
  errors: number
} {
  const combined = stdout + stderr
  const failures: Array<{ path: string; error: string }> = []
  const reviewByFile = new Map<string, number>()
  const errorByFile = new Map<string, string>()

  // 解析 "总文件: N" "已修改: N" "需人工: N" "错误: N"
  let totalFiles = 0
  let modified = 0
  let reviewCount = 0
  let errors = 0
  for (const m of combined.matchAll(/总文件:\s*(\d+)|已修改:\s*(\d+)|需人工:\s*(\d+)|错误:\s*(\d+)/g)) {
    if (m[1]) totalFiles = parseInt(m[1])
    if (m[2]) modified = parseInt(m[2])
    if (m[3]) reviewCount = parseInt(m[3])
    if (m[4]) errors = parseInt(m[4])
  }

  // 解析 review 条目 "• <file> — <msg>"
  for (const m of combined.matchAll(/•\s+([\w./-]+)\s+—\s+(.+)/g)) {
    const file = m[1].trim()
    const msg = m[2].trim()
    if (!reviewByFile.has(file)) reviewByFile.set(file, 0)
    reviewByFile.set(file, reviewByFile.get(file)! + 1)
  }

  // 解析错误 "✗ <file>: <err>" 或 "<file> — Unexpected ..."
  for (const m of combined.matchAll(/✗\s+([\w./-]+):\s*(.+)/g)) {
    failures.push({ path: m[1].trim(), error: m[2].trim() })
    errorByFile.set(m[1].trim(), m[2].trim())
  }

  return { failures, reviewByFile, errorByFile, totalFiles, modified, reviewCount, errors }
}

/**
 * 列出样本的所有 .vue / .js / .ts 文件
 */
async function listSourceFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      files.push(...(await listSourceFiles(full)))
    } else if (/\.(vue|js|ts)$/.test(e.name)) {
      files.push(full)
    }
  }
  return files
}

async function main() {
  const opts = await parseArgs()
  const inputPath = opts.input
  const outputDir = join(opts.output, opts.id)
  await mkdir(outputDir, { recursive: true })

  console.log(`[orchestrate] input: ${inputPath}`)
  console.log(`[orchestrate] output: ${outputDir}`)
  console.log(`[orchestrate] id: ${opts.id}`)

  // 列源文件
  const sourceFiles = await listSourceFiles(inputPath)
  const filteredFiles = opts.filterPath
    ? sourceFiles.filter((f) => f.includes(opts.filterPath!))
    : sourceFiles
  console.log(`[orchestrate] source files: ${filteredFiles.length}`)

  // 跑 vue-migrate
  const t0 = Date.now()
  const result = await runVueMigrate(inputPath, outputDir)
  const dt = Date.now() - t0

  // 解析报告
  const parsed = parseReport(result.stdout, result.stderr)
  console.log(`[orchestrate] elapsed: ${dt}ms`)
  console.log(`[orchestrate] total: ${parsed.totalFiles}, modified: ${parsed.modified}, review: ${parsed.reviewCount}, errors: ${parsed.errors}`)

  // 给每个 source file 算 metrics
  const fileMetrics: FileMetrics[] = await Promise.all(
    filteredFiles.map(async (src) => {
      const rel = relative(inputPath, src)
      const s = await stat(src)
      const reviewCount = parsed.reviewByFile.get(rel) || 0
      const error = parsed.errorByFile.get(rel)
      return {
        path: rel,
        sourceValid: true,
        outputValid: !error,
        changed: parsed.reviewByFile.has(rel),
        reviewCount,
        error,
        bytes: s.size,
        lines: 0, // 可以后续算
      }
    }),
  )

  // 生成 Issue tickets（每个 error 一个）
  const tickets: IssueTicket[] = parsed.failures.map((f, i) => ({
    id: `issue-${opts.id}-${i}`,
    description: f.error,
    exampleFiles: [f.path],
    payload: { input: '', actualOutput: '', expectedOutput: '' },
    severity: 'blocker',
    type: 'syntax',
    status: 'open',
    createdAt: new Date().toISOString(),
    failedAttempts: 0,
  }))

  // 构造 report
  const report: IterationReport = {
    id: opts.id,
    startedAt: new Date(t0).toISOString(),
    finishedAt: new Date().toISOString(),
    state: 'done',
    stats: {
      totalSamples: 1,
      totalFiles: parsed.totalFiles,
      errors: parsed.errors,
      modified: parsed.modified,
      reviewCount: parsed.reviewCount,
      outputValid: parsed.totalFiles - parsed.errors,
    },
    failures: parsed.failures.map((f) => ({
      path: f.path,
      error: f.error,
      severity: 'blocker' as const,
      type: 'syntax' as const,
    })),
    agentTickets: tickets.map((t) => t.id),
  }

  // 如果有 --compare-with，加 delta
  if (opts.compareWith) {
    try {
      const prev = JSON.parse(await readFile(opts.compareWith, 'utf8'))
      if (prev.stats) {
        report.delta = {
          errors: report.stats.errors - prev.stats.errors,
          modified: report.stats.modified - prev.stats.modified,
          reviewCount: report.stats.reviewCount - prev.stats.reviewCount,
        }
      }
    } catch (e) {
      console.warn(`[orchestrate] could not load compareWith: ${e}`)
    }
  }

  // 写报告
  const reportPath = join(outputDir, 'report.json')
  await writeFile(reportPath, JSON.stringify(report, null, 2))
  const ticketsPath = join(outputDir, 'tickets.json')
  await writeFile(ticketsPath, JSON.stringify(tickets, null, 2))
  const metricsPath = join(outputDir, 'file-metrics.json')
  await writeFile(metricsPath, JSON.stringify(fileMetrics, null, 2))

  console.log(`[orchestrate] ✓ report: ${reportPath}`)
  console.log(`[orchestrate] ✓ tickets: ${ticketsPath}`)
  console.log(`[orchestrate] ✓ file-metrics: ${metricsPath}`)

  // 简短摘要
  if (report.delta) {
    const d = report.delta
    console.log(
      `[orchestrate] delta vs previous: errors ${d.errors >= 0 ? '+' : ''}${d.errors}, modified ${d.modified >= 0 ? '+' : ''}${d.modified}, review ${d.reviewCount >= 0 ? '+' : ''}${d.reviewCount}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
