/**
 * tools/sample-collector/src/collect.ts
 *
 * Pulls real Vue 2 repos from GitHub and stages them under `samples/`.
 *
 * Flow per iteration:
 *   1. For each DIVERSITY_QUERIES entry, hit /search/repositories.
 *   2. Dedup against existing INDEX.json (key: `org/repo`, sha-agnostic).
 *   3. For each new repo: GET /repos/{owner}/{repo} (metadata) and
 *      GET /repos/{owner}/{repo}/zipball (zip).
 *   4. Skip repos whose declared `size` (KB) would unpack past `maxRepoKB`.
 *   5. Extract zip into `samples/{org}__{repo}__{shortSha}/`.
 *   6. Classify the unzipped contents (package.json + file list).
 *   7. Append the new SampleEntry to `samples/INDEX.json`.
 *
 * Important behaviors:
 *   - **Best-effort**: any single repo failure is logged and skipped.
 *     The whole batch never aborts on one bad apple.
 *   - **Idempotent**: reruns do not re-download. INDEX is the source of truth.
 *   - **Rate-limit friendly**: 100ms sleep between every HTTP call.
 *   - **Disk-safe**: per-repo size cap (default 50 MB) before extraction.
 */

import { Octokit } from '@octokit/rest'
import { mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve as pathResolve, dirname } from 'node:path'
import extractZip from 'extract-zip'

import { DIVERSITY_QUERIES } from './queries.js'
import { classify, walkLocalSample, type SampleEntry } from './classify.js'

// ──────────────────────────── options ────────────────────────────

export interface CollectOptions {
  /** Where the staged samples + INDEX.json live. */
  outDir: string
  /** Max repos per search query. */
  maxPerQuery: number
  /** Earliest pushed-at cutoff (ISO date). */
  since: string
  /** Latest pushed-at cutoff (ISO date). */
  until: string
  /** GitHub token. Falls back to env GITHUB_TOKEN. */
  token?: string
  /** When true, do not download or extract — just print the plan. */
  dryRun?: boolean
  /** Per-repo size cap in KB (after unzip). Default 50 * 1024 = 50MB. */
  maxRepoKB?: number
  /** Override sleep between API calls in ms. Default 100. */
  sleepMs?: number
  /** Optional: where to write/load INDEX.json. Defaults to `<outDir>/INDEX.json`. */
  indexPath?: string
}

// ──────────────────────────── helpers ────────────────────────────

const DEFAULT_MAX_REPO_KB = 50 * 1024 // 50 MB
const DEFAULT_SLEEP_MS = 100

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((r) => setTimeout(r, ms))
}

interface IndexFile {
  version: 1
  updatedAt: string
  entries: SampleEntry[]
}

async function loadIndex(indexPath: string): Promise<IndexFile> {
  if (!existsSync(indexPath)) {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] }
  }
  try {
    const raw = await readFile(indexPath, 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.entries)) {
      return parsed as IndexFile
    }
  } catch (e) {
    console.warn(`[collect] could not parse ${indexPath}: ${(e as Error).message} — starting empty`)
  }
  return { version: 1, updatedAt: new Date().toISOString(), entries: [] }
}

async function saveIndex(indexPath: string, idx: IndexFile): Promise<void> {
  await mkdir(dirname(indexPath), { recursive: true })
  await writeFile(indexPath, JSON.stringify(idx, null, 2) + '\n', 'utf8')
}

function buildSampleDirName(org: string, repo: string, shortSha: string): string {
  return `${org}__${repo}__${shortSha}`
}

function repoKey(org: string, repo: string): string {
  return `${org}/${repo}`
}

// ─────────────────────── zip download + extract ───────────────────────

async function downloadAndExtract(
  octokit: Octokit,
  org: string,
  repo: string,
  outDir: string,
  token: string | undefined,
): Promise<{ shortSha: string; filePaths: string[]; totalBytes: number; pkgText: string | null }> {
  // First, get the default branch so we can ask /zipball/{ref} deterministically.
  const meta = await octokit.repos.get({ owner: org, repo })
  const defaultBranch = meta.data.default_branch
  const refSha = (await octokit.git.getRef({
    owner: org,
    repo,
    ref: `heads/${defaultBranch}`,
  })).data.object.sha
  const shortSha = refSha.slice(0, 7)

  // Ask GitHub to send a zip stream.
  const zipResp = await octokit.repos.downloadZipballArchive({
    owner: org,
    repo,
    ref: defaultBranch,
    request: { fetch: (url: string, init: any) => fetchWithAuth(url, init, token) },
  } as any)

  const zipBuf = (zipResp as any).data as Buffer
  if (!Buffer.isBuffer(zipBuf)) {
    throw new Error(`downloadZipballArchive did not return a buffer for ${org}/${repo}`)
  }

  // Stage everything under a transient folder; caller will rename it.
  const stageRoot = join(outDir, `__pending__${org}__${repo}`)
  const tmpZip = join(stageRoot, '__pending.zip')
  await mkdir(stageRoot, { recursive: true })
  await writeFile(tmpZip, zipBuf)

  // Extract zip → stageRoot. GitHub's zipballs nest contents under
  // "<org>-<repo>-<shortSha>/". extract-zip flattens that into stageRoot.
  await extractZip(tmpZip, { dir: stageRoot })
  await rm(tmpZip, { force: true })

  // Walk the staged dir to feed classify().
  const { filePaths, totalBytes } = await walkLocalSample(stageRoot)

  // Read package.json if present.
  const pkgPath = join(stageRoot, 'package.json')
  let pkgText: string | null = null
  if (existsSync(pkgPath)) {
    try {
      pkgText = await readFile(pkgPath, 'utf8')
    } catch {
      /* ignore */
    }
  }

  return { shortSha, filePaths, totalBytes, pkgText }
}

async function fetchWithAuth(url: string, init: any, token: string | undefined): Promise<Response> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'vue-migrate-sample-collector',
    ...(init?.headers || {}),
  }
  if (token) headers['authorization'] = `Bearer ${token}`
  return fetch(url, { ...init, headers })
}

// ──────────────────────────── main ────────────────────────────

export async function collectSamples(opts: CollectOptions): Promise<SampleEntry[]> {
  const outDir = pathResolve(opts.outDir)
  const maxPerQuery = Math.max(0, opts.maxPerQuery)
  const since = opts.since
  const until = opts.until
  const token = opts.token ?? process.env.GITHUB_TOKEN
  const dryRun = Boolean(opts.dryRun)
  const maxRepoKB = opts.maxRepoKB ?? DEFAULT_MAX_REPO_KB
  const sleepMs = opts.sleepMs ?? DEFAULT_SLEEP_MS
  const indexPath = pathResolve(opts.indexPath ?? join(outDir, 'INDEX.json'))

  // We *do* require a token — GitHub's unauthenticated search is severely
  // throttled (10 req/min). If you really want to run without one, do
  // `--dry-run` and plan the queries locally instead.
  if (!dryRun && !token) {
    throw new Error('GITHUB_TOKEN is required for live collection. Use --dry-run to preview queries.')
  }

  // Octokit auth is optional at the client level — we set the token header
  // ourselves on zip downloads (see fetchWithAuth). For search / metadata
  // we still go through Octokit with `auth: token` so the higher rate
  // limit applies.
  const octokit = new Octokit({ auth: token, userAgent: 'vue-migrate-sample-collector' })

  // In dry-run mode we don't touch disk — no mkdir, no index load. This
  // keeps the smoke test side-effect-free (`collect --dry-run --out foo`
  // should NOT create `foo/`).
  const index = dryRun
    ? { version: 1 as const, updatedAt: new Date().toISOString(), entries: [] as SampleEntry[] }
    : await (async () => {
        await mkdir(outDir, { recursive: true })
        return await loadIndex(indexPath)
      })()
  const known = new Set(index.entries.map((e) => repoKey(e.org, e.repo)))
  const added: SampleEntry[] = []
  const skipped: Array<{ org: string; repo: string; reason: string }> = []

  console.log(`[collect] outDir: ${outDir}`)
  console.log(`[collect] indexPath: ${indexPath}`)
  console.log(`[collect] queries: ${DIVERSITY_QUERIES.length}, maxPerQuery: ${maxPerQuery}, dryRun: ${dryRun}`)
  console.log(`[collect] known samples: ${known.size}`)

  for (const q of DIVERSITY_QUERIES) {
    console.log(`\n[collect] ── query: ${q.name} (${q.bucket})`)
    console.log(`[collect]    q: ${q.q}`)

    if (dryRun) {
      console.log(`[collect]    (dry-run) would search and pull up to ${maxPerQuery} repos`)
      continue
    }

    // 1) search
    let searchData
    try {
      const resp = await octokit.search.repos({
        q: q.q,
        per_page: Math.min(100, Math.max(1, maxPerQuery)),
        sort: q.sort ?? undefined,
        order: 'desc',
      })
      searchData = resp.data
    } catch (e) {
      console.error(`[collect] search failed for ${q.name}: ${(e as Error).message}`)
      continue
    }
    await sleep(sleepMs)

    const hits = searchData.items.slice(0, maxPerQuery)
    console.log(`[collect]    hits: ${hits.length}`)

    for (const hit of hits) {
      const org = hit.owner?.login
      const repo = hit.name
      if (!org || !repo) continue

      const key = repoKey(org, repo)
      if (known.has(key)) {
        skipped.push({ org, repo, reason: 'already in INDEX' })
        continue
      }
      if (typeof hit.pushed_at === 'string') {
        if (hit.pushed_at < since) {
          skipped.push({ org, repo, reason: `pushed_at=${hit.pushed_at} < since=${since}` })
          continue
        }
        if (hit.pushed_at > until + 'T23:59:59Z') {
          skipped.push({ org, repo, reason: `pushed_at=${hit.pushed_at} > until=${until}` })
          continue
        }
      }
      if (typeof hit.size === 'number' && hit.size > maxRepoKB) {
        skipped.push({ org, repo, reason: `size=${hit.size}KB > maxRepoKB=${maxRepoKB}KB` })
        continue
      }

      console.log(`[collect]    ↓ ${org}/${repo} (${hit.size ?? '?'}KB, ${hit.stargazers_count ?? 0}★)`)
      try {
        // 2) metadata + zip. downloadAndExtract now also returns the real
        //    shortSha so we can build the directory name up front instead
        //    of renaming a tentative folder.
        await sleep(sleepMs)
        const got = await downloadAndExtract(octokit, org, repo, outDir, token)
        const finalDir = join(outDir, buildSampleDirName(org, repo, got.shortSha))

        // downloadAndExtract places the repo under a "pending" dir inside
        // outDir. Move it to its permanent name.
        const pendingDir = join(outDir, `__pending__${org}__${repo}`)
        if (existsSync(finalDir)) {
          await rm(finalDir, { recursive: true, force: true })
        }
        await rename(pendingDir, finalDir)

        // 3) classify
        const entry = classify({
          org,
          repo,
          shortSha: got.shortSha,
          localPath: finalDir,
          packageJsonText: got.pkgText,
          filePaths: got.filePaths,
          totalBytes: got.totalBytes,
          stars: hit.stargazers_count ?? 0,
        })

        index.entries.push(entry)
        added.push(entry)
        known.add(key)
        console.log(
          `[collect]    ✓ ${org}/${repo} → ${entry.framework}/${entry.state}/${entry.size}` +
            ` router=${entry.router} ts=${entry.typescript} vue=${entry.vueFileCount}`,
        )
      } catch (e) {
        console.error(`[collect]    ✗ ${org}/${repo}: ${(e as Error).message}`)
        // Best-effort cleanup of the half-extracted directory
        const pendingDir = join(outDir, `__pending__${org}__${repo}`)
        if (existsSync(pendingDir)) {
          await rm(pendingDir, { recursive: true, force: true }).catch(() => undefined)
        }
        skipped.push({ org, repo, reason: `download/extract failed: ${(e as Error).message}` })
      }
      await sleep(sleepMs)
    }
  }

  // Persist index
  if (!dryRun) {
    index.updatedAt = new Date().toISOString()
    await saveIndex(indexPath, index)
  }

  // Summary
  console.log(`\n[collect] ── summary ──`)
  console.log(`[collect] added:   ${added.length}`)
  console.log(`[collect] skipped: ${skipped.length}`)
  if (skipped.length) {
    for (const s of skipped) {
      console.log(`[collect]   - ${s.org}/${s.repo}: ${s.reason}`)
    }
  }

  return added
}
