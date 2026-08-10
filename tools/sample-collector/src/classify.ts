/**
 * tools/sample-collector/src/classify.ts
 *
 * Lightweight classification for a downloaded sample.
 *
 * Inputs:
 *   - A package.json (raw text or parsed object)
 *   - A list of file paths inside the unzipped repo (relative to repo root)
 *   - Optional GitHub metadata (stars, declared repo.size in KB)
 *
 * Output:
 *   - A `SampleEntry` (see below) — the row we append to `samples/INDEX.json`.
 *
 * Design notes:
 *   - We never open .vue files. Classification is intentionally
 *     package.json + path-list based, so the unit test can be hermetic
 *     and run without a real repo.
 *   - "framework" picks the *first* match in a fixed preference order:
 *     element-ui > vant > iview > none.
 *   - "state" picks the *first* match in: pinia > vuex > none.
 *   - "router" is true if `vue-router` is a dependency OR if the path list
 *     contains a `router/index.*` file (covers hand-rolled setups).
 *   - "typescript" is true if `typescript` is a devDependency OR if any
 *     `.ts` / `.tsx` file exists in the path list.
 *   - "size" is bucketed by repo.size (KB) when given, otherwise by the
 *     sum of file lengths passed in.
 */

import { existsSync } from 'node:fs'
import { readFile, stat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export type Framework = 'element-ui' | 'vant' | 'iview' | 'none'
export type State = 'vuex' | 'pinia' | 'none'
export type Size = 'small' | 'medium' | 'large'

export interface SampleEntry {
  org: string
  repo: string
  shortSha: string
  localPath: string
  stars: number
  size: Size
  framework: Framework
  state: State
  router: boolean
  typescript: boolean
  fileCount: number
  vueFileCount: number
  collectedAt: string
}

export interface ClassifyInput {
  org: string
  repo: string
  shortSha: string
  localPath: string
  /** Raw package.json text (or null if no package.json was found). */
  packageJsonText?: string | null
  /** Relative file paths inside the unzipped repo (or local sample dir). */
  filePaths: string[]
  /** Total on-disk bytes of those files. Optional; used for size bucketing. */
  totalBytes?: number
  /** GitHub `size` field in KB. Optional — falls back to bytes-from-paths. */
  repoSizeKB?: number
  /** GitHub stargazers_count. */
  stars?: number
  /** Override the "now" timestamp (for deterministic tests). */
  collectedAt?: string
}

// ───────────────────────── helpers ─────────────────────────

interface PkgShape {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

function safeParsePkg(text: string | null | undefined): PkgShape {
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') return parsed as PkgShape
  } catch {
    /* swallow — treat as "no info" */
  }
  return {}
}

function hasDep(pkg: PkgShape, name: string): boolean {
  return Boolean(
    (pkg.dependencies && pkg.dependencies[name]) ||
      (pkg.devDependencies && pkg.devDependencies[name]),
  )
}

function detectFramework(pkg: PkgShape): Framework {
  // element-ui wins ties (most common, also has more migration noise).
  if (hasDep(pkg, 'element-ui') || hasDep(pkg, 'element-plus')) return 'element-ui'
  if (hasDep(pkg, 'vant') || hasDep(pkg, 'vant-weapp')) return 'vant'
  if (hasDep(pkg, 'iview') || hasDep(pkg, 'view-design')) return 'iview'
  return 'none'
}

function detectState(pkg: PkgShape): State {
  if (hasDep(pkg, 'pinia')) return 'pinia'
  if (hasDep(pkg, 'vuex')) return 'vuex'
  return 'none'
}

function detectRouter(pkg: PkgShape, filePaths: string[]): boolean {
  if (hasDep(pkg, 'vue-router')) return true
  // Hand-rolled setups: any `router/index.*` or `src/router/*.js` etc.
  for (const p of filePaths) {
    const norm = p.replace(/\\/g, '/').toLowerCase()
    if (/(^|\/)router\/(index|indexes?)\.(js|ts|vue)$/.test(norm)) return true
    if (/(^|\/)src\/router\/.+\.(js|ts)$/.test(norm)) return true
  }
  return false
}

function detectTypescript(pkg: PkgShape, filePaths: string[]): boolean {
  if (hasDep(pkg, 'typescript')) return true
  for (const p of filePaths) {
    if (/\.(ts|tsx)$/i.test(p)) return true
  }
  return false
}

function bucketSize(repoSizeKB: number | undefined, totalBytes: number): Size {
  // Prefer GitHub's KB number when available — it's what `repo.size` means.
  if (typeof repoSizeKB === 'number' && Number.isFinite(repoSizeKB) && repoSizeKB > 0) {
    if (repoSizeKB < 100) return 'small'
    if (repoSizeKB < 1024) return 'medium'
    return 'large'
  }
  // Fall back to actual on-disk bytes.
  const kb = totalBytes / 1024
  if (kb < 100) return 'small'
  if (kb < 1024) return 'medium'
  return 'large'
}

// ─────────────────────── core classifier ───────────────────────

export function classify(input: ClassifyInput): SampleEntry {
  const pkg = safeParsePkg(input.packageJsonText)
  const filePaths = input.filePaths

  let fileCount = 0
  let vueFileCount = 0
  for (const p of filePaths) {
    if (!p) continue
    fileCount++
    if (/\.vue$/i.test(p)) vueFileCount++
  }

  // Prefer the explicit totalBytes, fall back to whatever the caller
  // didn't provide. Without this, the byte-based size bucketer would
  // always see 0 and tag every local sample as `small`.
  const size = bucketSize(input.repoSizeKB, input.totalBytes ?? 0)

  return {
    org: input.org,
    repo: input.repo,
    shortSha: input.shortSha,
    localPath: input.localPath,
    stars: input.stars ?? 0,
    size,
    framework: detectFramework(pkg),
    state: detectState(pkg),
    router: detectRouter(pkg, filePaths),
    typescript: detectTypescript(pkg, filePaths),
    fileCount,
    vueFileCount,
    collectedAt: input.collectedAt ?? new Date().toISOString(),
  }
}

// ─────────── local-directory convenience wrappers ───────────

/**
 * Walk a local directory and collect relative file paths + total bytes.
 * Skips `node_modules`, `.git`, `dist`, `build` to keep the count honest.
 */
export async function walkLocalSample(
  rootDir: string,
  opts: { maxFiles?: number } = {},
): Promise<{ filePaths: string[]; totalBytes: number }> {
  const maxFiles = opts.maxFiles ?? 50_000
  const filePaths: string[] = []
  let totalBytes = 0
  const SKIP = /(^|\/)(node_modules|\.git|dist|build|coverage|\.cache|out)(\/|$)/i

  async function walk(dir: string): Promise<void> {
    if (filePaths.length >= maxFiles) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (filePaths.length >= maxFiles) return
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (SKIP.test('/' + e.name + '/')) continue
        await walk(full)
      } else if (e.isFile()) {
        const rel = full.startsWith(rootDir) ? full.slice(rootDir.length).replace(/^[\\/]/, '') : e.name
        filePaths.push(rel)
        try {
          const s = await stat(full)
          totalBytes += s.size
        } catch {
          /* unreadable — skip */
        }
      }
    }
  }

  if (!existsSync(rootDir)) {
    return { filePaths: [], totalBytes: 0 }
  }
  await walk(rootDir)
  return { filePaths, totalBytes }
}

/**
 * High-level helper for an already-unpacked sample on disk.
 * Reads package.json (if present) and walks the directory.
 */
export async function classifyFromLocal(
  localPath: string,
  meta: { org: string; repo: string; shortSha: string; stars?: number },
): Promise<SampleEntry> {
  const pkgPath = join(localPath, 'package.json')
  let pkgText: string | null = null
  if (existsSync(pkgPath)) {
    try {
      pkgText = await readFile(pkgPath, 'utf8')
    } catch {
      pkgText = null
    }
  }
  const { filePaths, totalBytes } = await walkLocalSample(localPath)
  // We deliberately do NOT pass `repoSizeKB` — let the bucketer use the
  // actual on-disk bytes so local samples get a faithful size bucket.
  return classify({
    org: meta.org,
    repo: meta.repo,
    shortSha: meta.shortSha,
    localPath,
    packageJsonText: pkgText,
    filePaths,
    totalBytes,
    stars: meta.stars,
  })
}
