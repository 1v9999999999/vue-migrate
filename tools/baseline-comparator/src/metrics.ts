/**
 * tools/baseline-comparator/src/metrics.ts
 *
 * 计算 vue-migrate 输出 vs 官方 codemod 输出的对比指标。
 *
 * 5 个指标（每个 ∈ [0, 1]，越高代表"我们越好"或"越接近官方"）：
 *   - compileOk        双方都能被 babel-parser 解析的文件比例
 *   - astEquivalent    AST 节点类型 + 关键属性的 Jaccard 相似度
 *   - semanticDiff     Vue3 友好度（好的 API 调用比例）
 *   - runtimeSafe      import 路径 / 注册方式的"运行时安全"比例
 *   - reviewDelta      我们的 review 数 - 官方 review 数（越低越好，0 = 平）
 *   - reviewCount      我们的 review 数（运行后由 runner 覆盖）
 *   - officialReviewCount 官方 review 数（运行后由 runner 覆盖）
 */

import { parse } from '@babel/parser'

export interface ComparisonMetrics {
  /** (0..1) 双方都能 parse 的文件比例 */
  compileOk: number
  /** (0..1) AST 结构相似度（Jaccard） */
  astEquivalent: number
  /** 我们的 review 数（由 runner 覆盖） */
  reviewCount: number
  /** 官方 review 数（由 runner 覆盖） */
  officialReviewCount: number
  /** reviewCount - officialReviewCount（越低越好） */
  reviewDelta: number
  /** (0..1) Vue3 语义友好度 */
  semanticDiff: number
  /** (0..1) import 路径 / 注册方式的运行时安全度 */
  runtimeSafe: number
  /** 调试信息 */
  details: {
    totalFiles: number
    filesInBoth: number
    filesOnlyInOurs: number
    filesOnlyInOfficial: number
    parseFailed: { ours: string[]; official: string[] }
  }
}

// ============ 1. parse 辅助 ============

/**
 * 解析一段代码。.vue 文件提取 <script> 块。
 * 返回 null 表示解析失败。
 */
function tryParse(code: string, filePath: string): { ok: boolean; ast?: any; scriptContent?: string } {
  if (filePath.toLowerCase().endsWith('.vue')) {
    // 提取 <script> 块（不处理 <script setup>，babel parser 能直接吃）
    const scriptMatch = extractVueScript(code)
    if (!scriptMatch) {
      // 没有任何 script 块（纯模板文件），算作"空但合法"
      return { ok: true, scriptContent: '' }
    }
    const { content } = scriptMatch
    try {
      const ast = parse(content, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: ['jsx', 'typescript'],
        errorRecovery: true,
      })
      return { ok: true, ast, scriptContent: content }
    } catch {
      return { ok: false, scriptContent: content }
    }
  }
  try {
    const ast = parse(code, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      plugins: ['jsx', 'typescript'],
      errorRecovery: true,
    })
    return { ok: true, ast }
  } catch {
    return { ok: false }
  }
}

function extractVueScript(code: string): { content: string; setup: boolean } | null {
  // 简单提取（不追求 100% 严谨，但够用）
  const m = code.match(/<script\b([^>]*)>([\s\S]*?)<\/script>/i)
  if (!m) return null
  const attrs = m[1] ?? ''
  const setup = /\bsetup\b/.test(attrs)
  return { content: m[2] ?? '', setup }
}

// ============ 2. AST hash ============

/**
 * 递归生成一个 AST 的"结构化 multiset hash"：
 *   - 每个节点 → "NodeType|key1=v1,key2=v2"
 *   - 用 Map<string, number> 计数（multiset）
 *
 * 关键属性白名单：避免被注释/位置/原始字符串干扰。
 */
const INTERESTING_KEYS = new Set([
  'name', 'value', 'operator', 'kind', 'prefix', 'raw',
  'sourceType', 'importKind', 'exportKind', 'computed',
  'method', 'shorthand', 'async', 'generator', 'static',
])

function hashAst(ast: any): Map<string, number> {
  const counter = new Map<string, number>()
  function visit(node: any): void {
    if (!node || typeof node !== 'object' || !node.type) return
    const key = buildKey(node)
    counter.set(key, (counter.get(key) ?? 0) + 1)
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end' || k === 'range' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments' || k === 'extra' || k === 'tokens') continue
      const v = (node as any)[k]
      if (Array.isArray(v)) {
        for (const child of v) {
          if (child && typeof child === 'object' && child.type) visit(child)
        }
      } else if (v && typeof v === 'object' && v.type) {
        visit(v)
      }
    }
  }
  visit(ast)
  return counter
}

function buildKey(node: any): string {
  const parts: string[] = [node.type]
  for (const k of INTERESTING_KEYS) {
    if (k in node && node[k] !== undefined && node[k] !== null) {
      const v = node[k]
      parts.push(`${k}=${typeof v === 'string' ? v : String(v)}`)
    }
  }
  return parts.join('|')
}

function jaccard(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 && b.size === 0) return 1
  let inter = 0
  let union = 0
  const allKeys = new Set([...a.keys(), ...b.keys()])
  for (const k of allKeys) {
    const ca = a.get(k) ?? 0
    const cb = b.get(k) ?? 0
    inter += Math.min(ca, cb)
    union += Math.max(ca, cb)
  }
  return union === 0 ? 1 : inter / union
}

// ============ 3. semantic diff ============

/**
 * Vue3 友好度 = good 出现次数 / (good + bad)
 * 范围 (0..1]，没有匹配时返回 0.5（中性）
 */
const BAD_PATTERNS: RegExp[] = [
  /import\s+Vue\s+from\s+['"]vue['"]/,
  /\bnew\s+Vue\s*\(/,
  /\bVue\.component\s*\(/,
  /\bVue\.use\s*\(/,
  /\bVue\.mixin\s*\(/,
  /\bVue\.directive\s*\(/,
  /\bVue\.filter\s*\(/,
  /\bVue\.prototype\b/,
  /\bVue\.config\./,
  /\bVue\.observable\s*\(/,
  /\bVue\.nextTick\s*\(/,
  /\bfrom\s+['"]element-ui['"]/,
  /\bfrom\s+['"]element-ui\//,
  /\bfrom\s+['"]@vue\/composition-api['"]/,
  /\bimport\s+Vuex\s+from\s+['"]vuex['"]/,
  /\bimport\s+VueRouter\s+from\s+['"]vue-router['"]/,
]

const GOOD_PATTERNS: RegExp[] = [
  /\bdefineComponent\s*\(/,
  /<script\s+setup\b/,
  /\bcreateApp\s*\(/,
  /\bapp\.component\s*\(/,
  /\bapp\.use\s*\(/,
  /\bimport\s+\{[^}]*createApp[^}]*\}\s+from\s+['"]vue['"]/,
  /\bimport\s+\{[^}]*defineComponent[^}]*\}\s+from\s+['"]vue['"]/,
  /\bimport\s+\{[^}]*ref\s+[^}]*\}\s+from\s+['"]vue['"]/,
  /\bimport\s+\{[^}]*reactive\s+[^}]*\}\s+from\s+['"]vue['"]/,
  /\bfrom\s+['"]element-plus['"]/,
  /\bcreateStore\s*\(/,
  /\bcreateRouter\s*\(/,
  /\bsetup\s*\(\s*\)\s*\{/,
]

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0
  for (const p of patterns) {
    const m = text.match(new RegExp(p.source, p.flags + 'g'))
    if (m) n += m.length
  }
  return n
}

function semanticDiffScore(text: string): number {
  const good = countMatches(text, GOOD_PATTERNS)
  const bad = countMatches(text, BAD_PATTERNS)
  const total = good + bad
  if (total === 0) return 0.5
  return good / total
}

// ============ 4. runtime safety ============

/**
 * 检查 import 路径 / 注册方式。
 *  - 'vue' 名空间 import 或 named import → 合法
 *  - 'element-ui' / 'element-ui/*' → 不合法（应换 'element-plus'）
 *  - 'vuex' 默认 import + new Vuex.Store → 不合法
 *  - 'vue-router' 默认 import + new VueRouter → 不合法
 *  - 其他（如 lodash、自家 utils）→ 合法
 */
function runtimeSafeScore(text: string): { safe: number; total: number; score: number } {
  // 收集所有 import 源
  const importSources: string[] = []
  const importRe = /\bimport\s+[^;'"]*?from\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = importRe.exec(text))) {
    importSources.push(m[1])
  }
  // 收集 require 源（兼容老代码）
  const requireRe = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = requireRe.exec(text))) {
    importSources.push(m[1])
  }

  if (importSources.length === 0) {
    return { safe: 0, total: 0, score: 1.0 }
  }

  let safe = 0
  for (const src of importSources) {
    if (isSafeImport(text, src)) safe++
  }

  return { safe, total: importSources.length, score: safe / importSources.length }
}

function isSafeImport(text: string, src: string): boolean {
  // 相对路径、绝对路径、包名带作用域 → 默认合法
  if (src.startsWith('.') || src.startsWith('/') || src.startsWith('D:') || src.startsWith('d:')) {
    return true
  }
  if (src === 'vue') {
    // 默认 import Vue from 'vue' 是不安全的
    if (/import\s+Vue\s+from\s+['"]vue['"]/.test(text)) return false
    // import Vue, { createApp } from 'vue' → 算 ok（兼容性写法）
    if (/import\s+Vue\s*,\s*\{/.test(text)) return true
    // 其他（import * as Vue, import { createApp }）→ ok
    return true
  }
  if (src === 'element-ui' || src.startsWith('element-ui/')) {
    return false
  }
  if (src === 'vuex') {
    // 默认 import Vuex + new Vuex.Store → 不安全
    if (/import\s+Vuex\s+from/.test(text) && /\bnew\s+Vuex\.Store\b/.test(text)) return false
    return true
  }
  if (src === 'vue-router') {
    if (/import\s+VueRouter\s+from/.test(text) && /\bnew\s+VueRouter\b/.test(text)) return false
    return true
  }
  if (src === '@vue/composition-api') return false
  return true
}

// ============ 5. 聚合入口 ============

/**
 * 对比两个 map，输出 ComparisonMetrics。
 * reviewCount / officialReviewCount 始终为 0，由 runner.ts 覆盖。
 */
export async function compareOutputs(
  ourOutput: Map<string, string>,
  officialOutput: Map<string, string>,
): Promise<ComparisonMetrics> {
  const allPaths = new Set<string>([...ourOutput.keys(), ...officialOutput.keys()])
  const totalFiles = allPaths.size

  let bothParse = 0
  let astSum = 0
  let astCount = 0
  let semanticSum = 0
  let runtimeSafeTotal = 0
  let runtimeSafeValid = 0

  const parseFailed: { ours: string[]; official: string[] } = { ours: [], official: [] }
  const filesOnlyInOurs: string[] = []
  const filesOnlyInOfficial: string[] = []
  let filesInBoth = 0

  for (const path of allPaths) {
    const ourCode = ourOutput.get(path)
    const offCode = officialOutput.get(path)

    if (ourCode === undefined) {
      filesOnlyInOfficial.push(path)
      // 官方有的文件：也跑下 semantic/runtimeSafe，公平起见计入分母
      if (offCode !== undefined) {
        semanticSum += semanticDiffScore(offCode)
        const rs = runtimeSafeScore(offCode)
        runtimeSafeTotal += rs.total
        runtimeSafeValid += rs.safe
      }
      continue
    }
    if (offCode === undefined) {
      filesOnlyInOurs.push(path)
      semanticSum += semanticDiffScore(ourCode)
      const rs = runtimeSafeScore(ourCode)
      runtimeSafeTotal += rs.total
      runtimeSafeValid += rs.safe
      continue
    }

    filesInBoth++

    // parse 双方
    const ourParse = tryParse(ourCode, path)
    const offParse = tryParse(offCode, path)
    if (!ourParse.ok) parseFailed.ours.push(path)
    if (!offParse.ok) parseFailed.official.push(path)
    if (ourParse.ok && offParse.ok) bothParse++

    // AST 结构相似度（仅双方都能 parse 时算）
    if (ourParse.ok && offParse.ok && ourParse.ast && offParse.ast) {
      const h1 = hashAst(ourParse.ast)
      const h2 = hashAst(offParse.ast)
      astSum += jaccard(h1, h2)
      astCount++
    }

    // semantic 友好度：取我方
    semanticSum += semanticDiffScore(ourCode)

    // runtimeSafe：取我方
    const rs = runtimeSafeScore(ourCode)
    runtimeSafeTotal += rs.total
    runtimeSafeValid += rs.safe
  }

  const compileOk = totalFiles === 0 ? 1 : bothParse / totalFiles
  const astEquivalent = astCount === 0 ? (totalFiles === 0 ? 1 : 0) : astSum / astCount
  const semanticDiff = totalFiles === 0 ? 0.5 : semanticSum / totalFiles
  const runtimeSafe = runtimeSafeTotal === 0 ? 1 : runtimeSafeValid / runtimeSafeTotal

  return {
    compileOk,
    astEquivalent,
    reviewCount: 0,
    officialReviewCount: 0,
    reviewDelta: 0,
    semanticDiff,
    runtimeSafe,
    details: {
      totalFiles,
      filesInBoth,
      filesOnlyInOurs: filesOnlyInOurs.length,
      filesOnlyInOfficial: filesOnlyInOfficial.length,
      parseFailed,
    },
  }
}

// ============ 6. 便捷：直接读盘对比 ============

export async function compareFromDirs(
  ourDir: string,
  officialDir: string,
): Promise<ComparisonMetrics> {
  const { readAllFiles } = await import('./run-official.js')
  const [ours, off] = await Promise.all([
    readAllFiles(ourDir),
    readAllFiles(officialDir),
  ])
  return compareOutputs(ours, off)
}

// 暴露给测试 / 内部用
export const _internal = {
  tryParse,
  extractVueScript,
  hashAst,
  jaccard,
  semanticDiffScore,
  runtimeSafeScore,
  countMatches,
}
