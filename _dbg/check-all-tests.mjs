#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const TSX = join(ROOT, 'packages', 'cli', 'node_modules', '.bin', 'tsx.cmd')

const testFiles = [
  'tools/baseline-comparator/src/__tests__/metrics.test.ts',
  'tools/regression-suite/src/__tests__/compare.test.ts',
  'tools/sample-collector/src/__tests__/classify.test.ts',
  'tools/scheduler/src/__tests__/state-machine.test.ts',
  'packages/plugins/vue3-template/src/__tests__/test-editor.ts',
  'packages/plugins/vue3-template/src/__tests__/test-native-modifier.ts',
  'packages/plugins/vue3-template/src/__tests__/test-prefix-icon.ts',
  'packages/plugins/vue3-template/src/__tests__/test-vattrs-vdeep.ts',
  'packages/plugins/vxe-table/src/__tests__/test-vxe-table.ts',
  'packages/plugins/package-json/src/__tests__/test-package-json.ts',
  'packages/plugins/vue3-entry/src/__tests__/test-remove-vue-import.ts',
  'packages/plugins/composition/src/__tests__/test-lang-output.ts',
  'packages/plugins/composition/src/__tests__/test-define-emits.ts',
  'packages/plugins/composition/src/__tests__/test-merge-imports.ts',
  'packages/plugins/import-cleaner/src/__tests__/test-import-cleaner.ts',
  'packages/plugins/vue3-directives/src/__tests__/test-directive-install-rewrite.ts',
  'packages/plugins/vue3-directives/src/__tests__/test-directive-vnode-binding.ts',
  'packages/plugins/vue3-directives/src/__tests__/test-directive-auto-register.ts',
  'packages/plugins/vue3-directives/src/__tests__/test-directive-auto-register-f6.ts',
  'packages/plugins/3rd-party-imports/src/__tests__/test-3rd-party-iter048a.ts',
  'packages/plugins/vite-compat/src/__tests__/test-vite-compat.ts',
  'packages/plugins/store-bridge/src/__tests__/test-store-bridge.ts',
  'packages/plugins/vite-scaffold/src/__tests__/test-vite-scaffold.ts',
  'packages/plugins/resource-copier/src/__tests__/test-resource-copier.ts',
  'packages/plugins/this-replacer/src/__tests__/test-this-replacer.ts',
  'packages/plugins/vue3-entry/src/__tests__/test-new-x-mount.ts',
  'packages/plugins/composition/src/__tests__/test-recursive-method.mjs',
]

let totalPass = 0
let totalFail = 0
for (const testFile of testFiles) {
  const res = spawnSync('cmd.exe', ['/c', TSX, testFile], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true,
  })
  const stdout = res.stdout || ''
  const passMatch = stdout.match(/pass (\d+)/)
  const failMatch = stdout.match(/fail (\d+)/)
  const testsMatch = stdout.match(/tests (\d+)/)
  const pass = passMatch ? parseInt(passMatch[1]) : 0
  const fail = failMatch ? parseInt(failMatch[1]) : 0
  const total = testsMatch ? parseInt(testsMatch[1]) : 0
  totalPass += pass
  totalFail += fail
  const status = fail === 0 ? '✓' : '✗'
  const name = testFile.split('/').slice(-2).join('/')
  console.log(`  ${status} ${name.padEnd(60)}: pass=${pass}/${total} fail=${fail}`)
  if (fail > 0) {
    const lines = stdout.split('\n').filter(l => l.includes('fail') || l.includes('error')).slice(0, 5)
    for (const l of lines) console.log(`      ${l.trim()}`)
  }
}
console.log(`\n  TOTAL: pass=${totalPass} fail=${totalFail}`)
process.exit(totalFail > 0 ? 1 : 0)
