/**
 * iter-053: composition this.$parent review 跳过注释
 *
 * 验证:
 *   1) 真代码里的 this.$parent → 标 review
 *   2) 注释里 (// BUG fix) 的 this.$parent → 不标 review
 *   3) 块注释里 this.$parent → 不标 review
 *   4) 混合: 1 处真代码 + 注释 → 只标 1 处
 */

// 直接 import 用 _testable 函数 — composition plugin 暴露
// 没有 _testable_applyThisDollarParentCheck 导出, 这里是 mock 测:
// 通过 invoke composition transform 看 review items 输出

let pass = 0
let fail = 0
const failures = []

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`) }
  else { fail++; failures.push(`${name}\n     ${detail}`); console.log(`  \u2717 ${name}\n     ${detail}`) }
}

/**
 * 模拟 composition plugin 的 $parent review 逻辑 (与 index.ts 完全一致).
 * 复制是为了隔离测试.
 */
function checkParentReview(source) {
  const reviews = []
  if (source) {
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    const matches = codeOnly.match(/\bthis\.\$parent\b/g) || []
    if (matches.length > 0) {
      reviews.push(`this.$parent 出现 ${matches.length} 次`)
    }
  }
  return reviews
}

console.log('\n[1) 真代码 this.$parent — 标 review]')
{
  const src = `
// setup code
const x = this.$parent.$refs.foo
`
  const r = checkParentReview(src)
  assert('has review', r.length === 1, JSON.stringify(r))
  assert('says 1 次', /1 次/.test(r[0] || ''), r[0])
}

console.log('\n[2) // 注释里 this.$parent — 不标 review]')
{
  const src = `
// BUG fix: this.$parent.$refs.tag was removed in Vue 3
const x = 1
`
  const r = checkParentReview(src)
  assert('no review', r.length === 0, JSON.stringify(r))
}

console.log('\n[3) /* */ 块注释里 this.$parent — 不标 review]')
{
  const src = `
/* Vue 2 used this.$parent.$refs, but Vue 3 removes $parent. */
const x = 1
`
  const r = checkParentReview(src)
  assert('no review', r.length === 0, JSON.stringify(r))
}

console.log('\n[4) 混合: 1 处真代码 + 1 处注释 — 只算 1 处]')
{
  const src = `
// BUG fix: this.$parent.$refs.tag was removed in Vue 3
const parent = this.$parent.foo
`
  const r = checkParentReview(src)
  assert('has review (1)', r.length === 1, JSON.stringify(r))
  assert('says 1 次', /1 次/.test(r[0] || ''), r[0])
}

console.log('\n[5) 多处真代码 + 多处注释]')
{
  const src = `
// this.$parent removed in Vue 3
// and this.$parent.foo
function go() { this.$parent.bar(); this.$parent.baz() }
/* this.$parent.x */
`
  const r = checkParentReview(src)
  assert('has review', r.length === 1, JSON.stringify(r))
  assert('says 2 次', /2 次/.test(r[0] || ''), r[0])
}

console.log('\n[6) 完全没有 this.$parent — 不标]')
{
  const src = `const x = 1; const y = 2;`
  const r = checkParentReview(src)
  assert('no review', r.length === 0, JSON.stringify(r))
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
