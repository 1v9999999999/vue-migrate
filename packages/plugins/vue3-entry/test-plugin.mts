#!/usr/bin/env node
/**
 * Standalone test runner for vue3-entry plugin.
 * Run with: cd vue-migrate && cd packages/cli && node_modules/.bin/tsx ../../packages/plugins/vue3-entry/test-plugin.mts
 */

import { readFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Dynamic imports (top-level await)
const { runPipeline, listPluginNames } = await import('../../core/src/index.ts')
await import('../vue2-compat/src/index.ts')  // vue2-compat pre-req
await import('./src/index.ts')  // vue3-entry (the plugin under test)

console.log('Registered plugins:', listPluginNames())

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = resolve(__dirname, '../../../examples/vue2-sample/src')
const outDir = resolve(__dirname, '../../../examples/vue2-sample/dist-vue3-entry')
const srcFile = join(srcDir, 'main-full.js')

await mkdir(outDir, { recursive: true })

console.log('\n--- 1. Input (' + srcFile + ') ---')
const input = await readFile(srcFile, 'utf-8')
console.log(input)

console.log('\n--- 2. Running pipeline (plugins: vue3-entry + vue2-compat) ---')
const ctx = await runPipeline({ root: srcDir, outDir, plugins: ['vue2-compat', 'vue3-entry'] })

console.log('\n--- 3. Per-file transforms ---')
for (const [, file] of ctx.files) {
  console.log(`\n[${file.relativePath}] (kind=${file.kind}, hasAst=${!!file.scriptAst}, isEntry=${file.metadata.isEntry})`)
  for (const t of file.transforms) {
    const mark = t.changed ? '✓' : (t.error ? '✗' : '·')
    console.log(`  ${mark} ${t.plugin}: ${t.message}${t.error ? ' ERROR=' + t.error : ''}`)
  }
}

console.log('\n--- 4. Output ---')
const outFile = join(outDir, 'main-full.js')
try {
  const out = await readFile(outFile, 'utf-8')
  console.log(out)
} catch (e: any) {
  console.error('Failed to read output:', e.message)
}
