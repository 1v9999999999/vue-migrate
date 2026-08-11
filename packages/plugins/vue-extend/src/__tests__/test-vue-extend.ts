/**
 * @vue-migrate/plugin-vue-extend unit tests
 * iter-051
 *
 * 6 个核心场景 (只测自递归检测 — new X().$mount 由 vue3-entry iter-052 覆盖):
 *   1) setCurrentView 自递归 — 标 review
 *   2) 普通 function foo() { return bar() } — 不应误判
 *   3) Vue 2 lifecycle 钩子 (mounted, beforeDestroy 等) 内有自调用 — 不标 review
 *   4) render / setup / data / methods 等白名单 — 不标 review
 *   5) 跨多 file: A 有自递归, B 没有
 *   6) 嵌套 function 内同名调用 (不是自递归)
 */

import { _testable_reviewSelfRecursiveFunctions } from '../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function makeFile(source: string, path = '/test/utils/x.js', kind: 'vue' | 'js' | 'ts' = 'js'): any {
  return {
    path,
    source,
    kind,
    sfc: { script: null, template: null, style: null, customBlocks: [], descriptor: null },
    metadata: { features: [], dependencies: [] },
    transforms: [],
    changed: false,
  }
}

function makeUtils(file: any) {
  return {
    markChanged: (msg?: string) => {
      file.changed = true
    },
    manualReview: (msg: string) => {
      if (!file._reviews) file._reviews = []
      file._reviews.push(msg)
    },
  }
}

function assert(name: string, cond: boolean, detail: string): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     ${detail}`)
    console.log(`  ✗ ${name}\n     ${detail}`)
  }
}

// ============ 1) setCurrentView 自递归 ============
console.log('\n[setCurrentView self-recursion]')
{
  const file = makeFile(
    `export function setCurrentView(view) {
  currentView.value = view
  if (view === 'detail') {
    setCurrentView('list')
  } else if (view === 'edit') {
    setCurrentView('detail')
  }
}`,
  )
  _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  assert(
    'setCurrentView review triggered',
    file._reviews && file._reviews.some((r: string) => r.includes('setCurrentView')),
    JSON.stringify(file._reviews),
  )
  assert(
    'review mentions <component :is',
    file._reviews && file._reviews.some((r: string) => r.includes('component :is') || r.includes('重新触发')),
    JSON.stringify(file._reviews),
  )
}

// ============ 2) 普通 function foo() { return bar() } — 不应误判 ============
console.log('\n[non-recursive function: no review]')
{
  const file = makeFile(
    `export function foo() {
  const x = bar()
  return x + 1
}
function bar() {
  return 42
}`,
  )
  _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  assert(
    'no review (foo calls bar, not itself)',
    !file._reviews || file._reviews.length === 0,
    JSON.stringify(file._reviews),
  )
}

// ============ 3) Vue 2 lifecycle 钩子 (mounted, beforeDestroy 等) — 白名单 ============
console.log('\n[lifecycle hooks: whitelist]')
{
  const file = makeFile(
    `export default {
  mounted() {
    return mounted.call(this)
  },
  beforeDestroy() {
    return beforeDestroy()
  }
}`,
  )
  _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  assert(
    'no review for lifecycle hooks',
    !file._reviews || file._reviews.length === 0,
    JSON.stringify(file._reviews),
  )
}

// ============ 4) render / setup / data / methods / watch / computed — 白名单 ============
console.log('\n[setup/data/methods/watch/computed: whitelist]')
{
  const file = makeFile(
    `export default {
  render() { return render(h) },
  setup() { return setup() },
  data() { return data() },
  methods: { foo() { return foo() } },
  watch: { x() { return x() } },
  computed: { y: { get() { return y } } }
}`,
  )
  _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  assert(
    'no review (whitelist)',
    !file._reviews || file._reviews.length === 0,
    JSON.stringify(file._reviews),
  )
}

// ============ 5) 跨多 file ============
console.log('\n[multi-file: A has self-call, B does not]')
{
  const fileA = makeFile(
    `function setCurrentView(v) { setCurrentView(v + 1) }`,
  )
  _testable_reviewSelfRecursiveFunctions(fileA, makeUtils(fileA))
  assert(
    'fileA setCurrentView review',
    fileA._reviews && fileA._reviews.some((r: string) => r.includes('setCurrentView')),
    JSON.stringify(fileA._reviews),
  )

  const fileB = makeFile(
    `function increment(n) { return n + 1 }
export const x = increment(1)`,
  )
  _testable_reviewSelfRecursiveFunctions(fileB, makeUtils(fileB))
  assert(
    'fileB no review (no self call)',
    !fileB._reviews || fileB._reviews.length === 0,
    JSON.stringify(fileB._reviews),
  )
}

// ============ 6) 嵌套 function 内同名调用 (不是自递归) ============
console.log('\n[nested function: not recursive]')
{
  const file = makeFile(
    `function outer() {
  function inner1() {
    function inner2() {
      return 1
    }
    return inner2()
  }
  return inner1()
}`,
  )
  _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  assert(
    'no review (no self recursion)',
    !file._reviews || file._reviews.length === 0,
    JSON.stringify(file._reviews),
  )
}

// ============ 7) 业务自递归: loadMore / fetchNext 模式 ============
console.log('\n[business self-recursion: loadMore]')
{
  const file = makeFile(
    `function loadMore() {
  if (hasMore) {
    fetchMore().then(() => loadMore())
  }
}`,
  )
  _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  assert(
    'loadMore review triggered',
    file._reviews && file._reviews.some((r: string) => r.includes('loadMore')),
    JSON.stringify(file._reviews),
  )
}

// ============ 8) 没 source 的 file — 安全跳过 ============
console.log('\n[no source: safe skip]')
{
  const file: any = { path: '/x', source: '', kind: 'js' }
  let errored = false
  try {
    _testable_reviewSelfRecursiveFunctions(file, makeUtils(file))
  } catch (e) {
    errored = true
  }
  assert('no error for empty source', !errored, 'should not throw')
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
