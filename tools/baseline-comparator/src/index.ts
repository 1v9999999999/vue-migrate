#!/usr/bin/env node
/**
 * tools/baseline-comparator/src/index.ts
 *
 * CLI 入口：
 *   install               安装官方 codemod（@vue/codemod，fallback 到 vue-codemod）
 *   run --sample <path>   跑一个 sample 对比
 *   run-all --samples <dir>  跑一个目录下所有 sample
 *   help / --help         显示帮助
 *
 * 用法：
 *   tsx tools/baseline-comparator/src/index.ts install
 *   tsx tools/baseline-comparator/src/index.ts run --sample examples/vue2-manage-master/src
 *   tsx tools/baseline-comparator/src/index.ts run-all --samples examples
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareOneSample, compareAllSamples, type SampleComparison } from './runner.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL_DIR = resolve(HERE, '..')
const VUE_MIGRATE_ROOT = resolve(TOOL_DIR, '..', '..')

const HELP = `
vue-migrate / baseline-comparator

用法：
  tsx tools/baseline-comparator/src/index.ts <command> [options]

命令：
  install
    安装官方 codemod。优先尝试 @vue/codemod（按 task 描述），
    失败则 fallback 到 vue-codemod（Vue 团队实际发布的 npm 包）。

  run --sample <path> [--work <dir>]
    跑单个 sample。返回与官方 codemod 的对比数据。
    --work 默认 baselines/test-work

  run-all --samples <dir> [--work <dir>]
    跑一个目录下所有子目录作为 sample。
    --work 默认 baselines/run-all

  help
    显示本帮助。

输出：
  每个 run 会打印一份结构化报告（JSON 格式到 stdout 末尾，文字总结到前面）。
`

interface ParsedArgs {
  command: string
  sample?: string
  samples?: string
  work?: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { command: '' }
  if (argv.length === 0) return out
  out.command = argv[0]
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--sample') { out.sample = argv[++i]; continue }
    if (a === '--samples') { out.samples = argv[++i]; continue }
    if (a === '--work') { out.work = argv[++i]; continue }
    if (a === '--help' || a === '-h') { out.command = 'help'; continue }
  }
  return out
}

function showHelp(): void {
  console.log(HELP)
}

/** 运行 npm install --prefix <dir> <pkg>，返回 {ok, stdout, stderr} */
function npmInstall(pkg: string, prefix: string): Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolveP) => {
    const child = spawn('npm', ['install', '--prefix', prefix, '--no-audit', '--no-fund', '--loglevel=error', pkg], {
      shell: process.platform === 'win32',
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })
    child.on('close', (code) => {
      resolveP({ ok: code === 0, stdout, stderr, code })
    })
    child.on('error', (e) => {
      resolveP({ ok: false, stdout, stderr: stderr + `\nspawn error: ${e.message}`, code: -1 })
    })
  })
}

async function cmdInstall(): Promise<void> {
  console.log('▶ 安装官方 codemod\n')
  console.log(`  prefix: ${TOOL_DIR}\n`)

  // 任务里写的是 @vue/codemod（这个包在 npm 上不存在 —— Vue 团队实际发布的是 vue-codemod）
  // 先按任务字面意思试一次
  const candidatePkgs = ['@vue/codemod', 'vue-codemod']
  const tried: Array<{ pkg: string; ok: boolean; snippet: string }> = []

  for (const pkg of candidatePkgs) {
    console.log(`  尝试: npm install ${pkg}`)
    const r = await npmInstall(pkg, TOOL_DIR)
    const snippet = (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')
    tried.push({ pkg, ok: r.ok, snippet })
    if (r.ok) {
      console.log(`  ✅ ${pkg} 安装成功\n`)
      // 把成功的包名记到 package.json 的 comment 里？先存到一个 marker 文件
      writeFileSync(join(TOOL_DIR, '.official-codemod-installed'), pkg, 'utf-8')
      console.log(`  标记文件: ${TOOL_DIR}\\.official-codemod-installed`)
      return
    } else {
      console.log(`  ❌ ${pkg} 失败: ${snippet}`)
    }
  }

  console.log('\n  所有候选包都安装失败。baseline-comparator 仍可工作（会跳过官方 codemod 跑分）。')
  writeFileSync(join(TOOL_DIR, '.official-codemod-installed'), 'NONE', 'utf-8')
}

function printComparisonReport(c: SampleComparison): void {
  console.log()
  console.log('━'.repeat(72))
  console.log(`  Sample: ${c.samplePath}`)
  console.log(`  耗时:   ${(c.durationMs / 1000).toFixed(1)}s`)
  console.log('━'.repeat(72))
  console.log()
  console.log('  我们的运行（vue-migrate）:')
  console.log(`    ok:            ${c.ourRun.ok ? '✅' : '❌'}`)
  const om = c.ourRun.metrics as any
  console.log(`    reviewCount:   ${om.reviewCount ?? 'n/a'}`)
  console.log(`    changed:       ${om.changed ?? 'n/a'}`)
  console.log(`    outputValid:   ${om.outputValid ?? 'n/a'}`)
  if (om._errors && om._errors.length > 0) {
    console.log(`    errors:        ${om._errors.length} 条（最多列 5 条）`)
    for (const e of om._errors.slice(0, 5)) console.log(`      - ${e}`)
  }
  console.log()
  console.log('  官方 codemod 运行:')
  console.log(`    ok:            ${c.officialRun.ok ? '✅' : '❌'}`)
  console.log(`    modified:      ${c.officialRun.metrics.modified}`)
  console.log(`    reviewCount:   ${c.officialRun.metrics.reviewCount}`)
  console.log(`    totalFiles:    ${c.officialRun.metrics.totalFiles}`)
  if (c.officialRun.metrics.skippedReason) {
    console.log(`    skippedReason: ${c.officialRun.metrics.skippedReason}`)
  }
  console.log()
  console.log('  对比指标 (0..1, 越高越好 / 越接近):')
  const m = c.comparison
  console.log(`    compileOk:       ${m.compileOk.toFixed(3)}     (双方都能 parse 的比例)`)
  console.log(`    astEquivalent:   ${m.astEquivalent.toFixed(3)}     (AST 结构 Jaccard)`)
  console.log(`    semanticDiff:    ${m.semanticDiff.toFixed(3)}     (Vue3 友好度)`)
  console.log(`    runtimeSafe:     ${m.runtimeSafe.toFixed(3)}     (import 路径合法率)`)
  console.log(`    reviewDelta:     ${m.reviewDelta}                (我方 - 官方，越低越好)`)
  console.log()
  console.log('  调试:')
  console.log(`    totalFiles:        ${m.details.totalFiles}`)
  console.log(`    filesInBoth:       ${m.details.filesInBoth}`)
  console.log(`    filesOnlyInOurs:   ${m.details.filesOnlyInOurs}`)
  console.log(`    filesOnlyInOff:    ${m.details.filesOnlyInOfficial}`)
  console.log(`    parseFailed.ours:  ${m.details.parseFailed.ours.length}`)
  console.log(`    parseFailed.off:   ${m.details.parseFailed.official.length}`)
  if (m.details.parseFailed.ours.length > 0) {
    console.log('      ours 失败样例:')
    for (const p of m.details.parseFailed.ours.slice(0, 5)) console.log(`        - ${p}`)
  }
  if (m.details.parseFailed.official.length > 0) {
    console.log('      official 失败样例:')
    for (const p of m.details.parseFailed.official.slice(0, 5)) console.log(`        - ${p}`)
  }
  console.log()
  if (c.error) {
    console.log(`  整体错误: ${c.error}`)
  }
  console.log('━'.repeat(72))
}

async function cmdRun(sample: string, work?: string): Promise<void> {
  if (!sample) {
    console.error('❌ --sample <path> 必填')
    process.exit(1)
  }
  const absSample = resolve(sample)
  if (!existsSync(absSample)) {
    console.error(`❌ sample 路径不存在: ${absSample}`)
    process.exit(1)
  }
  const workDir = work ? resolve(work) : resolve(VUE_MIGRATE_ROOT, 'baselines', 'test-work')
  console.log(`▶ run`)
  console.log(`  sample: ${absSample}`)
  console.log(`  work:   ${workDir}`)
  const r = await compareOneSample(absSample, workDir)
  printComparisonReport(r)
  console.log('\nJSON:')
  console.log(JSON.stringify(r, (_k, v) => {
    // 序列化 Map
    if (v instanceof Map) return Object.fromEntries(v)
    return v
  }, 2))
}

async function cmdRunAll(samples: string, work?: string): Promise<void> {
  if (!samples) {
    console.error('❌ --samples <dir> 必填')
    process.exit(1)
  }
  const absSamples = resolve(samples)
  if (!existsSync(absSamples)) {
    console.error(`❌ samples 目录不存在: ${absSamples}`)
    process.exit(1)
  }
  const workDir = work ? resolve(work) : resolve(VUE_MIGRATE_ROOT, 'baselines', 'run-all')
  console.log(`▶ run-all`)
  console.log(`  samples: ${absSamples}`)
  console.log(`  work:    ${workDir}`)
  const results = await compareAllSamples(absSamples, workDir)
  for (const r of results) printComparisonReport(r)
  console.log('\n=== 汇总 ===')
  console.log(`  样本数:    ${results.length}`)
  console.log(`  我们的平均 reviewCount: ${avg(results.map((r) => r.comparison.reviewCount)).toFixed(2)}`)
  console.log(`  官方平均 modified:      ${avg(results.map((r) => r.officialRun.metrics.modified)).toFixed(2)}`)
  console.log(`  平均 compileOk:         ${avg(results.map((r) => r.comparison.compileOk)).toFixed(3)}`)
  console.log(`  平均 astEquivalent:     ${avg(results.map((r) => r.comparison.astEquivalent)).toFixed(3)}`)
  console.log(`  平均 semanticDiff:      ${avg(results.map((r) => r.comparison.semanticDiff)).toFixed(3)}`)
  console.log(`  平均 runtimeSafe:       ${avg(results.map((r) => r.comparison.runtimeSafe)).toFixed(3)}`)
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (!args.command || args.command === 'help' || args.command === '--help' || args.command === '-h') {
    showHelp()
    return
  }
  try {
    if (args.command === 'install') {
      await cmdInstall()
    } else if (args.command === 'run') {
      await cmdRun(args.sample!, args.work)
    } else if (args.command === 'run-all') {
      await cmdRunAll(args.samples!, args.work)
    } else {
      console.error(`❌ 未知命令: ${args.command}`)
      console.log('运行 `tsx tools/baseline-comparator/src/index.ts help` 查看帮助。')
      process.exit(1)
    }
  } catch (e: any) {
    console.error(`\n❌ 顶层异常: ${e.message}`)
    if (e.stack) console.error(e.stack)
    process.exit(1)
  }
}

main()
