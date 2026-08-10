/**
 * tools/seed-samples-index.ts
 *
 * 把 examples/ 下所有目录灌进 samples/INDEX.json，作为 sample-collector 的初始 seed
 * （不依赖 GitHub 也不需要 token，纯本地）
 */
import { readdir, writeFile, mkdir, readFile, stat } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')
const EXAMPLES = join(ROOT, 'examples')
const SAMPLES = join(ROOT, 'samples')
const INDEX = join(SAMPLES, 'INDEX.json')
const TSX = join(ROOT, 'tools', 'sample-collector', 'node_modules', '.bin', 'tsx.cmd')
const CLASSIFY = join(ROOT, 'tools', 'sample-collector', 'src', 'index.ts')

const SKIP = new Set(['222'])

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

async function listDirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory() && !SKIP.has(e.name)).map((e) => e.name)
}

function classify(dirPath: string): SampleEntry | null {
  const res = spawnSync(TSX, [CLASSIFY, 'classify', '--sample', dirPath, '--json'], {
    encoding: 'utf8',
    shell: true,
  })
  if (res.status !== 0) {
    console.error(`[seed] classify failed for ${dirPath}:`, res.stderr.slice(0, 200))
    return null
  }
  try {
    return JSON.parse(res.stdout.trim())
  } catch (e) {
    console.error(`[seed] parse failed for ${dirPath}:`, res.stdout.slice(0, 200))
    return null
  }
}

async function main() {
  if (!existsSync(SAMPLES)) {
    await mkdir(SAMPLES, { recursive: true })
  }
  const dirs = (await listDirs(EXAMPLES)).sort()
  console.log(`[seed] found ${dirs.length} examples directories`)

  const entries: SampleEntry[] = []
  for (const name of dirs) {
    const full = join(EXAMPLES, name)
    // 至少要有 1 个 .vue 或 .js
    const hasSrc = await hasAnySource(full)
    if (!hasSrc) {
      console.log(`[seed] skip (no source): ${name}`)
      continue
    }
    console.log(`[seed] classify: ${name}`)
    const entry = classify(full)
    if (entry) {
      entries.push(entry)
    }
  }

  const index = {
    version: 1,
    createdAt: new Date().toISOString(),
    source: 'local-seed',
    entries,
  }
  await writeFile(INDEX, JSON.stringify(index, null, 2))
  console.log(`\n[seed] wrote ${INDEX} with ${entries.length} entries\n`)

  console.log('Summary:')
  for (const e of entries) {
    console.log(
      `  ${e.repo.padEnd(50)} framework=${e.framework.padEnd(12)} state=${e.state.padEnd(6)} router=${String(e.router).padEnd(5)} ts=${String(e.typescript).padEnd(5)} size=${e.size.padEnd(6)} vueFiles=${e.vueFileCount}`,
    )
  }
}

async function hasAnySource(dir: string): Promise<boolean> {
  async function walk(d: string, depth: number): Promise<boolean> {
    if (depth > 3) return false
    const entries = await readdir(d, { withFileTypes: true })
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isFile() && /\.(vue|js)$/.test(e.name)) return true
      if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
        if (await walk(full, depth + 1)) return true
      }
    }
    return false
  }
  return walk(dir, 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
