/**
 * @vue-migrate/plugin-vue-router-v4 unit tests
 * iter-044a (Bug A1): `const createRouter = () => new Router({...})` wrapper 模式
 *
 * 关键场景:
 *   1. wrapper 名是 'createRouter' (跟 import 撞名) → 必须就地展开,
 *      不能走 `__routerInstance__` 中转 (否则下游 const router = createRouter()
 *      变成对 import createRouter 的无参调用, app 启动即崩)
 *   2. wrapper 名是 'router' (跟下游 const router 撞名) → 走 __routerInstance__ 中转
 *   3. 普通 `new Router({...})` (没有 wrapper) → 正常替换
 *   4. resetRouter() 用了 router.matcher → 标 manual review
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'

const _genObj: any = (_generate as any)
const _gen = _genObj.default || _genObj
const generate = (ast: any): string => _gen(ast, { comments: true, retainLines: false }).code

import { registerPlugin, getPlugins } from '@vue-migrate/core'
import './../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function runTransform(input: string): { output: string; markedChanged: boolean; reviews: string[] } {
  const ast = parse(input, { sourceType: 'module' })
  const file: any = { scriptAst: ast, source: input, path: '/test.js', transforms: [], changed: false }
  let markedChanged = false
  const reviews: string[] = []
  const ctx: any = {
    file,
    project: { stats: { manualReviewRequired: 0 } },
    utils: {
      markChanged: (msg?: string) => { markedChanged = true },
      manualReview: (r: string) => { reviews.push(r) },
    },
  }
  const plugins = getPlugins()
  const p = plugins.find((pl: any) => pl.name === 'vue-router-v4')
  if (!p) throw new Error('plugin not registered')
  p.transform(ctx)
  const output = generate(ast)
  return { output, markedChanged, reviews }
}

function assertContains(name: string, output: string, must: string[]): void {
  const missing = must.filter((s) => !output.includes(s))
  if (missing.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} — missing: ${missing.join(', ')}\n     output: ${output}`)
    console.log(`  ✗ ${name} — missing: ${missing.join(', ')}`)
  }
}

function assertNotContains(name: string, output: string, mustNot: string[]): void {
  const present = mustNot.filter((s) => output.includes(s))
  if (present.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} — present: ${present.join(', ')}\n     output: ${output}`)
    console.log(`  ✗ ${name} — present: ${present.join(', ')}`)
  }
}

// ============= Bug A1: wrapper named 'createRouter' =============
console.log('\n[Bug A1: const createRouter = () => new Router({...}) wrapper]')

{
  // 最小复现: vue-element-admin 风格的 router/index.js
  const input = `
import Vue from 'vue'
import Router from 'vue-router'
import Layout from '@/layout'

export const constantRoutes = [
  { path: '/login', component: Layout }
]

const createRouter = () => new Router({
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher
}

export default router
`
  const { output, markedChanged, reviews } = runTransform(input)

  // 关键断言:
  // 1. 没有 const createRouter = () => ... 残留
  assertNotContains('wrapper createRouter() 已删除', output, ['const createRouter = () => new Router'])
  // 2. const router = createRouter(...) 拿到了 options
  assertContains('const router = createRouter({...})', output, ['const router = createRouter('])
  assertContains('routes: constantRoutes 还在', output, ['routes: constantRoutes'])
  // 3. import 已更新
  assertContains('import createRouter from vue-router', output, ['createRouter'])
  // 4. markedChanged
  if (markedChanged) {
    pass++; console.log('  ✓ markChanged called')
  } else {
    fail++; failures.push('markChanged NOT called')
    console.log('  ✗ markChanged NOT called')
  }
  // 5. resetRouter 标 manual review
  const hasMatcherReview = reviews.some((r) => /\.matcher/.test(r))
  if (hasMatcherReview) {
    pass++; console.log('  ✓ resetRouter .matcher 标 review')
  } else {
    fail++; failures.push('resetRouter .matcher review NOT emitted')
    console.log('  ✗ resetRouter .matcher review NOT emitted')
  }
  // 6. wrapper 展开 review
  const hasWrapperReview = reviews.some((r) => /wrapper/.test(r) || /就地展开/.test(r))
  if (hasWrapperReview) {
    pass++; console.log('  ✓ wrapper 展开 review')
  } else {
    fail++; failures.push('wrapper 展开 review NOT emitted')
    console.log('  ✗ wrapper 展开 review NOT emitted')
  }
}

// ============= wrapper named 'router' (跟下游 const router 撞名) → 走 __routerInstance__ 中转 =============
console.log('\n[wrapper named "router" → __routerInstance__]')

{
  const input = `
import Vue from 'vue'
import Router from 'vue-router'

const router = () => new Router({ routes: [] })
const routerInstance = router()
export default routerInstance
`
  const { output } = runTransform(input)
  // wrapper 'router' 不能直接用 router 名字 (会跟 const routerInstance 撞)
  // 应该改名为 __routerInstance__
  assertContains('wrapper router 改名 __routerInstance__', output, ['const __routerInstance__ = createRouter('])
}

// ============= 普通 new Router({...}) 无 wrapper =============
console.log('\n[plain new Router({...})]')

{
  const input = `
import Router from 'vue-router'
const router = new Router({ routes: [] })
export default router
`
  const { output, markedChanged } = runTransform(input)
  assertContains('plain new Router → createRouter', output, ['const router = createRouter('])
  assertContains('history factory 已加', output, ['createWebHashHistory'])
  if (markedChanged) { pass++; console.log('  ✓ plain markChanged') }
  else { fail++; console.log('  ✗ plain markChanged NOT called') }
}

// ============= require.context 模式 (vue-element-admin 风格 index.js 包含 import store) =============
console.log('\n[vue-element-admin 完整 router/index.js]')

{
  // 模拟 vue-element-admin 真实结构 (前 10 行 + 关键 wrapper)
  const input = `
import Vue from 'vue'
import Router from 'vue-router'
import Layout from '@/layout'
import componentsRouter from './modules/components'
import chartsRouter from './modules/charts'

export const constantRoutes = [
  { path: '/login', component: () => import('@/views/login/index') }
]

const createRouter = () => new Router({
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher
}

export default router
`
  const { output, markedChanged, reviews } = runTransform(input)

  // 关键: 验证 output 可以 parse 通 (用 babel parse 验证)
  try {
    parse(output, { sourceType: 'module' })
    pass++; console.log('  ✓ output 可 parse 通')
  } catch (e: any) {
    fail++; failures.push(`output 不能 parse: ${e.message}\n     output: ${output}`)
    console.log(`  ✗ output 不能 parse: ${e.message?.split('\n')[0]}`)
  }

  // 验证 output 关键部分
  assertNotContains('无残留 const createRouter wrapper', output, ['const createRouter = () =>'])
  assertContains('const router = createRouter({...routes...})', output, ['const router = createRouter('])
  assertContains('routes: constantRoutes 还在', output, ['routes: constantRoutes'])
  assertNotContains('无 new Router 残留', output, ['new Router'])
  assertNotContains('无 import Router from vue-router', output, ['import Router from'])
  assertContains('导入 createRouter', output, ['createRouter'])

  if (markedChanged) { pass++; console.log('  ✓ markChanged called') }
  else { fail++; console.log('  ✗ markChanged NOT called') }
  const hasMatcherReview = reviews.some((r) => /\.matcher/.test(r))
  if (hasMatcherReview) { pass++; console.log('  ✓ .matcher manual review emitted') }
  else { fail++; console.log('  ✗ .matcher manual review missing') }
}

// ============= resetRouter 没用到 .matcher 时不应触发 .matcher review =============
console.log('\n[resetRouter 不带 .matcher]')

{
  const input = `
import Router from 'vue-router'
const createRouter = () => new Router({ routes: [] })
const router = createRouter()
export function resetRouter() {
  // 不再调 createRouter
  console.log('reset')
}
export default router
`
  const { output, reviews } = runTransform(input)
  const hasMatcherReview = reviews.some((r) => /\.matcher/.test(r))
  if (!hasMatcherReview) { pass++; console.log('  ✓ no .matcher review (correctly skipped)') }
  else { fail++; console.log('  ✗ spurious .matcher review') }
}

console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
