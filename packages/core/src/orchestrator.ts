/**
 * Orchestrator —— 编排整个管道
 * 
 * 调用顺序：
 * 1. scanProject  → 发现文件
 * 2. parseProject → 解析 AST
 * 3. plugins.scan → 插件扫描钩子
 * 4. plugins.analyze → 插件分析钩子（跨文件）
 * 5. plugins.transform（每个文件）→ 主转换
 * 6. codegenProject → 生成代码
 * 7. writeFiles → 写盘
 * 8. reportProject → 报告
 */

import { writeFile, copyFile, mkdir } from 'node:fs/promises'
import { dirname, relative, resolve, join } from 'node:path'
import { existsSync } from 'node:fs'
import chalk from 'chalk'

import { scanProject } from './scanner.js'
import { parseProject } from './parser.js'
import { codegenProject } from './codegen.js'
import { reportProject } from './reporter.js'
import { getPlugins } from './plugin.js'
import { createTransformContext } from './context.js'
import type { FileNode, ProjectContext, ReportItem, TransformPlugin } from './types.js'

/** iter-122b: per-priority barrier with parallel-across-files.
 *  - 每个 priority 级别, 在所有 file 上 barrier 同步
 *  - 同一 priority 内的不同 file, parallel 执行 (限流 CONCURRENCY 个 worker)
 *  - 同一 file 内, 同一 priority 下的多个 plugin 串行 (plugin 间可能有依赖)
 */
const DEFAULT_FILE_CONCURRENCY = 8

async function runPluginsWithPriorityBarrier(ctx: ProjectContext): Promise<void> {
  // 1. 按 priority 分组 plugin.  同一 priority 的 plugin 视作"同 phase"
  const byPriority = new Map<number, TransformPlugin[]>()
  for (const plugin of ctx.plugins) {
    if (!plugin.transform) continue
    const p = plugin.priority ?? 0
    if (!byPriority.has(p)) byPriority.set(p, [])
    byPriority.get(p)!.push(plugin)
  }
  // 2. priority 倒序
  const priorities = [...byPriority.keys()].sort((a, b) => b - a)

  // 3. file 列表
  const fileList: FileNode[] = [...ctx.files.values()]

  // 4. worker pool
  const concurrency = Math.max(
    1,
    Math.min(DEFAULT_FILE_CONCURRENCY, fileList.length || 1),
  )

  // 5. iter-122b: 真正的 per-priority barrier.
  //   每个 priority 级别, 在所有 file 上 barrier 同步:
  //   - ALL workers 完成 priority X 的所有 file 之前, 任何 worker 不开始 priority X-1
  //   - 这样保证 vuex-pinia(priority 9) 写 ctx.storeNames.mainExportName
  //     一定在 composition(priority 0) 读之前完成
  //   - 同一 priority 内, file 之间 parallel
  //   - 同一 file 内, 同一 priority 下的多个 plugin 串行
  let nextIdx = 0
  for (const p of priorities) {
    const pluginsAtP = byPriority.get(p)!
    nextIdx = 0
    async function worker(): Promise<void> {
      while (true) {
        const myIdx = nextIdx++
        if (myIdx >= fileList.length) return
        const file = fileList[myIdx]
        for (const plugin of pluginsAtP) {
          const outcome = await runOnePluginOnFile(plugin, file, ctx)
          if (outcome === 'failed') {
            // 失败: 跳过当前 file 剩余 plugin (iter-118 行为)
            return
          }
        }
      }
    }
    const workers: Promise<void>[] = []
    for (let i = 0; i < concurrency; i++) workers.push(worker())
    await Promise.all(workers)
  }
}

/** 跑一个 plugin 在一个 file 上, 返回 'ok' | 'skipped' | 'failed' */
async function runOnePluginOnFile(
  plugin: TransformPlugin,
  file: FileNode,
  ctx: ProjectContext,
): Promise<'ok' | 'skipped' | 'failed'> {
  // 按 plugins 名字过滤
  if (ctx.config.plugins && !ctx.config.plugins.includes(plugin.name)) return 'skipped'
  // 按 fileKinds 过滤
  if (plugin.fileKinds && !plugin.fileKinds.includes(file.kind)) return 'skipped'
  if (!file.scriptAst) return 'skipped'
  // iter-118: 跳过测试文件
  const isTestFile = /\.(spec|test)\.[jt]sx?$/.test(file.path) || /[\\/]__tests__[\\/]/.test(file.path)
  if (isTestFile) {
    file.transforms.push({
      plugin: plugin.name,
      message: 'skipped: test file',
      changed: false,
    })
    return 'skipped'
  }
  // iter-118: file-level skip lock
  if ((file as any).__skipped && plugin.name !== 'composition') {
    file.transforms.push({
      plugin: plugin.name,
      message: `skipped: file marked as skipped (${(file as any).__skipped})`,
      changed: false,
    })
    return 'skipped'
  }
  // iter-122c: file-level failed lock (parser failed / 之前的 plugin 抛错)
  // 源 corruption 时已被标记, 跳过所有后续 plugin
  if ((file as any).__failed) {
    file.transforms.push({
      plugin: plugin.name,
      message: `skipped: file marked as failed (${(file as any).__failedPlugin})`,
      changed: false,
    })
    return 'skipped'
  }

  const transformCtx = createTransformContext(file, ctx)
  try {
    await plugin.transform!(transformCtx)
    file.transforms.push({
      plugin: plugin.name,
      message: transformCtx['__lastMessage'] || 'transformed',
      changed: transformCtx['__changed'] || false,
    })
    if (transformCtx['__changed']) {
      file.changed = true
      ctx.stats.modifiedFiles++
    }
    return 'ok'
  } catch (e: any) {
    file.transforms.push({
      plugin: plugin.name,
      message: 'transform failed',
      changed: false,
      error: e.message,
    })
    ctx.stats.errors++
    // iter-118: 失败标记 + 后续 plugin 跳过
    ;(file as any).__failed = true
    ;(file as any).__failedPlugin = plugin.name
    ;(file as any).__failedError = e.message
    return 'failed'
  }
}

export interface OrchestratorOptions {
  root: string
  outDir?: string
  dryRun?: boolean
  backup?: boolean
  plugins?: string[]
  /**
   * 是否保留完整目录结构。
   *   - true（默认）：未改的文件从 src 拷贝到 dst（适合一次性迁移）
   *   - false：只写改过的文件（适合增量场景）
   */
  keepStructure?: boolean
  /** iter-037: JS 解析失败时 fallback 试 TS, 默认 false */
  fallbackToTs?: boolean
}

export async function runPipeline(opts: OrchestratorOptions): Promise<ProjectContext> {
  const ctx: ProjectContext = {
    root: resolve(opts.root),
    files: new Map(),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: getPlugins(),
    stats: {
      totalFiles: 0,
      modifiedFiles: 0,
      newTypesInferred: 0,
      manualReviewRequired: 0,
      errors: 0,
    },
    config: {
      dryRun: opts.dryRun,
      plugins: opts.plugins,
      backup: opts.backup,
      outDir: opts.outDir,
      keepStructure: opts.keepStructure ?? true,  // 默认 true
      fallbackToTs: opts.fallbackToTs ?? false,  // iter-037: 默认不转 TS
    },
    // P0-B: 跨插件共享的 store 命名 (vuex-pinia 写、composition 读)
    storeNames: {},
  }

  console.log(chalk.gray(`\n[1/6] 扫描文件: ${ctx.root}`))
  await scanProject(ctx)
  console.log(chalk.green(`       发现 ${ctx.stats.totalFiles} 个文件`))

  console.log(chalk.gray('[2/6] 解析 AST'))
  await parseProject(ctx)

  console.log(chalk.gray('[3/6] 插件扫描钩子'))
  for (const plugin of ctx.plugins) {
    if (plugin.scan) await plugin.scan(ctx)
  }

  console.log(chalk.gray('[4/6] 跨文件分析'))
  for (const plugin of ctx.plugins) {
    if (plugin.analyze) await plugin.analyze(ctx)
  }

  console.log(chalk.gray('[5/6] 文件级转换'))

  // iter-118: 早期 file-level lock (在所有 plugin 之前) — 标记 Nuxt 特殊函数文件
  //   这样后续所有 plugin (包括 this-replacer 在 composition 之前的) 都看到 lock 跳过
  for (const file of ctx.files.values()) {
    if (file.source && /\b(asyncData|serverPrefetch|middleware|validate)\s*[:(]/.test(file.source)) {
      ;(file as any).__skipped = 'nuxt-special-functions'
    }
  }

  // iter-122b: per-priority barrier with parallel-across-files.
  //   原实现: for each file { for each plugin } — 全 serial, N_files × N_plugins
  //   新实现: for each priority { for each file (parallel) { for each plugin at this priority } }
  //   - 在 priority 边界 barrier: 低 priority plugin 必等所有高 priority 在所有 file 上完成
  //     (保证 vuex-pinia(p=9) 写 ctx.storeNames.mainExportName 在 composition(p=0) 读之前完成)
  //   - 同一 priority 内, file 之间 parallel (file 之间不共享 state, 安全)
  //   - 同一 file 内, 同一 priority 的 plugin 串行 (plugin 可能有内部依赖)
  //   - 配合 CONCURRENCY 限流, 避免 200+ file 项目瞬间起 200 个 Promise 把 IO 打爆
  await runPluginsWithPriorityBarrier(ctx)

  console.log(chalk.gray('[6/6] 生成代码 + 写盘'))

  console.log(chalk.gray('[6/6] 生成代码 + 写盘'))
  const generated = await codegenProject(ctx)
  if (!opts.dryRun) {
    await writeResults(generated, ctx, opts)
  }

  // 收集 review 项
  const reviewItems: ReportItem[] = []
  for (const file of ctx.files.values()) {
    for (const tr of file.transforms) {
      // iter-122c: 跳过 self-check failed — 源 corruption (或 plugin 写出语法错)
      // 已 fallback 到原 source, 不算 plugin 错误, 不进 review list
      if (tr.plugin === 'core/codegen' && tr.message?.includes('self-check failed')) {
        continue
      }
      // iter-122c: 跳过 parser failed — 源文件本身 syntax error, 不是 plugin 错
      // 已 fallback 到原 source (via __failed lock), 不进 review list
      if (tr.plugin === 'core/parser' && tr.message?.includes('parse failed')) {
        continue
      }
      if (tr.error) {
        reviewItems.push({ file: file.relativePath, plugin: tr.plugin, type: 'error', message: tr.error })
      } else if (tr.plugin === 'manual-review') {
        reviewItems.push({ file: file.relativePath, plugin: tr.plugin, type: 'manual-review', message: tr.message })
      }
    }
  }
  // 不再覆盖 ctx.stats.manualReviewRequired —— context.ts.manualReview 已经累加了
  // 这里只更新 report 用

  reportProject(ctx, reviewItems)

  return ctx
}

async function writeResults(
  generated: Map<string, string>,
  ctx: ProjectContext,
  opts: OrchestratorOptions,
): Promise<void> {
  const outDir = opts.outDir ? resolve(opts.outDir) : ctx.root
  const keepStructure = opts.keepStructure ?? true

  if (opts.backup && !opts.outDir) {
    const backupDir = join(ctx.root, '.vue-migrate-backup', String(Date.now()))
    await mkdir(backupDir, { recursive: true })
    console.log(chalk.gray(`       备份到: ${backupDir}`))
    for (const file of ctx.files.values()) {
      const rel = relative(ctx.root, file.path)
      const backupPath = join(backupDir, rel)
      await mkdir(dirname(backupPath), { recursive: true })
      await copyFile(file.path, backupPath)
    }
  }

  // 计算每个文件的目标路径
  const targetOf = (absPath: string): string =>
    outDir === ctx.root ? absPath : join(outDir, relative(ctx.root, absPath))

  // 写出被改过的文件
  for (const [absPath, code] of generated) {
    const outPath = targetOf(absPath)
    await mkdir(dirname(outPath), { recursive: true })
    await writeFile(outPath, code, 'utf-8')
  }

  let copiedCount = 0
  if (keepStructure) {
    for (const file of ctx.files.values()) {
      // 跳过已写出的文件
      if (generated.has(file.path)) continue
      const outPath = targetOf(file.path)
      // 跳过目录（FileNode 是文件，不会有目录项）
      // 但保险起见检查一下
      try {
        // 确保目标目录存在
        await mkdir(dirname(outPath), { recursive: true })
        await copyFile(file.path, outPath)
        copiedCount++
      } catch (e: any) {
        ctx.stats.errors++
        file.transforms.push({
          plugin: 'core/writer',
          message: 'copy failed',
          changed: false,
          error: e.message,
        })
      }
    }
  }

  if (generated.size > 0) {
    console.log(chalk.green(`       已写 ${generated.size} 个文件`))
  }
  if (copiedCount > 0) {
    console.log(chalk.gray(`       拷贝 ${copiedCount} 个未改文件（保留目录结构）`))
  }
}
