/**
 * tools/baseline-comparator/src/run-official.ts
 *
 * 封装对官方 vue-codemod（任务里写 @vue/codemod，实际 npm 包是 vue-codemod）的调用。
 *
 * 行为约定：
 *   - 调用方负责：把样本复制到 workDir（保证原样本不被污染）
 *   - 本模块负责：在 workDir 上跑 vue-codemod，收集 fileOutputs / errors
 *   - 优先用 vue-codemod 的 programmatic API（更稳，且能处理 .vue 文件）
 *   - Programmatic 失败 → fallback 到 CLI（npx vue-codemod，每个 transformation 跑一次）
 *   - 全失败 → 返回 ok:false, errors 列出原因，但不让上层崩
 */

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, relative, sep, dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export interface OfficialRunResult {
  /** 相对 workDir 的路径 → 转换后的源码 */
  fileOutputs: Map<string, string>
  /** 错误列表 */
  errors: Array<{ path: string; error: string }>
  /** 参与处理的文件数（.vue + .js/.ts） */
  totalFiles: number
  /** 实际被改动的文件数 */
  modified: number
  /** review 计数（vue-codemod 无 review 概念，始终为 0） */
  reviewCount: number
  /** 是否成功（无 errors 即可） */
  ok: boolean
  /** 使用的包名（@vue/codemod / vue-codemod） */
  packageName: string
  /** 跳过原因（如果完全没跑起来） */
  skippedReason?: string
  /** 跑法：'programmatic' | 'cli' | 'none' */
  mode: 'programmatic' | 'cli' | 'none'
  /** 跑了多少条 transformation 规则（programmatic 模式） */
  transformationsRun?: number
}

const SUPPORTED_EXTS = new Set(['.vue', '.js', '.ts', '.jsx', '.tsx'])

async function walkDir(root: string): Promise<string[]> {
  const out: string[] = []
  async function visit(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) await visit(p)
      else if (e.isFile()) {
        const dot = e.name.lastIndexOf('.')
        if (dot >= 0 && SUPPORTED_EXTS.has(e.name.slice(dot).toLowerCase())) {
          out.push(p)
        }
      }
    }
  }
  await visit(root)
  return out
}

export async function readAllFiles(root: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const files = await walkDir(root)
  for (const f of files) {
    try {
      const content = await readFile(f, 'utf-8')
      map.set(relative(root, f).split(sep).join('/'), content)
    } catch {
      // 忽略读取失败
    }
  }
  return map
}

function resolveNodeModulesDir(pkg: string): string | null {
  const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  let dir = here
  for (let i = 0; i < 8; i++) {
    const p = join(dir, 'node_modules', pkg)
    if (existsSync(p)) return p
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

interface VueCodemodProgrammatic {
  transformations: Record<string, any>
  runTransformation: (fileInfo: { path: string; source: string }, mod: any, params?: any) => string
}

let _cachedCodemod: VueCodemodProgrammatic | null = null
let _cachedCodemodPkg: string | null = null

function loadVueCodemodProgrammatic(pkg: string): VueCodemodProgrammatic | null {
  if (_cachedCodemod && _cachedCodemodPkg === pkg) return _cachedCodemod
  const modDir = resolveNodeModulesDir(pkg)
  if (!modDir) return null
  const require = createRequire(import.meta.url)
  try {
    // dist/index.js (CJS)
    const mod = require(join(modDir, 'dist', 'index.js'))
    _cachedCodemod = {
      transformations: mod.transformations ?? {},
      runTransformation: mod.runTransformation,
    }
    _cachedCodemodPkg = pkg
    return _cachedCodemod
  } catch (e) {
    return null
  }
}

/** Programmatic 跑所有 transformation */
async function runProgrammatic(
  vc: VueCodemodProgrammatic,
  workDir: string,
  knownBroken: Set<string> = new Set(),
): Promise<{ fileOutputs: Map<string, string>; errors: Array<{ path: string; error: string }>; totalFiles: number; modified: number; transformationsRun: number }> {
  const before = await readAllFiles(workDir)
  const fileOutputs = new Map<string, string>(before)
  const errors: Array<{ path: string; error: string }> = []
  let modified = 0
  const transformations = Object.entries(vc.transformations).filter(([n]) => !knownBroken.has(n))

  for (const [relPath, source] of before) {
    let current = source
    let fileChanged = false
    for (const [tName, tMod] of transformations) {
      try {
        const out = vc.runTransformation(
          { path: relPath, source: current },
          tMod,
          {},
        )
        if (typeof out === 'string' && out !== current) {
          current = out
          fileChanged = true
        }
      } catch (e: any) {
        // 单文件单规则失败不致命
        // 收集到 errors 但不抛出
        if (errors.length < 50) {
          errors.push({ path: `${relPath}@${tName}`, error: e.message?.slice(0, 200) ?? String(e) })
        }
      }
    }
    if (fileChanged) {
      fileOutputs.set(relPath, current)
      modified++
      // 也把 transformed 内容写回磁盘，方便人工 inspect
      const absPath = join(workDir, relPath.split('/').join(sep))
      try {
        await writeFile(absPath, current, 'utf-8')
      } catch (e: any) {
        errors.push({ path: `${relPath}@write`, error: e.message })
      }
    }
  }

  return { fileOutputs, errors, totalFiles: before.size, modified, transformationsRun: transformations.length }
}

/** CLI 跑：每个 transformation 单独一次 npx 调用 */
async function runViaCli(
  pkg: string,
  workDir: string,
  transformations: string[],
  timeoutMs: number,
): Promise<{ fileOutputs: Map<string, string>; errors: Array<{ path: string; error: string }>; totalFiles: number; modified: number }> {
  const before = await readAllFiles(workDir)
  const errors: Array<{ path: string; error: string }> = []
  const fileOutputs = new Map<string, string>(before)
  let modifiedFiles = 0

  for (const t of transformations) {
    await new Promise<void>((resolveP) => {
      const child = spawn('npx', ['-y', pkg, workDir, '-t', t, '--no-bail'], {
        cwd: workDir,
        shell: process.platform === 'win32',
        env: { ...process.env, CI: '1' },
      })
      let stderr = ''
      let stdout = ''
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        try { child.kill('SIGKILL') } catch {}
      }, Math.min(timeoutMs, 60_000)) // 单个 transformation 上限 1 分钟

      child.stdout?.on('data', (d) => { stdout += d.toString() })
      child.stderr?.on('data', (d) => { stderr += d.toString() })

      child.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) {
          errors.push({ path: `(global)@${t}`, error: `vue-codemod ${t} timed out` })
        } else if (code !== 0 && code !== null && !stderr.includes('SyntaxError')) {
          // CLI 退出非 0 + 不是语法错误：记录
          const snippet = stderr.trim().split('\n').slice(-2).join(' | ')
          errors.push({ path: `(global)@${t}`, error: `exit ${code}: ${snippet}` })
        }
        resolveP()
      })
      child.on('error', (e) => {
        clearTimeout(timer)
        errors.push({ path: `(global)@${t}`, error: e.message })
        resolveP()
      })
    })
  }

  // 读取修改后内容
  const after = await readAllFiles(workDir)
  for (const [p, newContent] of after) {
    const oldContent = before.get(p)
    if (oldContent === undefined || oldContent !== newContent) {
      fileOutputs.set(p, newContent)
      if (oldContent !== undefined && oldContent !== newContent) modifiedFiles++
    }
  }

  return { fileOutputs, errors, totalFiles: before.size, modified: modifiedFiles }
}

export interface RunOptions {
  /** 单次 codemod 调用的超时（毫秒），默认 10 分钟 */
  timeoutMs?: number
}

/**
 * 实际入口：在 workDir 上跑官方 codemod。
 *
 * 调用方需要：
 *   1. 把样本复制到 workDir
 *   2. 调用 runOfficialCodemod(samplePath, workDir, opts)
 *   3. 函数结束后，workDir 里的内容即为官方 codemod 的输出
 */
export async function runOfficialCodemod(
  samplePath: string,
  workDir: string,
  opts: RunOptions = {},
): Promise<OfficialRunResult> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60 * 1000
  const errors: Array<{ path: string; error: string }> = []
  const result: OfficialRunResult = {
    fileOutputs: new Map(),
    errors,
    totalFiles: 0,
    modified: 0,
    reviewCount: 0,
    ok: false,
    packageName: '',
    mode: 'none',
  }

  // 前置检查
  try {
    const s = await stat(workDir)
    if (!s.isDirectory()) {
      result.skippedReason = `workDir is not a directory: ${workDir}`
      return result
    }
  } catch (e: any) {
    result.skippedReason = `workDir not accessible: ${e.message}`
    return result
  }

  // 找包
  const candidatePkgs = ['@vue/codemod', 'vue-codemod']
  let foundPkg: string | null = null
  for (const pkg of candidatePkgs) {
    if (resolveNodeModulesDir(pkg)) {
      foundPkg = pkg
      break
    }
  }
  if (!foundPkg) {
    result.skippedReason = 'Neither @vue/codemod nor vue-codemod installed. Run: tsx src/index.ts install'
    result.fileOutputs = await readAllFiles(workDir)
    result.totalFiles = result.fileOutputs.size
    return result
  }
  result.packageName = foundPkg

  // 优先 programmatic
  const vc = loadVueCodemodProgrammatic(foundPkg)
  if (vc && Object.keys(vc.transformations).length > 0) {
    try {
      // 过滤掉已知会在 0.0.5 抛错的 rules（避免 errors 列表被噪音淹没）
      const KNOWN_BROKEN = new Set(['add-import', 'remove-extraneous-import', 'remove-vue-use'])
      const r = await runProgrammatic(vc, workDir, KNOWN_BROKEN)
      result.fileOutputs = r.fileOutputs
      result.errors.push(...r.errors)
      result.totalFiles = r.totalFiles
      result.modified = r.modified
      result.mode = 'programmatic'
      result.transformationsRun = r.transformationsRun
      // ok 的判定：拿到了一些 transformed 输出（哪怕有部分 per-rule 报错）
      result.ok = r.modified > 0 || r.errors.length === 0
      return result
    } catch (e: any) {
      // programmatic 整体挂了，fallback CLI
      errors.push({ path: '(programmatic)', error: e.message })
    }
  }

  // Fallback：CLI 跑已知的 transformation 列表
  const KNOWN_TRANSFORMATIONS = [
    'new-vue-to-create-app',
    'new-global-api',
    'new-directive-api',
    'define-component',
    'remove-production-tip',
    'remove-contextual-h-from-render',
    'remove-vue-use',
    'remove-vue-set-and-delete',
    'remove-trivial-root',
    'root-prop-to-use',
    'scoped-slots-to-slots',
    'vue-as-namespace-import',
    'vue-router-v4',
    'vuex-v4',
    'vue-class-component-v8',
    'import-composition-api-from-vue',
  ]
  try {
    const r = await runViaCli(foundPkg, workDir, KNOWN_TRANSFORMATIONS, timeoutMs)
    result.fileOutputs = r.fileOutputs
    result.errors.push(...r.errors)
    result.totalFiles = r.totalFiles
    result.modified = r.modified
    result.mode = 'cli'
    result.transformationsRun = KNOWN_TRANSFORMATIONS.length
    result.ok = r.errors.length === 0
  } catch (e: any) {
    result.skippedReason = `cli fallback also failed: ${e.message}`
  }

  return result
}

export { walkDir, SUPPORTED_EXTS }
