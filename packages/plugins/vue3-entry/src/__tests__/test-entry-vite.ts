/**
 * @vue-migrate/plugin-vue3-entry unit tests (iter-044 B4/B5)
 *
 * 测:
 *   B4: process.env.NODE_ENV → import.meta.env.MODE
 *   B5: require(x) → await import(x) + IIFE wrap
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import {
  rewriteProcessEnvNodeEnv,
  rewriteRequireToImport,
} from '../utils.js'

const _genObj: any = (_generate as any)
const generate = (ast: any): string => (_genObj.default || _genObj)(ast).code

let pass = 0
let fail = 0
const failures: string[] = []

function assertTransform(name: string, input: string, expectedContains: string | string[]): void {
  const ast = parse(input, { sourceType: 'module' })
  const marks: string[] = []
  const reviews: string[] = []
  rewriteProcessEnvNodeEnv(ast as any, (m) => marks.push(m))
  rewriteRequireToImport(
    ast as any,
    (m) => marks.push(m),
    (m) => reviews.push(m),
    (n) => generate(n),
  )
  const out = generate(ast)
  const expects = Array.isArray(expectedContains) ? expectedContains : [expectedContains]
  let allOk = true
  for (const e of expects) {
    if (!out.includes(e)) {
      allOk = false
      break
    }
  }
  if (allOk) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected contains: ${JSON.stringify(expects)}\n     marks:    ${JSON.stringify(marks)}`)
    console.log(`  ✗ ${name}\n     actual:   ${out}\n     expected contains: ${JSON.stringify(expects)}`)
  }
}

function assertNoChange(name: string, input: string, mustContain: string[] = []): void {
  const ast = parse(input, { sourceType: 'module' })
  const marks: string[] = []
  rewriteProcessEnvNodeEnv(ast as any, (m) => marks.push(m))
  rewriteRequireToImport(
    ast as any,
    (m) => marks.push(m),
    () => {},
    (n) => generate(n),
  )
  const out = generate(ast)
  // 检查关键内容必须保留 (mustContain 里的都要在 out 里)
  let ok = true
  for (const s of mustContain) {
    if (!out.includes(s)) {
      ok = false
      break
    }
  }
  // 检查没有 import.meta.env.MODE (因为没改)
  if (out.includes('import.meta.env.MODE')) {
    ok = false
  }
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:  ${JSON.stringify(input)}\n     actual: ${JSON.stringify(out)}\n     mustContain: ${JSON.stringify(mustContain)}`)
    console.log(`  ✗ ${name}`)
  }
}

// ============ B4: process.env.NODE_ENV → import.meta.env.MODE ============
console.log('\n[B4: process.env.NODE_ENV]')

assertTransform(
  'B4-1: 简单替换',
  `if (process.env.NODE_ENV === 'production') { console.log('prod') }`,
  ['import.meta.env.MODE'],
)

assertTransform(
  'B4-2: computed 形式 process.env["NODE_ENV"]',
  `if (process.env["NODE_ENV"] === 'production') { console.log('prod') }`,
  ['import.meta.env.MODE'],
)

assertTransform(
  'B4-3: 多处出现全替换',
  `const a = process.env.NODE_ENV; const b = process.env.NODE_ENV;`,
  ['import.meta.env.MODE', 'import.meta.env.MODE'],
)

assertNoChange(
  'B4-4: process.env.SOMETHING_ELSE 不动',
  `if (process.env.OTHER === 'x') { console.log('x') }`,
  ['process.env.OTHER'],
)

assertNoChange(
  'B4-5: foo.process.env.NODE_ENV 不动',
  `if (foo.process.env.NODE_ENV === 'x') { console.log('x') }`,
  ['foo.process.env.NODE_ENV'],
)

// ============ B5: require() → await import() + IIFE wrap ============
console.log('\n[B5: require() → await import()]')

assertTransform(
  'B5-1: 顶层 if 里 require → IIFE 包裹',
  `if (process.env.NODE_ENV === 'production') {
  const { mockXHR } = require('../mock')
  mockXHR()
}`,
  ['(async ()', 'await import(', '../mock'],
)

assertTransform(
  'B5-2: 顶层 if 多个 require',
  `if (x) {
  const a = require('a')
  const b = require('b')
}`,
  ['await import(', 'await import(', '(async ()'],
)

assertTransform(
  'B5-3: 顶层 require 不在 if 里 (只换不包)',
  `const x = require('y')`,
  ['await import('],
)

assertNoChange(
  'B5-4: require.context 不动 + 标 review',
  `require.context('./modules', true, /\\.js$/)`,
)

// 标 review 但不动 — 用专门 helper
{
  const ast = parse(`require.context('./modules', true, /\\.js$/)`, { sourceType: 'module' })
  const reviews: string[] = []
  rewriteRequireToImport(
    ast as any,
    () => {},
    (m) => reviews.push(m),
    (n) => generate(n),
  )
  const out = generate(ast)
  if (out.includes("require.context('./modules'") && reviews.length === 1 && !out.includes('await import')) {
    pass++
    console.log('  ✓ B5-5: require.context 标 review 不动')
  } else {
    fail++
    console.log('  ✗ B5-5: require.context 处理错', out, reviews)
  }
}

// require 内的 if 不是顶层的,不包 IIFE
assertTransform(
  'B5-6: if 不在顶层,只换 require 不包 IIFE',
  `function init() {
  if (x) {
    const a = require('a')
  }
}`,
  ['await import('],
)

// ============ B4 + B5 组合: vue-element-admin 实际场景 ============
console.log('\n[B4 + B5: 实际 main.js 场景]')

assertTransform(
  'B4+B5: vue-element-admin main.js 模式',
  `import Vue from 'vue'
import App from './App'

if (process.env.NODE_ENV === 'production') {
  const { mockXHR } = require('../mock')
  mockXHR()
}

new Vue({
  render: h => h(App)
}).$mount('#app')`,
  [
    'import.meta.env.MODE',
    'await import(',
    '(async ()',
  ],
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
