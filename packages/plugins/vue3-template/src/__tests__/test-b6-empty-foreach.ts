/**
 * @vue-migrate/plugin-vue3-template unit tests (iter-044 B6)
 *
 * B6: `Object.keys(x).forEach(<empty-callback>)` 整行删除
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import { migrateScriptInstances } from '../rules/script-instances.js'

const _genObj: any = (_generate as any)
const generate = (ast: any): string => (_genObj.default || _genObj)(ast).code

let pass = 0
let fail = 0
const failures: string[] = []

function assertB6(name: string, input: string, expectRemoved: boolean, mustContain: string[] = [], mustNotContain: string[] = []): void {
  const ast = parse(input, { sourceType: 'module' })
  const reviews: string[] = []
  const result = migrateScriptInstances(ast, (m) => reviews.push(m))
  const out = generate(ast)

  let ok = true
  if (expectRemoved) {
    if (out.includes('Object.keys(filters).forEach') || out.includes('.forEach(key => {})')) {
      ok = false
    }
  } else {
    if (!out.includes('.forEach')) {
      ok = false
    }
  }
  for (const s of mustContain) {
    if (!out.includes(s)) { ok = false; break }
  }
  for (const s of mustNotContain) {
    if (out.includes(s)) { ok = false; break }
  }
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:  ${JSON.stringify(input)}\n     actual: ${JSON.stringify(out)}`)
    console.log(`  ✗ ${name}\n     actual: ${out}`)
  }
}

// ============ B6: 空 forEach 检测 ============
console.log('\n[B6: empty forEach]')

// 1) 最简形式 — 空 arrow body
assertB6(
  'B6-1: 简写空 arrow () => {}',
  `Object.keys(filters).forEach(key => {});`,
  true,
)

// 2) 完整 form — 空 block
assertB6(
  'B6-2: 空 block 空 body',
  `Object.keys(filters).forEach(key => {
  });`,
  true,
)

// 3) 非空 body — 不删
assertB6(
  'B6-3: body 有内容不删',
  `Object.keys(filters).forEach(key => {
  console.log(key)
});`,
  false,
  ['console.log(key)'],
)

// 4) Vue.filter 调用 (vue3-entry 会清掉,但 vue3-template 跑前可能还有)
assertB6(
  'B6-4: 完整 main.js 模式 (含 Vue.filter)',
  `Object.keys(filters).forEach(key => {
  Vue.filter(key, filters[key])
})`,
  false, // 没清空,body 还有内容
  ['Vue.filter(key, filters[key])'],
)

// 5) Vue.filter 已被 vue3-entry 清掉 (实际场景)
assertB6(
  'B6-5: body 已被 vue3-entry 清空 (实际场景)',
  `Object.keys(filters).forEach(key => {});`,
  true,
)

// 6) 其他对象 (不是 filters)
assertB6(
  'B6-6: 非 filters 对象的空 forEach 也删',
  `Object.keys(others).forEach(k => {});`,
  true,
)

// 7) 顶层 forEach 才删,if 里的不删
assertB6(
  'B6-7: if 里的空 forEach 保守不删',
  `if (x) {
  Object.keys(filters).forEach(key => {});
}`,
  false,
  ['Object.keys(filters).forEach(key => {})'],
)

// 8) function 形式 空 body 也删
assertB6(
  'B6-8: function 表达式 空 body',
  `Object.keys(filters).forEach(function(key) {});`,
  true,
)

// 9) return undefined 也算空
assertB6(
  'B6-9: return undefined 算空',
  `Object.keys(filters).forEach(key => { return undefined });`,
  true,
)

// 10) return 实际值 不删
assertB6(
  'B6-10: return 实际值 不删',
  `Object.keys(filters).forEach(key => { return key + 1 });`,
  false,
  ['return key + 1'],
)

// 11) 非 Object.keys 调用 不删
assertB6(
  'B6-11: 非 Object.keys 调用不删',
  `Object.values(filters).forEach(key => {});`,
  false, // values 不在规则内,保留
  ['Object.values(filters).forEach(key => {})'],
)

// 12) 多个 forEach 都能清
assertB6(
  'B6-12: 多个空 forEach 都清',
  `Object.keys(filters).forEach(key => {});
Object.keys(other).forEach(k => {});`,
  true,
  [],
  ['forEach'],
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
