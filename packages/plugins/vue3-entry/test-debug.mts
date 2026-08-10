#!/usr/bin/env node
/**
 * Debug: run plugins + generate code WITHOUT self-check, dump to file.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import _generate from '../../core/node_modules/@babel/generator/lib/index.js'
import _traverse from '../../core/node_modules/@babel/traverse/lib/index.js'
import { parse as parseBabel } from '../../core/node_modules/@babel/parser/lib/index.js'

const generate = (_generate as any).default || _generate
const traverse = (_traverse as any).default || _traverse

const { runPipeline, _reset } = await import('../../core/src/index.ts')
await import('../vue2-compat/src/index.ts')
await import('./src/index.ts')

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcFile = resolve(__dirname, '../../../examples/vue2-sample/src/main-full.js')
const src = await readFile(srcFile, 'utf-8')

// Parse
const ast = parseBabel(src, { sourceType: 'module', plugins: ['jsx', 'typescript'] })

// Apply both plugins
import { createTransformContext } from '../../core/src/context.ts'
import { getPlugins } from '../../core/src/plugin.ts'

// Setup minimal ctx
const file = {
  path: srcFile,
  relativePath: 'main-full.js',
  kind: 'js' as const,
  source: src,
  scriptAst: ast,
  metadata: {
    features: ['options-api', 'options-data'],
    dependencies: [],
    isEntry: true,
  },
  transforms: [],
  changed: false,
}

const project = {
  root: resolve(__dirname, '../../../examples/vue2-sample/src'),
  files: new Map([[srcFile, file]]),
  dependencyGraph: new Map(),
  typeCache: new Map(),
  plugins: getPlugins().filter(p => p.name === 'vue2-compat' || p.name === 'vue3-entry'),
  stats: { totalFiles: 1, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
  config: { dryRun: true },
}

// Run plugins
for (const plugin of project.plugins) {
  const ctx = createTransformContext(file, project)
  await plugin.transform!(ctx)
  file.transforms.push({
    plugin: plugin.name,
    message: (ctx as any).__lastMessage || 'transformed',
    changed: (ctx as any).__changed || false,
  })
  if ((ctx as any).__changed) {
    file.changed = true
  }
}

// Generate
const out = generate(file.scriptAst, { retainLines: true, comments: true, compact: false }).code + '\n'
console.log('=== GENERATED CODE ===')
console.log(out)

// Try to reparse
try {
  parseBabel(out, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  console.log('=== REPARSE OK ===')
} catch (e: any) {
  console.log('=== REPARSE FAILED ===')
  console.log(e.message)
}

// Write to file for inspection
const outFile = resolve(__dirname, '../../../examples/vue2-sample/dist-vue3-entry/main-full.js')
await mkdir(dirname(outFile), { recursive: true })
await writeFile(outFile, out, 'utf-8')
console.log(`Wrote to ${outFile}`)
