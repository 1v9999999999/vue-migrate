#!/usr/bin/env node
/**
 * iter-078 0-regression 验证 (v2, 修正后)
 *
 * 6 pattern + 1 fixed:
 *   - el-icon transform:        iter-058=11, iter-078=?
 *   - store-bridge useXxxStore: iter-058=128 (only useAppStore), iter-078=?
 *   - store-bridge useAppStore: iter-058=128, iter-078=?
 *   - defineProps inject:       iter-058=45, iter-078=?
 *   - __refsMap (C2 fix):       iter-058=N, iter-078=?
 *
 * 已知: iter-058 的 mixins/this-replacer review 计数 (9/10) 来自更宽松的 regex
 * (匹配 `// review` 注释或 word 'review' 出现在源码中),不可靠。
 * 用更精确的 marker 模式 (composition 添加的 `// iter-NNN-fixed:` / `// <plugin>
 * <action>` 注释前缀) 替代。
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: node iter-078-counts.mjs <out-dir>')
  process.exit(2)
}

const PATTERNS = {
  'el-icon transform': /<el-icon[\s>]/g,
  'store-bridge useXxxStore (any)': /\buse[A-Z][A-Za-z0-9]*Store\b/g,
  'store-bridge useAppStore (legacy count)': /\buseAppStore\b/g,
  'defineProps inject': /defineProps\s*[(<]/g,
  '__refsMap (C2 compat)': /__refsMap\s*=/g,
  'composition review markers': /\/\/\s*\[composition[^\]]*\]\s*review/gi,
  'this-replacer review markers': /\/\/\s*\[this-replacer[^\]]*\]\s*review/gi,
}

async function walk(dir) {
  const out = []
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue
      out.push(...await walk(p))
    } else if (e.isFile() && /\.(vue|js|ts)$/.test(e.name)) {
      out.push(p)
    }
  }
  return out
}

const files = await walk(outDir)
console.log(`Scanning ${files.length} files in ${outDir}\n`)

const results = {}
for (const [name, re] of Object.entries(PATTERNS)) {
  let count = 0
  for (const f of files) {
    let content
    try { content = await readFile(f, 'utf-8') } catch { continue }
    const m = content.match(re)
    if (m) count += m.length
  }
  results[name] = count
}

const EXPECTED_FROM_ITER_058 = {
  'el-icon transform': 11,
  'store-bridge useAppStore (legacy count)': 128,
  'defineProps inject': 45,
}

console.log('Pattern'.padEnd(45) + 'iter-058'.padEnd(12) + 'iter-078'.padEnd(12) + 'Delta')
console.log('─'.repeat(80))
for (const [name, re] of Object.entries(PATTERNS)) {
  const got = results[name]
  const expected = EXPECTED_FROM_ITER_058[name]
  if (expected !== undefined) {
    const delta = got - expected
    const ok = delta === 0 ? '±0 ✓' : (delta > 0 ? `+${delta}` : `${delta}`)
    console.log(name.padEnd(45) + String(expected).padEnd(12) + String(got).padEnd(12) + ok)
  } else {
    console.log(name.padEnd(45) + '(new)'.padEnd(12) + String(got).padEnd(12) + '—')
  }
}

const regressions = Object.keys(EXPECTED_FROM_ITER_058).filter(name => {
  const expected = EXPECTED_FROM_ITER_058[name]
  return results[name] !== expected
})

console.log('\n' + (regressions.length === 0
  ? '✅ 0 regression (3 verifiable patterns all match iter-058 baseline)'
  : `⚠️ patterns need review: ${regressions.join(', ')}`))
