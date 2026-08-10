/**
 * @vue-migrate/plugin-composition unit tests
 * iter-044a (Bug A3): composition 自引用 (顶层 const 跟 data 字段同名)
 *
 * 关键场景:
 *   1. const X = {...} (顶层) + data() { X: X.foo } + methods { this.X = X[type] }
 *      → 顶层 const 重命名为 __X__, data init / method body 里的 X 引用改为 __X__
 *   2. 普通情况 (无冲突): 不做 rename
 *   3. data 字段 init 没引用顶层 const (e.g. `x: someValue`): 不做 rename
 *   4. 顶层 const 是 let / var (不是 const): 不做 rename (let 也能触发, 但保守起见只 const)
 *   5. init 是 array literal 而不是 object: 也走相同逻辑
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'
const _genObj = _generate
const _gen = _genObj.default || _genObj
const generate = (ast) => _gen(ast, { comments: true, retainLines: false }).code

import { registerPlugin, getPlugins } from '@vue-migrate/core'
import { convertOptionsToSetup } from '../options-to-setup.js'

let pass = 0
let fail = 0
const failures = []

function makeFile(source) {
  const ast = parse(source, { sourceType: 'module' })
  return {
    scriptAst: ast,
    source,
    path: '/test.vue',
    sfc: {
      script: { lang: undefined, content: source, attrs: {}, loc: { start: { offset: 0, line: 0, column: 0 }, end: { offset: source.length, line: 0, column: 0 } } },
      template: null,
      style: null,
      customBlocks: [],
      descriptor: {},
    },
    metadata: { lang: undefined, features: [], dependencies: [] },
    transforms: [],
    changed: false,
  }
}

function runConvert(file) {
  const ctx = { file, utils: { markChanged: () => {}, manualReview: () => {} } }
  return convertOptionsToSetup(file, ctx)
}

function assertContains(name, code, must) {
  const missing = must.filter(s => !code.includes(s))
  if (missing.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - missing: ${missing.join(', ')}\n     code: ${code.slice(0, 400)}`)
    console.log(`  ✗ ${name} - missing: ${missing.join(', ')}`)
  }
}
function assertNotContains(name, code, mustNot) {
  const present = mustNot.filter(s => code.includes(s))
  if (present.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - present: ${present.join(', ')}\n     code: ${code.slice(0, 400)}`)
    console.log(`  ✗ ${name} - present: ${present.join(', ')}`)
  }
}

// ========== Bug A3: 自引用模式 ==========
console.log('\n[Bug A3: 顶层 const + data + methods 自引用]')

{
  // 完整 dashboard admin 模式
  const source = `import GithubCorner from '@/components/GithubCorner'

const lineChartData = {
  newVisitis: { expectedData: [100, 120, 161] },
  messages: { expectedData: [200, 192, 120] }
}

export default {
  name: 'DashboardAdmin',
  data() {
    return {
      lineChartData: lineChartData.newVisitis
    }
  },
  methods: {
    handleSetLineChartData(type) {
      this.lineChartData = lineChartData[type]
    }
  }
}`

  const file = makeFile(source)
  const result = runConvert(file)
  const code = result.setupCode

  assertContains('__lineChartData__ const preserved (renamed)', code, ['const __lineChartData__ ='])
  assertContains('data init: ref(__lineChartData__.newVisitis)', code, ['ref(__lineChartData__.newVisitis)'])
  assertContains('method: lineChartData.value = __lineChartData__[type]', code, ['lineChartData.value = __lineChartData__[type]'])
  assertNotContains('no self-reference: const lineChartData = ref(lineChartData.', code, ['const lineChartData = ref(lineChartData.'])
  // this.lineChartData 应该被转成 lineChartData.value (没改 name, 因为它是 data 字段名)
  assertNotContains('no this.lineChartData in output', code, ['this.lineChartData'])
  // 顶层 const 必须在 data ref 之前 (避免 TDZ)
  const tlcIdx = code.indexOf('const __lineChartData__')
  const dataIdx = code.indexOf('const lineChartData = ref')
  if (tlcIdx >= 0 && dataIdx >= 0 && tlcIdx < dataIdx) {
    pass++; console.log('  ✓ 顶层 const 在 data ref 之前 (无 TDZ)')
  } else {
    fail++; console.log(`  ✗ 顺序错: tlcIdx=${tlcIdx}, dataIdx=${dataIdx}`)
  }
}

{
  // 没有冲突 (data 字段名跟顶层 const 不撞): 不应 rename
  const source = `const helper = { x: 1 }
export default {
  data() {
    return { value: helper.x }
  }
}`
  const file = makeFile(source)
  const result = runConvert(file)
  const code = result.setupCode
  assertNotContains('没有冲突时不变 __helper__', code, ['__helper__'])
  assertContains('helper.x 引用保留', code, ['helper.x'])
}

{
  // data 字段名撞了, init 形式是 `value + 1` 而不是 `value.xxx` — \bvalue\b 仍会匹配
  //   实际: 用户的 value 是普通 const, data 字段也叫 value, init 是 value + 1
  //   这种情况下, data field name = 'value' 跟 顶层 const = 'value' 撞名, init 也引用 value
  //   rename 应该触发
  const source = `const value = 1
export default {
  data() {
    return { value: value + 1 }
  }
}`
  const file = makeFile(source)
  const result = runConvert(file)
  const code = result.setupCode
  // value + 1 形式: initStr 是 "value + 1", 包含 value 引用, 触发 rename
  assertContains('value + 1 也触发 rename (init 引用 value)', code, ['__value__'])
}

{
  // let 顶层 (不是 const): 不应 rename
  const source = `let mut = { x: 1 }
export default {
  data() {
    return { mut: mut.x }
  }
}`
  const file = makeFile(source)
  const result = runConvert(file)
  const code = result.setupCode
  // let 不在候选里, 所以不 rename
  assertNotContains('let 顶层不 rename', code, ['__mut__'])
}

{
  // 顶层 const 数组 (不是 object): 也支持
  const source = `const list = [1, 2, 3]
export default {
  data() {
    return { list: list[0] }
  }
}`
  const file = makeFile(source)
  const result = runConvert(file)
  const code = result.setupCode
  assertContains('数组 const 也 rename', code, ['__list__'])
}

console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
