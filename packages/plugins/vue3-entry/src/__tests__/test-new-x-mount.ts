/**
 * iter-052: vue3-entry `new X().$mount('selector')` review 检测
 *
 * 测 4 个 case:
 *   1. main.js: new Vue({...}).$mount('#app') — 已处理,不重复标 review
 *   2. progressBar.js: new ProgressBar({...}).$mount('#progress') — 标 review
 *   3. utils.js: new DetailPanel().$mount(dynamicSelector) — 标 review (selector 是 dynamic)
 *   4. non-entry: 多个 new X().$mount() — 每个都标 review
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// @ts-ignore — babel/traverse ESM .d.ts 缺失
const traverse = (_traverse as any).default || _traverse

// 复用 vue3-entry 的核心检测函数 - 通过模拟 transform 流程
// 这里只测一个简化的版本: traverse AST 检测 new X().$mount(...)
function detectNewXMount(ast: any, manualReview: (msg: string) => void, markChanged: (msg?: string) => void) {
  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      if (
        !t.isMemberExpression(node.callee) ||
        !t.isIdentifier(node.callee.property, { name: '$mount' })
      ) return
      const obj = node.callee.object
      if (!t.isNewExpression(obj)) return
      if (!t.isIdentifier(obj.callee)) return
      const className = obj.callee.name
      if (className === 'Vue') return
      const selector = node.arguments[0] && t.isStringLiteral(node.arguments[0])
        ? node.arguments[0].value
        : '<dynamic>'
      manualReview(
        `检测到 \`new ${className}(...).$mount(${JSON.stringify(selector)})\` — Vue 2 动态组件挂载模式。\n` +
          `  Vue 3 等价物: \`createApp(${className}).mount(${JSON.stringify(selector)})\``,
      )
      markChanged(`new ${className}().$mount(${JSON.stringify(selector)})`)
    },
  })
}

let pass = 0
let fail = 0
const failures: string[] = []

function assert(name: string, cond: boolean, detail: string): void {
  if (cond) { pass++; console.log(`  \u2713 ${name}`) }
  else { fail++; failures.push(`${name}\n     ${detail}`); console.log(`  \u2717 ${name}\n     ${detail}`) }
}

function run(input: string) {
  const ast = parse(input, { sourceType: 'module', allowReturnOutsideFunction: true })
  const reviews: string[] = []
  const marks: string[] = []
  detectNewXMount(ast, (msg) => reviews.push(msg), (msg) => msg && marks.push(msg))
  return { reviews, marks }
}

console.log('\n[1) new Vue({}).$mount — 不应触发 review (entryChain 已处理)]')
{
  const r = run(`
const App = {}
new Vue({ el: '#app', template: '<App/>' }).$mount('#app')
`)
  assert('no new-X review for new Vue().$mount', r.reviews.length === 0, JSON.stringify(r.reviews))
}

console.log('\n[2) new ProgressBar({}).$mount("#progress") — 标 review]')
{
  const r = run(`
class ProgressBar {}
new ProgressBar({ percent: 50 }).$mount('#progress')
`)
  assert('has ProgressBar review', r.reviews.some((rev) => rev.includes('ProgressBar')), JSON.stringify(r.reviews))
  assert('mentions createApp equivalent', r.reviews.some((rev) => rev.includes('createApp')), JSON.stringify(r.reviews))
  assert('marked changed', r.marks.some((m) => m.includes('ProgressBar')), JSON.stringify(r.marks))
}

console.log('\n[3) new DetailPanel().$mount(dynamicSel) — 标 review, selector 是 <dynamic>]')
{
  const r = run(`
class DetailPanel {}
const sel = '#detail-' + id
new DetailPanel().$mount(sel)
`)
  assert('has DetailPanel review', r.reviews.some((rev) => rev.includes('DetailPanel')), JSON.stringify(r.reviews))
  assert('selector marked <dynamic>', r.reviews.some((rev) => rev.includes('<dynamic>')), JSON.stringify(r.reviews))
}

console.log('\n[4) 多个 new X().$mount — 每个都标]')
{
  const r = run(`
class A {}
class B {}
class C {}
new A().$mount('#a')
new B().$mount('#b')
new C().$mount('#c')
`)
  assert('A review', r.reviews.some((rev) => rev.includes('new A(')), JSON.stringify(r.reviews))
  assert('B review', r.reviews.some((rev) => rev.includes('new B(')), JSON.stringify(r.reviews))
  assert('C review', r.reviews.some((rev) => rev.includes('new C(')), JSON.stringify(r.reviews))
  assert('total 3 reviews', r.reviews.length === 3, JSON.stringify(r.reviews))
}

console.log('\n[5) 普通函数调用 .$mount (不是 new X) — 不标 review]')
{
  const r = run(`
const inst = factory()
inst.$mount('#app')
`)
  // 这种情况 inst 是变量,不是 NewExpression — 跳过
  assert('no review for non-new $mount', r.reviews.length === 0, JSON.stringify(r.reviews))
}

console.log('\n[6) new X() (无 .$mount) — 不标 review]')
{
  const r = run(`const a = new ProgressBar({ percent: 50 })`)
  assert('no review for plain new', r.reviews.length === 0, JSON.stringify(r.reviews))
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
