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
  'packages/plugins/vxe-table/src/__tests__/test-vxe-table.ts',
  'packages/plugins/package-json/src/__tests__/test-package-json.ts',
  'packages/plugins/vue3-entry/src/__tests__/test-remove-vue-import.ts',
  'packages/plugins/composition/src/__tests__/test-lang-output.ts',
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
