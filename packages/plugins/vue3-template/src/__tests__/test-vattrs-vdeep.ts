/**
 * iter-048a F2 单测: ::v-deep / /deep/ / >>> 改写 + review
 *  + v-bind="$attrs" / v-on="$listeners" review
 */
import { reviewVAttrsVListeners } from '../rules/vbind-vattrs-vlisteners.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertTransform(name: string, input: string, expected: string): void {
  const r = reviewVAttrsVListeners(input)
  if (r.out.trim() === expected.trim()) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(r.out)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     got:    ${JSON.stringify(r.out)}\n     wanted: ${JSON.stringify(expected)}`)
  }
}

function assertReview(name: string, input: string, expectedSubstr: string): void {
  const r = reviewVAttrsVListeners(input)
  if (r.changed && r.reviewItems.some(x => x.includes(expectedSubstr))) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} — expected review containing "${expectedSubstr}", got: ${JSON.stringify(r.reviewItems)}`)
    console.log(`  ✗ ${name}\n     reviews: ${JSON.stringify(r.reviewItems)}`)
  }
}

function assertNoChange(name: string, input: string): void {
  const r = reviewVAttrsVListeners(input)
  if (!r.changed) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (changed unexpectedly)\n     actual: ${JSON.stringify(r.out)}`)
    console.log(`  ✗ ${name} (changed unexpectedly)`)
  }
}

// ============ ::v-deep / /deep/ / >>> 重写 ============
console.log('\n[::v-deep rewrite]')

assertTransform(
  '::v-deep .foo → :deep(.foo)',
  `::v-deep .foo { color: red; }`,
  `:deep(.foo) { color: red; }`,
)

assertTransform(
  '/deep/ .foo → :deep(.foo)',
  `/deep/ .foo { color: red; }`,
  `:deep(.foo) { color: red; }`,
)

assertTransform(
  '>>> .foo → :deep(.foo)',
  `>>> .foo { color: red; }`,
  `:deep(.foo) { color: red; }`,
)

assertTransform(
  '多选择器 ::v-deep .a .b → :deep(.a .b)',
  `::v-deep .a .b { color: red; }`,
  `:deep(.a .b) { color: red; }`,
)

// 嵌套 — 标 review,不动
const nested = `::v-deep .a ::v-deep .b { color: red; }`
const rNested = reviewVAttrsVListeners(nested)
if (rNested.reviewItems.some(x => x.includes('嵌套'))) {
  pass++
  console.log('  ✓ 嵌套 ::v-deep 标 review 不动')
} else {
  fail++
  console.log('  ✗ 嵌套 ::v-deep 应标 review')
}

// ============ v-bind="$attrs" / v-on="$listeners" ============
console.log('\n[v-bind="$attrs" / v-on="$listeners" review]')

assertReview(
  'v-bind="$attrs" 标 review',
  `<my-input v-bind="$attrs" />`,
  'inheritAttrs',
)

assertReview(
  'v-on="$listeners" 标 review',
  `<my-input v-on="$listeners" />`,
  '已废弃',
)

assertReview(
  'v-on="$attrs" 错用 标 review',
  `<my-input v-on="$attrs" />`,
  'v-bind',
)

// ============ Regression: 不动普通模板 ============
console.log('\n[regression]')

assertNoChange(
  '无相关 attribute',
  `<div class="foo"><span :class="x">hi</span></div>`,
)

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
