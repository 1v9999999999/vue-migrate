/**
 * @vue-migrate/plugin-import-cleaner unit tests
 * iter-042c
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import _traverse from '@babel/traverse'

const _traverseObj: any = (_traverse as any)
const traverse = _traverseObj.default || _traverseObj
const _genObj: any = (_generate as any)
const _gen = _genObj.default || _genObj
const generate = (ast: any): string => _gen(ast, { comments: true, retainLines: false }).code

import { registerPlugin, getPlugins } from '@vue-migrate/core'
import './../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertTransform(name: string, input: string, expectedContains: string[], expectedNotContains: string[]): void {
  const ast = parse(input, { sourceType: 'module' })
  const file: any = { scriptAst: ast, source: input, transforms: [], changed: false }
  let markedChanged = false
  const ctx: any = {
    file,
    project: { stats: { manualReviewRequired: 0 } },
    utils: {
      markChanged: (msg?: string) => { markedChanged = true },
      manualReview: (r: string) => {},
    },
  }
  // 直接调用 plugin transform
  // (注: registerPlugin 已运行, 取出来手动调)
  const plugins = getPlugins()
  const p = plugins.find((pl: any) => pl.name === 'import-cleaner')
  if (!p) {
    fail++; failures.push(`${name} (plugin not registered)`); console.log(`  ✗ ${name}`)
    return
  }
  p.transform(ctx)
  const out = generate(ast)
  const allOk = expectedContains.every((s) => out.includes(s)) &&
                expectedNotContains.every((s) => !out.includes(s))
  if (allOk) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:  ${JSON.stringify(input)}\n     actual: ${JSON.stringify(out)}`)
    console.log(`  ✗ ${name}\n     actual: ${JSON.stringify(out)}`)
    if (!markedChanged && expectedNotContains.length > 0) {
      console.log(`     (markChanged NOT called — nothing was removed)`)
    }
  }
}

console.log('\n[unused default import]')

assertTransform(
  'import Vue 没人用 → 整条删',
  `import Vue from 'vue'
const x = 1
console.log(x)`,
  ['const x = 1', 'console.log(x)'],
  ['import Vue', 'from \'vue\''],
)

assertTransform(
  'import Vue 没人用 + 别的 import 还在',
  `import Vue from 'vue'
import { ref } from 'vue'
const x = ref(0)
console.log(x)`,
  ['ref(0)', 'console.log(x)'],
  ['import Vue'],
)

console.log('\n[unused named import]')

assertTransform(
  'import { mapState } from "vuex" 没人用 → 删该 specifier',
  `import { mapState, mapActions } from 'vuex'
import { ref } from 'vue'
const x = ref(0)
const y = mapActions(['login'])
console.log(x, y)`,
  ['mapActions', 'ref(0)'],
  ['mapState'],
)

assertTransform(
  '所有 named import 都无用 → 整条删',
  `import { a, b, c } from 'lib'
import { ref } from 'vue'
const x = ref(0)`,
  ['ref(0)', 'const x = ref(0)'],
  ['from \'lib\'', 'a,', 'b,', ' c'],
)

console.log('\n[used imports NOT removed]')

assertTransform(
  'import Vue 有用 → 保留',
  `import Vue, { ref } from 'vue'
const app = Vue.createApp({})
const x = ref(0)`,
  ['Vue.createApp', 'ref(0)'],
  [],
)

assertTransform(
  'import * as Vue 还在用 → 保留',
  `import * as Vue from 'vue'
const x = Vue.createApp({})`,
  ['Vue.createApp'],
  [],
)

assertTransform(
  'import { ref } 还在用 → 保留',
  `import { ref, computed } from 'vue'
const x = ref(0)
const y = computed(() => x.value * 2)`,
  ['ref(0)', 'computed('],
  [],
)

console.log('\n[partial usage]')

assertTransform(
  'named import 3 个只用 1 个 → 删 2 个',
  `import { a, b, c } from 'lib'
console.log(a)`,
  ['console.log(a)'],
  ['import { a,', ' b,', ', c'],
)

console.log('\n[edge cases]')

assertTransform(
  'namespace import 未用 → 删',
  `import * as foo from 'bar'
const x = 1
console.log(x)`,
  ['const x = 1'],
  ['import * as foo'],
)

assertTransform(
  '没有 import → 无操作',
  `const x = 1
console.log(x)`,
  ['const x = 1', 'console.log(x)'],
  [],
)

console.log('\n[summary]')

console.log(`tests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
