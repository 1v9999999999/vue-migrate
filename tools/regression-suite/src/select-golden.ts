/**
 * select-golden.ts
 *
 * 从 examples/ 挑出 N 个文件作为金标。
 * 挑选策略:
 *   1) 每个 examples/ 一级子目录至少 5 个文件(无 .vue/.js 内容的目录直接跳过)
 *   2) 按文件大小分桶 small/medium/large = 30/40/30
 *   3) 优先命中特征: el- / this.$ / Vue.use / Vuex / Router / mounted / created
 *   4) 选完后对每个文件跑一次 vue-migrate,记录 expected hash 落盘
 *
 * 输出:
 *   baselines/golden.json      (元信息, 100 个文件)
 *   baselines/golden/<path>    (源文件 copy, 不污染 examples/)
 */

import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, relative, resolve, basename } from 'node:path'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { performance } from 'node:perf_hooks'

export interface GoldenFile {
  /** 相对 examples/ 的路径, 用 / 分隔 */
  path: string
  /** 源文件内容(用于将来回放 / 校验一致性) */
  source: string
  /** SHA-256(LF-normalized(output)) 十六进制 */
  expectedHash: string
  /** 转换输出(只留元信息, 不写到 baseline json 里以省空间) */
  expectedOutput?: string
  /** 特征 tag, 例如 ['vue2', 'element-ui', 'mounted'] */
  tags: string[]
  bytes: number
  lines: number
  /** 大小桶 */
  bucket: 'small' | 'medium' | 'large'
}

export interface GoldenManifest {
  version: 1
  createdAt: string
  /** 跑了多少次 vue-migrate 算出 hash(包含失败的 fallback) */
  probeRuns: number
  /** 桶统计 */
  bucketStats: { small: number; medium: number; large: number }
  /** tag 命中统计 */
  tagStats: Record<string, number>
  files: GoldenFile[]
}

/** 桶定义: < 2KB / 2-10KB / > 10KB */
function pickBucket(bytes: number): 'small' | 'medium' | 'large' {
  if (bytes < 2 * 1024) return 'small'
  if (bytes <= 10 * 1024) return 'medium'
  return 'large'
}

/** 桶定义 export (供单测 + 报告) */
export const BUCKET_THRESHOLDS = { smallMax: 2 * 1024, mediumMax: 10 * 1024 } as const

const FEATURE_PATTERNS: Array<[RegExp, string]> = [
  [/\bel-[a-zA-Z][\w-]*/, 'element-ui'],
  [/\bthis\.\$\w+/, 'this-dollar'],
  [/\bVue\s*\.\s*use\s*\(/, 'vue-use'],
  [/\bVuex\b/, 'vuex'],
  [/\bRouter\b/, 'router'],
  [/\bmounted\s*\(/, 'mounted'],
  [/\bcreated\s*\(/, 'created'],
  [/<script\s+setup>/, 'composition'],
  [/\bdata\s*\(\s*\)\s*\{/, 'options-data'],
  [/\bcomputed\s*:\s*\{/, 'options-computed'],
  [/\bmethods\s*:\s*\{/, 'options-methods'],
  [/\bbeforeDestroy\s*\(/, 'vue2-before-destroy'],
  [/slot-scope\s*=/, 'slot-scope'],
  [/\bnew\s+Vuex\.Store/, 'vuex-store'],
  [/\bnew\s+Router\s*\(/, 'router-instance'],
]

function detectTags(source: string, kind: 'vue' | 'js' | 'ts' | 'tsx' | 'jsx' | 'unknown'): string[] {
  const tags: string[] = []
  // 文件类型
  if (kind === 'vue') tags.push('vue2')
  // 特征匹配
  for (const [re, tag] of FEATURE_PATTERNS) {
    if (re.test(source)) tags.push(tag)
  }
  return [...new Set(tags)]
}

// ── 供单测的纯函数 alias ──
export const detectTagsPublic = detectTags
export type ScannedFile = {
  absPath: string
  relPath: string
  kind: 'vue' | 'js' | 'ts' | 'tsx' | 'jsx' | 'unknown'
  bytes: number
  source: string
  tags: string[]
  bucket: 'small' | 'medium' | 'large'
  topDir: string
}
export const pickFilesPublic = pickFiles
export const scanExamplesPublic = scanExamples
export const pickBucketPublic = pickBucket
export const sha256Public = sha256

function detectKind(path: string): 'vue' | 'js' | 'ts' | 'tsx' | 'jsx' | 'unknown' {
  if (path.endsWith('.vue')) return 'vue'
  if (path.endsWith('.tsx')) return 'tsx'
  if (path.endsWith('.ts')) return 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return 'js'
  return 'unknown'
}

/** 递归扫 examplesDir 拿所有 .vue/.js/.ts/.tsx/.jsx */
async function scanExamples(examplesDir: string): Promise<Array<{
  absPath: string
  relPath: string
  kind: 'vue' | 'js' | 'ts' | 'tsx' | 'jsx' | 'unknown'
  bytes: number
  source: string
  tags: string[]
  bucket: 'small' | 'medium' | 'large'
  topDir: string
}>> {
  const out: Array<{
    absPath: string; relPath: string; kind: 'vue' | 'js' | 'ts' | 'tsx' | 'jsx' | 'unknown'
    bytes: number; source: string; tags: string[]; bucket: 'small' | 'medium' | 'large'; topDir: string
  }> = []

  // fast-glob 不可用(没装),自己用 fs.readdir 递归
  async function walk(dir: string) {
    let entries: any
    try {
      entries = await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true })
    } catch { return }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        await walk(p)
      } else if (e.isFile()) {
        const k = detectKind(e.name)
        if (k === 'unknown') continue
        try {
          const src = await readFile(p, 'utf-8')
          out.push({
            absPath: p,
            relPath: relative(examplesDir, p).replace(/\\/g, '/'),
            kind: k,
            bytes: src.length,
            source: src,
            tags: detectTags(src, k),
            bucket: pickBucket(src.length),
            topDir: relative(examplesDir, p).replace(/\\/g, '/').split('/')[0],
          })
        } catch { /* skip unreadable */ }
      }
    }
  }
  await walk(examplesDir)
  return out
}

/**
 * 对单个文件跑一次 vue-migrate transform, 返回归一化后的输出文本.
 * 失败返回 null(调用方按 hash="" 处理).
 */
async function probeTransform(
  fileAbsPath: string,
  repoRoot: string,
  log: (s: string) => void,
): Promise<string | null> {
  // 临时目录: 包含单个文件, transform 整个目录
  const tmpIn = await (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'vm-reg-golden-'))
  const tmpOut = await (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'vm-reg-golden-out-'))
  const fname = basename(fileAbsPath)
  try {
    await copyFile(fileAbsPath, join(tmpIn, fname))
  } catch (e: any) {
    log(`  [probe] copy fail: ${e.message}`)
    return null
  }

  // vue-migrate CLI: tsx packages/cli/src/index.ts transform <dir> -o <out> --only-changed
  const cliEntry = join(repoRoot, 'packages', 'cli', 'src', 'index.ts')
  const args = [
    cliEntry,
    'transform',
    tmpIn,
    '-o', tmpOut,
    '--only-changed',
  ]

  return await new Promise<string | null>((resolveP) => {
    const child = spawn('node', [
      join(repoRoot, 'packages', 'cli', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      ...args,
    ], { cwd: repoRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    let stdout = ''
    const timer = setTimeout(() => {
      log(`  [probe] timeout, kill`)
      child.kill('SIGKILL')
    }, 30_000)
    child.stdout?.on('data', d => stdout += d.toString())
    child.stderr?.on('data', d => stderr += d.toString())
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        log(`  [probe] exit=${code} stderr=${stderr.split('\n').slice(-3).join(' | ').slice(0, 200)}`)
        return resolveP(null)
      }
      // 读输出
      const outPath = join(tmpOut, fname)
      if (!existsSync(outPath)) {
        log(`  [probe] no output file ${outPath}`)
        return resolveP(null)
      }
      readFile(outPath, 'utf-8').then(content => {
        // 归一化行尾到 LF 避免跨平台假回归
        const normalized = content.replace(/\r\n/g, '\n')
        resolveP(normalized)
      }).catch((e) => {
        log(`  [probe] read fail: ${e.message}`)
        resolveP(null)
      })
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      log(`  [probe] spawn error: ${e.message}`)
      resolveP(null)
    })
  })
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf-8').digest('hex')
}

/** Fisher-Yates 部分洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 核心挑选:
 *  - 每个 topDir 至少 5 个
 *  - 桶比例 small:medium:large = 3:4:3
 *  - 命中 tag 数量越多越优先
 */
function pickFiles(
  scanned: ReturnType<typeof scanExamples> extends Promise<infer T> ? T : never,
  target: number,
): typeof scanned {
  const byDir = new Map<string, typeof scanned>()
  for (const f of scanned) {
    if (!byDir.has(f.topDir)) byDir.set(f.topDir, [])
    byDir.get(f.topDir)!.push(f)
  }

  // 至少每个有内容目录 5 个
  const minTotalFromFloor = byDir.size * 5
  const effectiveTarget = Math.max(target, minTotalFromFloor)
  if (effectiveTarget > target) {
    // 静默提升, 调用方负责提示
    target = effectiveTarget
  }
  const targetPerDir = Math.max(5, Math.ceil(target / Math.max(byDir.size, 1)))
  const selected: typeof scanned = []
  const usedKeys = new Set<string>()

  // 先按目录分配
  for (const [dir, files] of byDir) {
    const sorted = files.slice().sort((a, b) => {
      // 1) tag 数降序
      const tagDiff = b.tags.length - a.tags.length
      if (tagDiff !== 0) return tagDiff
      // 2) 大小升序(避免单文件过大)
      return a.bytes - b.bytes
    })
    // 该目录的桶分布按全局比例算
    const wantFromDir = Math.min(targetPerDir, files.length)
    const wantSmall = Math.round(wantFromDir * 0.3)
    const wantMedium = Math.round(wantFromDir * 0.4)
    const wantLarge = Math.max(0, wantFromDir - wantSmall - wantMedium)

    const picked: typeof scanned = []
    for (const bucket of ['small', 'medium', 'large'] as const) {
      const inBucket = sorted.filter(f => f.bucket === bucket)
      const want = bucket === 'small' ? wantSmall : bucket === 'medium' ? wantMedium : wantLarge
      let bucketPicked = 0
      for (const f of inBucket) {
        if (bucketPicked >= want) break
        if (usedKeys.has(f.relPath)) continue
        picked.push(f)
        usedKeys.add(f.relPath)
        bucketPicked++
      }
    }
    // 不足时, 从同目录里继续按排序补
    for (const f of sorted) {
      if (picked.length >= wantFromDir) break
      if (usedKeys.has(f.relPath)) continue
      picked.push(f)
      usedKeys.add(f.relPath)
    }
    selected.push(...picked)
  }

  // 全局裁剪到 target 大小, 优先保留 tag 数多 + 多样
  if (selected.length > target) {
    selected.sort((a, b) => {
      const t = b.tags.length - a.tags.length
      if (t !== 0) return t
      // 不同目录交错
      return a.topDir.localeCompare(b.topDir)
    })
    return shuffle(selected).slice(0, target)
  }

  // 如果不到 target, 从剩余池里补
  if (selected.length < target) {
    const rest = scanned.filter(f => !usedKeys.has(f.relPath))
      .sort((a, b) => b.tags.length - a.tags.length)
    for (const f of rest) {
      if (selected.length >= target) break
      if (usedKeys.has(f.relPath)) continue
      selected.push(f)
      usedKeys.add(f.relPath)
    }
  }

  return selected
}

/**
 * 主入口: select-golden
 */
export async function selectGoldenSet(
  examplesDir: string,
  outputPath: string,
  target: number,
  opts: {
    repoRoot: string
    log?: (s: string) => void
  },
): Promise<GoldenManifest> {
  const log = opts.log ?? (() => {})
  const repoRoot = opts.repoRoot
  const startMs = performance.now()
  log(`[select] scanning ${examplesDir} ...`)
  const scanned = await scanExamples(examplesDir)
  log(`[select] scanned ${scanned.length} files`)

  const picked = pickFiles(scanned as any, target)
  log(`[select] picked ${picked.length} files`)

  // 复制源文件到 baselines/golden/<rel>
  const goldenDir = join(repoRoot, 'baselines', 'golden')
  await mkdir(goldenDir, { recursive: true })

  // tag 统计(选中的)
  const tagStats: Record<string, number> = {}
  for (const f of picked) {
    for (const t of f.tags) tagStats[t] = (tagStats[t] ?? 0) + 1
  }
  const bucketStats = { small: 0, medium: 0, large: 0 }
  for (const f of picked) bucketStats[f.bucket]++

  log(`[select] coverage: small=${bucketStats.small} medium=${bucketStats.medium} large=${bucketStats.large}`)
  log(`[select] tags: ${Object.entries(tagStats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ')}`)

  // 跑 transform 算 expected hash
  const files: GoldenFile[] = []
  let probeRuns = 0
  for (let i = 0; i < picked.length; i++) {
    const f = picked[i]
    const idx = `${i + 1}/${picked.length}`
    log(`[select] [${idx}] probing ${f.relPath} (${f.bytes}B, ${f.tags.length} tags) ...`)
    probeRuns++

    // copy 源文件
    const targetPath = join(goldenDir, f.relPath)
    await mkdir(join(targetPath, '..'), { recursive: true })
    await copyFile(f.absPath, targetPath)

    const out = await probeTransform(f.absPath, repoRoot, log)
    if (out === null) {
      log(`  [${idx}] probe failed (transform error), recording empty hash`)
      files.push({
        path: f.relPath,
        source: f.source,
        expectedHash: '',
        tags: f.tags,
        bytes: f.bytes,
        lines: f.source.split('\n').length,
        bucket: f.bucket,
      })
    } else if (out === '') {
      // transform 成功但没产出: 该文件不会被任何 plugin 改
      log(`  [${idx}] probe produced no output (unchanged), recording empty hash`)
      files.push({
        path: f.relPath,
        source: f.source,
        expectedHash: '',
        tags: f.tags,
        bytes: f.bytes,
        lines: f.source.split('\n').length,
        bucket: f.bucket,
      })
    } else {
      files.push({
        path: f.relPath,
        source: f.source,
        expectedHash: sha256(out),
        expectedOutput: undefined,  // 故意不存以省空间
        tags: f.tags,
        bytes: f.bytes,
        lines: f.source.split('\n').length,
        bucket: f.bucket,
      })
    }
  }

  const manifest: GoldenManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    probeRuns,
    bucketStats,
    tagStats,
    files,
  }

  await mkdir(join(outputPath, '..'), { recursive: true })
  await writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf-8')
  log(`[select] manifest written to ${outputPath} (${(performance.now() - startMs).toFixed(0)}ms)`)

  return manifest
}
