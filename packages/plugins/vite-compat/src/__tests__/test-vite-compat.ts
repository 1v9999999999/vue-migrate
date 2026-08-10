/**
 * @vue-migrate/plugin-vite-compat unit tests
 * iter-045a: 浏览器/Vite 兼容性检查
 *
 * 测 5 类核心场景：
 *   1. import path from "path" → 标 review
 *   2. import fs from "fs" → 标 review
 *   3. store.dispatch("xxx/yyy", ...) → 标 review（Vuex 风格）
 *   4. store.getters.xxx → 标 review
 *   5. store.state.xxx → 标 review
 */

import { parse } from '@babel/parser'

// 直接 import 插件入口，注册后会调用 transform
import { _testable_applyNodeBuiltinReview, _testable_applyStoreContextReview } from '../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function createContext(input: string) {
  const ast = parse(input, { sourceType: 'module', allowReturnOutsideFunction: true })
  return {
    scriptAst: ast,
    source: input,
    path: '/test.js',
    changed: false,
    reviewItems: [] as string[],
    marks: [] as string[],
    kind: 'js' as const,
  }
}

function makeUtils(ctx: any) {
  return {
    markChanged: (msg?: string) => { ctx.changed = true; if (msg) ctx.marks.push(msg) },
    manualReview: (msg: string) => { ctx.reviewItems.push(msg) },
  }
}

function assertBuiltinReview(name: string, input: string, expectedReviewSubstring: string): void {
  const ctx = createContext(input)
  _testable_applyNodeBuiltinReview(ctx as any, makeUtils(ctx))
  if (ctx.reviewItems.some(r => r.includes(expectedReviewSubstring))) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input: ${JSON.stringify(input)}\n     reviewItems: ${JSON.stringify(ctx.reviewItems)}`)
    console.log(`  ✗ ${name}\n     expected review containing: ${expectedReviewSubstring}`)
  }
}

function assertStoreReview(name: string, input: string, expectedReviewSubstring: string): void {
  const ctx = createContext(input)
  _testable_applyStoreContextReview(ctx as any, makeUtils(ctx))
  if (ctx.reviewItems.some(r => r.includes(expectedReviewSubstring))) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input: ${JSON.stringify(input)}\n     reviewItems: ${JSON.stringify(ctx.reviewItems)}`)
    console.log(`  ✗ ${name}\n     expected review containing: ${expectedReviewSubstring}`)
  }
}

function assertNoBuiltinReview(name: string, input: string): void {
  const ctx = createContext(input)
  _testable_applyNodeBuiltinReview(ctx as any, makeUtils(ctx))
  if (ctx.reviewItems.length === 0) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (unexpected review): ${JSON.stringify(ctx.reviewItems)}`)
    console.log(`  ✗ ${name} (unexpected review)`)
  }
}

function assertNoStoreReview(name: string, input: string): void {
  const ctx = createContext(input)
  _testable_applyStoreContextReview(ctx as any, makeUtils(ctx))
  if (ctx.reviewItems.length === 0) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (unexpected review): ${JSON.stringify(ctx.reviewItems)}`)
    console.log(`  ✗ ${name} (unexpected review)`)
  }
}

// ============ Node 内置模块 import ============
console.log('\n[Node builtin import]')

assertBuiltinReview(
  'import path from "path"',
  `import path from "path";
const x = path.join("a", "b");`,
  'import ... from "path" 浏览器/Vite 不支持',
)

assertBuiltinReview(
  'import { join } from "path"',
  `import { join } from "path";
const x = join("a", "b");`,
  'import ... from "path"',
)

assertBuiltinReview(
  'import fs from "fs"',
  `import fs from "fs";
const x = fs.readFileSync("foo");`,
  'import ... from "fs"',
)

assertBuiltinReview(
  'import os from "os"',
  `import os from "os";
const x = os.platform();`,
  'import ... from "os"',
)

assertNoBuiltinReview(
  'import vue from "vue"（合法）',
  `import vue from "vue";`,
)

assertNoBuiltinReview(
  'import lodash from "lodash"（合法）',
  `import lodash from "lodash";`,
)

// ============ store.dispatch Vuex 风格 ============
console.log('\n[store.dispatch]')

assertStoreReview(
  'store.dispatch("xxx/yyy", payload) → review',
  `store.dispatch('user/login', { name: 'foo' });`,
  'store.dispatch("user/login"',
)

assertStoreReview(
  'store.dispatch("a/b") → review',
  `store.dispatch('settings/changeSetting', { key: 'theme', value: 'dark' });`,
  'store.dispatch("settings/changeSetting"',
)

assertNoStoreReview(
  'store.dispatch("plain")（无 namespace）→ 不动',
  `store.dispatch('reset');`,
)

// ============ store.getters / store.state ============
console.log('\n[store.getters/state]')

assertStoreReview(
  'store.getters.token → review',
  `const token = store.getters.token;`,
  'store.getters',
)

assertStoreReview(
  'store.state.user.name → review',
  `const name = store.state.user.name;`,
  'store.state',
)

assertStoreReview(
  'store.state.app.device 链式访问 → review',
  `function isMobile() {
  return store.state.app.device === 'mobile';
}`,
  'store.state',
)

assertNoStoreReview(
  'store.foo（不是 getters/state）→ 不动',
  `const x = store.foo;`,
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
