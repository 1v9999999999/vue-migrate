#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const TSC = join(ROOT, 'packages', 'core', 'node_modules', '.bin', 'tsc.cmd')

const packages = [
  { name: 'core', path: 'packages/core/tsconfig.json' },
  { name: 'cli', path: 'packages/cli/tsconfig.json' },
  { name: 'composition', path: 'packages/plugins/composition/tsconfig.json' },
  { name: 'elementui', path: 'packages/plugins/elementui/tsconfig.json' },
  { name: 'vue-router-v4', path: 'packages/plugins/vue-router-v4/tsconfig.json' },
  { name: 'vue2-compat', path: 'packages/plugins/vue2-compat/tsconfig.json' },
  { name: 'vue3-directives', path: 'packages/plugins/vue3-directives/tsconfig.json' },
  { name: 'vue3-entry', path: 'packages/plugins/vue3-entry/tsconfig.json' },
  { name: 'vue3-template', path: 'packages/plugins/vue3-template/tsconfig.json' },
  { name: 'vue3-types', path: 'packages/plugins/vue3-types/tsconfig.json' },
  { name: 'vuex-pinia', path: 'packages/plugins/vuex-pinia/tsconfig.json' },
  { name: 'store-bridge', path: 'packages/plugins/store-bridge/tsconfig.json' },
  { name: 'vxe-table', path: 'packages/plugins/vxe-table/tsconfig.json' },
  { name: 'package-json', path: 'packages/plugins/package-json/tsconfig.json' },
  { name: 'vite-compat', path: 'packages/plugins/vite-compat/tsconfig.json' },
  { name: 'vite-scaffold', path: 'packages/plugins/vite-scaffold/tsconfig.json' },
  { name: 'resource-copier', path: 'packages/plugins/resource-copier/tsconfig.json' },
]

let totalErrors = 0
for (const pkg of packages) {
  const res = spawnSync('cmd.exe', ['/c', TSC, '--noEmit', '-p', pkg.path], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true,
  })
  const lines = (res.stdout || '').trim().split('\n').filter(l => l.includes('error TS'))
  const errCount = lines.length
  totalErrors += errCount
  const status = errCount === 0 ? '✓' : '✗'
  console.log(`  ${status} ${pkg.name.padEnd(20)}: ${errCount} errors`)
  if (errCount > 0 && errCount <= 5) {
    for (const line of lines) console.log(`      ${line.trim()}`)
  }
}
console.log(`\n  TOTAL: ${totalErrors} errors`)
process.exit(totalErrors > 0 ? 1 : 0)
