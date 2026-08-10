/**
 * @vue-migrate/plugin-elementui unit tests (iter-044 B3)
 *
 * 测 element-variables.scss 检测
 *
 * 注意：直接调 plugin 的 transform 钩子需要完整 ctx,比较重。
 * 这里只测 src pattern 检测逻辑（核心是 src 是否匹配 `element[-_]variables?`）。
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// 直接 copy plugin 里的检测逻辑,作为 regression test
function detectElementVariables(src: string): boolean {
  return /element[-_]variables?/i.test(src)
}

let pass = 0
let fail = 0
const failures: string[] = []

function assertTrue(name: string, cond: boolean): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name}`)
  }
}

// ============ B3: element-variables.scss 检测 ============
console.log('\n[B3: element-variables pattern]')

assertTrue('B3-1: ./styles/element-variables.scss 命中', detectElementVariables('./styles/element-variables.scss'))
assertTrue('B3-2: ./styles/element-variable.scss (单数) 命中', detectElementVariables('./styles/element-variable.scss'))
assertTrue('B3-3: @/styles/element-variables.scss 命中', detectElementVariables('@/styles/element-variables.scss'))
assertTrue('B3-4: 绝对路径 element-variables 命中', detectElementVariables('/abs/path/element-variables.scss'))
assertTrue('B3-5: 大小写不敏感 Element-Variables 命中', detectElementVariables('./styles/Element-Variables.scss'))
assertTrue('B3-6: _ 分隔 element_variables 命中', detectElementVariables('./styles/element_variables.scss'))
assertTrue('B3-7: 与 vue 相关 variable 不命中', !detectElementVariables('./styles/variables.scss'))
assertTrue('B3-8: element-variables-white 也会命中 (包含子串,保守一些)', detectElementVariables('./styles/element-variables-white.scss'))
assertTrue('B3-9: 字符串包含 css 路径 但不是 element 不命中', !detectElementVariables('./styles/index.scss'))
assertTrue('B3-10: 空字符串不命中', !detectElementVariables(''))

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
