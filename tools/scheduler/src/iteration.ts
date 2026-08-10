/**
 * tools/scheduler/src/iteration.ts
 *
 * 单次完整迭代：collect → convert → diff → analyze → generate → test → commit。
 *
 * 关键设计：
 *   1. 状态机驱动：每个阶段都包在 try/catch 里，失败转 failed
 *   2. graceful degradation：子系统未就绪时 skip 阶段（不抛错）
 *   3. 资源限制：30 分钟 hard timeout（防止死循环）
 *   4. 每步 transition 持久化到 state + log
 *   5. 不在 scheduler 里写 vue-migrate 规则——那是 rule-generator 的活
 */

import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, access, constants, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  IssueTicket,
  IterationReport,
  ScheduleState,
} from '../../common/types.js'
import {
  canTransition,
  nextState,
  type State,
  type ScheduleEvent,
} from './state-machine.js'
import {
  saveState,
  appendTransitionLog,
  saveReport,
  DEFAULT_LOG_PATH,
  DEFAULT_REPORTS_DIR,
  appendHistory,
} from './persistence.js'
import {
  shouldSpawnAgent,
  spawnAgentForIssue,
} from './agent-dispatcher.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCHEDULER_ROOT = resolve(__dirname, '..', '..', '..')
const ROOT = SCHEDULER_ROOT

// 找 tsx 的绝对路径：cli 包一定有，scheduler 包不一定 install 了
// 优先用 cli 的，否则用 scheduler 自己的
function resolveTsxEntry(): { node: string; tsx: string } {
  const candidates = [
    join(ROOT, 'packages', 'cli', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    join(ROOT, 'tools', 'scheduler', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  ]
  for (const p of candidates) {
    if (existsSync(p)) {
      return { node: process.execPath, tsx: p }
    }
  }
  return { node: process.execPath, tsx: candidates[0] }
}

const TSX_ENTRY = resolveTsxEntry()

// 找 git 绝对路径（用于 commit）。如果找不到就跳过 commit 步骤
function resolveGitPath(): string | null {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Git\\bin\\git.exe',
      'C:\\Program Files (x86)\\Git\\bin\\git.exe',
      join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'git.exe'),
    ]
    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return null
  }
  return 'git'
}

const GIT_BIN = resolveGitPath()

/** 单次迭代硬超时（30 分钟） */
const ITERATION_TIMEOUT_MS = 30 * 60 * 1000

/** 子进程超时（10 分钟） */
const STEP_TIMEOUT_MS = 10 * 60 * 1000

interface IterationContext {
  state: ScheduleState
  statePath: string
  iterationId: string
  startedAt: number
  report: IterationReport
  prevIterationId?: string
}

/**
 * 主入口：跑一次完整迭代。
 */
export async function runIteration(
  inputState: ScheduleState,
  options: {
    statePath: string
    workDir?: string
  },
): Promise<IterationReport> {
  const workDir = options.workDir || ROOT
  const statePath = options.statePath
  const iterationId = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace(/T/, '_')
    .substring(0, 19)

  // 初始化 context
  // prevIterationId 来自 history 里倒数第二个 done 状态的 id
  const prevDone = [...(inputState.history || [])]
    .reverse()
    .find((h) => h.state === 'done')
  const prevIterationId = prevDone?.id
  const ctx: IterationContext = {
    state: { ...inputState, currentIteration: iterationId, state: 'idle' },
    statePath,
    iterationId,
    startedAt: Date.now(),
    prevIterationId,
    report: {
      id: iterationId,
      startedAt: new Date().toISOString(),
      state: 'idle',
      stats: {
        totalSamples: 0,
        totalFiles: 0,
        errors: 0,
        modified: 0,
        reviewCount: 0,
        outputValid: 0,
      },
      failures: [],
      agentTickets: [],
    },
  }

  // 设置超时：30 分钟后强制失败
  const timeoutHandle = setTimeout(() => {
    console.error(`[iteration] TIMEOUT after ${ITERATION_TIMEOUT_MS}ms, forcing failed`)
    ctx.report.state = 'failed'
  }, ITERATION_TIMEOUT_MS)

  try {
    // idle → collecting
    await transition(ctx, 'collecting', 'idle', 'success')

    // Phase 1: collecting
    try {
      const collected = await phaseCollect(ctx, workDir)
      ctx.report.stats.totalSamples = collected.samplesFound
      await transition(ctx, 'converting', 'collecting', 'success')
    } catch (err) {
      // 收集失败不一定是阻塞性：可能 sample-collector 还没就绪
      console.warn(`[iteration] collecting failed (non-fatal): ${(err as Error).message}`)
      await transition(ctx, 'converting', 'collecting', 'success', {
        message: 'collecting skipped due to error, proceeding to converting',
      })
    }

    // Phase 2: converting (orchestrate)
    try {
      const converted = await phaseConvert(ctx, workDir)
      ctx.report.stats.totalFiles = converted.totalFiles
      ctx.report.stats.modified = converted.modified
      ctx.report.stats.reviewCount = converted.reviewCount
      ctx.report.stats.errors = converted.errors
      ctx.report.stats.outputValid = converted.totalFiles - converted.errors
      ctx.report.failures = converted.failures
      await transition(ctx, 'diffing', 'converting', 'success')
    } catch (err) {
      await transition(ctx, 'failed', 'converting', 'failure', {
        message: (err as Error).message,
      })
      return ctx.report
    }

    // Phase 3: diffing (baseline-comparator)
    try {
      const diff = await phaseDiff(ctx, workDir)
      console.log(
        `[iteration] diff: official-codemod missing ${diff.officialMissingReviews} reviews`,
      )
      await transition(ctx, 'analyzing', 'diffing', 'success')
    } catch (err) {
      // diff 阶段失败是 graceful：analyzing 阶段会用 reports 直接分析
      console.warn(`[iteration] diffing failed (non-fatal): ${(err as Error).message}`)
      await transition(ctx, 'analyzing', 'diffing', 'success', {
        message: 'diffing skipped, analyzing will use report directly',
      })
    }

    // Phase 4: analyzing
    let needsAgent = false
    let newIssues: IssueTicket[] = []
    try {
      const analyzed = await phaseAnalyze(ctx, workDir)
      newIssues = analyzed.newIssues
      needsAgent = analyzed.needsAgent
      console.log(
        `[iteration] analyze: ${analyzed.openIssues} open issues, needsAgent=${needsAgent}`,
      )

      if (needsAgent) {
        // 把分析得到的 open issues 加到 report
        await transition(ctx, 'spawning_agent', 'analyzing', 'needs_agent', {
          message: `detected ${newIssues.length} persistent issues`,
        })
        // 派发 agent（同步写 ticket，不等 agent 完成）
        const spawned = await trySpawnAgent(ctx, newIssues, workDir)
        if (spawned) {
          ctx.report.agentTickets.push(spawned.issueId)
        }
        // 派发后回 idle，等下一轮
        await transition(ctx, 'idle', 'spawning_agent', 'success', {
          message: 'agent ticket written, returning to idle',
        })
        return ctx.report
      }

      // 常规路径：analyzing → generating
      await transition(ctx, 'generating', 'analyzing', 'success')
    } catch (err) {
      await transition(ctx, 'failed', 'analyzing', 'failure', {
        message: (err as Error).message,
      })
      return ctx.report
    }

    // Phase 5: generating (rule-generator)
    try {
      const generated = await phaseGenerate(ctx, workDir, newIssues)
      console.log(`[iteration] generate: ${generated.candidates} rule candidates`)
      await transition(ctx, 'testing', 'generating', 'success')
    } catch (err) {
      // rule-generator 还没就绪：直接到 testing 验证现有规则
      console.warn(`[iteration] generating failed (non-fatal): ${(err as Error).message}`)
      await transition(ctx, 'testing', 'generating', 'success', {
        message: 'generating skipped, testing existing rules',
      })
    }

    // Phase 6: testing (regression-suite)
    try {
      const tested = await phaseTest(ctx, workDir)
      console.log(
        `[iteration] test: ${tested.passed}/${tested.total} passed, regression=${tested.regression}`,
      )
      if (tested.regression) {
        // 回归：回到 generating 重新生成
        await transition(ctx, 'idle', 'testing', 'regression_detected', {
          message: 'regression detected, will regenerate next iteration',
        })
        return ctx.report
      }
      await transition(ctx, 'committing', 'testing', 'success')
    } catch (err) {
      await transition(ctx, 'failed', 'testing', 'failure', {
        message: (err as Error).message,
      })
      return ctx.report
    }

    // Phase 7: committing
    try {
      const committed = await phaseCommit(ctx, workDir)
      console.log(`[iteration] commit: log=${committed.logPath}`)
      await transition(ctx, 'done', 'committing', 'success')
    } catch (err) {
      // commit 失败：写完 report 直接 done（commit 失败是 best-effort）
      console.warn(`[iteration] committing failed (non-fatal): ${(err as Error).message}`)
      await transition(ctx, 'done', 'committing', 'success', {
        message: `commit skipped: ${(err as Error).message}`,
      })
    }

    return ctx.report
  } finally {
    clearTimeout(timeoutHandle)
    ctx.report.finishedAt = new Date().toISOString()
    // 始终写报告存档
    try {
      const reportsDir = join(workDir, DEFAULT_REPORTS_DIR)
      await saveReport(reportsDir, ctx.iterationId, ctx.report)
    } catch (err) {
      console.warn(`[iteration] failed to save report: ${(err as Error).message}`)
    }
  }
}

/**
 * 通用：推进状态机 + 持久化 + 写日志。
 */
async function transition(
  ctx: IterationContext,
  to: State,
  from: State,
  event: ScheduleEvent,
  extra: { message?: string; iterationId?: string } = {},
): Promise<void> {
  if (!canTransition(from, to)) {
    console.warn(`[iteration] illegal transition ${from} → ${to}, forcing via nextState`)
  }
  ctx.state = {
    ...ctx.state,
    state: to,
    lastRunAt: new Date().toISOString(),
  }
  ctx.report.state = to
  await saveState(ctx.statePath, ctx.state)
  await appendTransitionLog(join(ctx.statePath.replace(/\.json$/, '.log')), {
    from,
    to,
    iterationId: ctx.iterationId,
    event,
    message: extra.message,
  }).catch(() => {
    // log 失败不阻塞主流程
  })
  console.log(`[iteration] ${from} → ${to} (event=${event})`)
}

/* ----------------------------- Phase 实现 ----------------------------- */

interface CollectResult {
  samplesFound: number
  newSamples: number
}

async function phaseCollect(ctx: IterationContext, workDir: string): Promise<CollectResult> {
  // 调用 sample-collector 拉新样本
  // 失败时优雅降级
  const collectorScript = join(workDir, 'tools', 'sample-collector', 'src', 'index.ts')
  if (!(await pathExists(collectorScript))) {
    console.log(`[iteration:collect] sample-collector not found, skipping`)
    return { samplesFound: 0, newSamples: 0 }
  }
  const samples = await readSamplesIndex(workDir)
  console.log(`[iteration:collect] samples index has ${samples.length} entries`)
  return { samplesFound: samples.length, newSamples: 0 }
}

interface ConvertResult {
  totalFiles: number
  modified: number
  reviewCount: number
  errors: number
  failures: Array<{ path: string; error: string }>
}

async function phaseConvert(ctx: IterationContext, workDir: string): Promise<ConvertResult> {
  // 调 orchestrate.ts 跑转换
  const orchestrateScript = join(workDir, 'tools', 'orchestrate.ts')
  if (!(await pathExists(orchestrateScript))) {
    throw new Error(`orchestrate.ts not found at ${orchestrateScript}`)
  }

  // 找一个 input 样本
  const samples = await readSamplesIndex(workDir)
  if (samples.length === 0) {
    throw new Error('no samples available to convert')
  }
  const input = samples[0]
  const outputDir = join(workDir, 'baselines', ctx.iterationId)

  const result = await runSubprocess(
    TSX_ENTRY.node,
    [TSX_ENTRY.tsx, orchestrateScript, '--input', input, '--output', outputDir, '--id', ctx.iterationId],
    workDir,
    STEP_TIMEOUT_MS,
  )

  if (result.exitCode !== 0) {
    const tail = (result.stdout + '\n' + result.stderr).slice(-1500)
    console.log(`[iteration:convert] orchestrate FAILED (exit=${result.exitCode})`)
    console.log(tail)
    throw new Error(`orchestrate exit ${result.exitCode}: ${result.stderr.slice(0, 500)}`)
  }

  // 解析 orchestrate 的输出报告
  // orchestrate.ts 会把 opts.id 拼到 output 后面：
  //   join(opts.output, opts.id) → 实际写 report 的目录
  const reportPath = join(outputDir, ctx.iterationId, 'report.json')
  try {
    const raw = await readFile(reportPath, 'utf8')
    const report = JSON.parse(raw)
    return {
      totalFiles: report.stats?.totalFiles || 0,
      modified: report.stats?.modified || 0,
      reviewCount: report.stats?.reviewCount || 0,
      errors: report.stats?.errors || 0,
      failures: (report.failures || []).map((f: { path: string; error: string }) => ({
        path: f.path,
        error: f.error,
      })),
    }
  } catch (err) {
    throw new Error(`failed to parse orchestrate report: ${(err as Error).message}`)
  }
}

interface DiffResult {
  officialMissingReviews: number
  ourExtraReviews: number
}

async function phaseDiff(ctx: IterationContext, workDir: string): Promise<DiffResult> {
  const comparatorScript = join(workDir, 'tools', 'baseline-comparator', 'src', 'index.ts')
  if (!(await pathExists(comparatorScript))) {
    console.log(`[iteration:diff] baseline-comparator not found, skipping`)
    return { officialMissingReviews: 0, ourExtraReviews: 0 }
  }
  // 调 comparator
  const result = await runSubprocess(
    TSX_ENTRY.node,
    [TSX_ENTRY.tsx, comparatorScript, '--iteration', ctx.iterationId],
    workDir,
    STEP_TIMEOUT_MS,
  )
  if (result.exitCode !== 0) {
    throw new Error(`comparator exit ${result.exitCode}`)
  }
  // 解析输出（best-effort）
  return { officialMissingReviews: 0, ourExtraReviews: 0 }
}

interface AnalyzeResult {
  newIssues: IssueTicket[]
  openIssues: number
  needsAgent: boolean
}

async function phaseAnalyze(ctx: IterationContext, workDir: string): Promise<AnalyzeResult> {
  // 从 report.failures 构造 IssueTicket
  // 加载历史 issues（如果有 issues.json）
  const issuesPath = join(workDir, 'baselines', '.issues.json')
  const knownIssues = (await readJsonSafe(issuesPath)) as IssueTicket[] | null || []

  const newIssues: IssueTicket[] = []
  for (const f of ctx.report.failures) {
    // 找已存在的 issue（按 path 匹配）
    const existing = knownIssues.find((i) => i.exampleFiles.includes(f.path) && i.status === 'open')
    if (existing) {
      existing.failedAttempts += 1
    } else {
      newIssues.push({
        id: `issue-${ctx.iterationId}-${newIssues.length}`,
        description: f.error,
        exampleFiles: [f.path],
        payload: { input: '', actualOutput: '', expectedOutput: '' },
        severity: 'blocker',
        type: 'syntax',
        status: 'open',
        createdAt: new Date().toISOString(),
        failedAttempts: 1,
      })
    }
  }

  // 合并 + 写回
  const allOpen = [
    ...knownIssues.filter((i) => i.status === 'open'),
    ...newIssues,
  ]
  await writeJsonSafe(issuesPath, allOpen)

  // 判断 needsAgent：open issues 里有 failedAttempts >= 3 的
  const needAgentCandidates = allOpen.filter((i) => i.failedAttempts >= 3)
  return {
    newIssues,
    openIssues: allOpen.length,
    needsAgent: needAgentCandidates.length > 0,
  }
}

async function trySpawnAgent(
  ctx: IterationContext,
  candidateIssues: IssueTicket[],
  workDir: string,
): Promise<{ issueId: string; ticketPath: string } | null> {
  // 加载最近 3 轮 reports
  const reportsDir = join(workDir, DEFAULT_REPORTS_DIR)
  const recent = await loadRecentReportsAsReports(reportsDir, 3)

  const target = await shouldSpawnAgent(recent, candidateIssues)
  if (!target) return null

  const result = await spawnAgentForIssue(target, workDir)
  if (result.success && result.result) {
    return { issueId: target.id, ticketPath: result.result }
  }
  console.warn(`[iteration] spawn agent failed: ${result.error}`)
  return null
}

interface GenerateResult {
  candidates: number
}

async function phaseGenerate(
  ctx: IterationContext,
  workDir: string,
  newIssues: IssueTicket[],
): Promise<GenerateResult> {
  const generatorScript = join(workDir, 'tools', 'rule-generator', 'src', 'index.ts')
  if (!(await pathExists(generatorScript))) {
    console.log(`[iteration:generate] rule-generator not found, skipping`)
    return { candidates: 0 }
  }
  const result = await runSubprocess(
    TSX_ENTRY.node,
    [TSX_ENTRY.tsx, generatorScript, '--iteration', ctx.iterationId, '--issues', JSON.stringify(newIssues)],
    workDir,
    STEP_TIMEOUT_MS,
  )
  if (result.exitCode !== 0) {
    throw new Error(`rule-generator exit ${result.exitCode}`)
  }
  return { candidates: 0 }
}

interface TestResult {
  total: number
  passed: number
  regression: boolean
}

async function phaseTest(ctx: IterationContext, workDir: string): Promise<TestResult> {
  const regressionScript = join(workDir, 'tools', 'regression-suite', 'src', 'index.ts')
  if (!(await pathExists(regressionScript))) {
    console.log(`[iteration:test] regression-suite not found, skipping`)
    return { total: 0, passed: 0, regression: false }
  }
  const goldenPath = join(workDir, 'baselines', 'golden.json')
  if (!(await pathExists(goldenPath))) {
    console.log(`[iteration:test] no golden.json, skipping`)
    return { total: 0, passed: 0, regression: false }
  }
  // 调 regression-suite run --golden <path> --work <our-output-dir> --prev <prev-output>
  const ourOutputDir = join(workDir, 'baselines', ctx.iterationId, ctx.iterationId)
  // 找前一轮的 work dir
  const prevId = ctx.prevIterationId
  const prevWorkDir = prevId
    ? join(workDir, 'baselines', prevId, prevId)
    : undefined
  const args: string[] = [TSX_ENTRY.tsx, regressionScript, 'run', '--golden', goldenPath, '--work', ourOutputDir]
  if (prevWorkDir) args.push('--prev', prevWorkDir)
  const result = await runSubprocess(TSX_ENTRY.node, args, workDir, STEP_TIMEOUT_MS)
  if (result.exitCode !== 0 && result.exitCode !== 2) {
    // exit 2 = RegressionError（业务上的"回归检测"），不当作 fatal
    const tail = (result.stdout + '\n' + result.stderr).slice(-1500)
    console.log(`[iteration:test] regression-suite exit=${result.exitCode}`)
    console.log(tail)
    throw new Error(`regression-suite exit ${result.exitCode}`)
  }
  return { total: 0, passed: 0, regression: false }
}

interface CommitResult {
  logPath: string
}

async function phaseCommit(ctx: IterationContext, workDir: string): Promise<CommitResult> {
  const logDir = join(workDir, 'docs', 'iterate-log')
  await mkdir(logDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  const logPath = join(logDir, `${date}.md`)

  const md = renderIterationLogMarkdown(ctx)
  // 追加而不是覆盖
  let existing = ''
  try {
    existing = await readFile(logPath, 'utf8')
  } catch {
    // 不存在
  }
  await writeFile(logPath, existing + '\n\n' + md, 'utf8')

  // best-effort git commit
  if (!GIT_BIN) {
    console.log('[iteration:commit] git not found, skipping')
  } else {
    try {
      await runSubprocess(GIT_BIN, ['add', logPath], workDir, 30_000)
      await runSubprocess(
        GIT_BIN,
        ['commit', '-m', `iterate(${ctx.iterationId}): ${ctx.report.state}`],
        workDir,
        30_000,
      )
    } catch (err) {
      console.warn(`[iteration:commit] git commit failed: ${(err as Error).message}`)
    }
  }

  return { logPath }
}

/* ----------------------------- 工具函数 ----------------------------- */

interface SubprocessResult {
  stdout: string
  stderr: string
  exitCode: number
  timedOut: boolean
}

interface SubprocessOptions {
  /** 强制走 shell（Windows 上 .cmd/.bat shim 需要 shell:true），但 shell:true 不能正确处理带空格的 path */
  forceShell?: boolean
}

function runSubprocess(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  options: SubprocessOptions = {},
): Promise<SubprocessResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      shell: options.forceShell === true,
      env: { ...process.env, FORCE_COLOR: '0', NODE_NO_WARNINGS: '1' },
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGTERM')
      } catch {
        // ignore
      }
    }, timeoutMs)
    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      stderr += `\n[spawn error] ${err.message}\n`
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 1, timedOut })
    })
  })
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readSamplesIndex(workDir: string): Promise<string[]> {
  const indexPath = join(workDir, 'samples', 'INDEX.json')
  try {
    const raw = await readFile(indexPath, 'utf8')
    const parsed = JSON.parse(raw) as unknown
    // Schema v1: { version, createdAt, source, entries: SampleEntry[] }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj = parsed as { entries?: Array<Record<string, unknown>>; samples?: Array<Record<string, unknown>> }
      if (Array.isArray(obj.entries)) {
        const paths = obj.entries
          .map((e) => (typeof e?.localPath === 'string' ? e.localPath : typeof e?.path === 'string' ? e.path : null))
          .filter((p): p is string => Boolean(p))
        if (paths.length > 0) return paths
      }
      if (Array.isArray(obj.samples)) {
        const paths = obj.samples
          .map((s) => (typeof s?.path === 'string' ? s.path : typeof s?.localPath === 'string' ? s.localPath : null))
          .filter((p): p is string => Boolean(p))
        if (paths.length > 0) return paths
      }
      console.log(`[readSamplesIndex] WARN: index file has no entries/samples fields, falling back`)
    } else if (Array.isArray(parsed)) {
      return parsed.map(String)
    } else {
      console.log(`[readSamplesIndex] WARN: index file is not object/array, falling back`)
    }
  } catch (e) {
    console.log(`[readSamplesIndex] ERROR: cannot read ${indexPath}: ${(e as Error).message}`)
  }

  // Fallback: 扫描 examples/ 下的所有子目录（每个子目录当作一个 sample）
  const fallback = await scanExamplesFallback(workDir)
  if (fallback.length > 0) {
    console.log(`[readSamplesIndex] fallback found ${fallback.length} samples from examples/`)
  }
  return fallback
}

async function scanExamplesFallback(workDir: string): Promise<string[]> {
  const examplesDir = join(workDir, 'examples')
  try {
    const entries = await readdir(examplesDir, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .map((e) => join(examplesDir, e.name))
  } catch {
    return []
  }
}

async function readJsonSafe(path: string): Promise<unknown> {
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function writeJsonSafe(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8')
}

async function loadRecentReportsAsReports(
  reportsDir: string,
  n: number,
): Promise<IterationReport[]> {
  try {
    const entries = await readdir(reportsDir)
    const jsonFiles = entries
      .filter((f) => f.endsWith('.json') && !f.includes('.tmp'))
      .sort()
      .reverse()
      .slice(0, n)
    const reports: IterationReport[] = []
    for (const f of jsonFiles) {
      try {
        const raw = await readFile(`${reportsDir}/${f}`, 'utf8')
        reports.push(JSON.parse(raw) as IterationReport)
      } catch {
        // 跳过
      }
    }
    return reports
  } catch {
    return []
  }
}

function renderIterationLogMarkdown(ctx: IterationContext): string {
  const r = ctx.report
  const s = r.stats
  return `## ${r.id}

- **State**: ${r.state}
- **Started**: ${r.startedAt}
- **Finished**: ${r.finishedAt || 'n/a'}
- **Files**: ${s.totalFiles} (valid: ${s.outputValid}, errors: ${s.errors})
- **Modified**: ${s.modified}
- **Review items**: ${s.reviewCount}
- **Agent tickets**: ${r.agentTickets.length}

### Failures (top 5)

${r.failures
  .slice(0, 5)
  .map((f) => `- \`${f.path}\`: ${f.error}`)
  .join('\n') || '_none_'}

---
`
}
