/**
 * @vue-migrate/plugin-vue3-entry unit tests
 * iter-039: removeVueDefaultImportIfUnused (#15c)
 *
 * 不起 plugin 钩子,直接 import 纯函数测。
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'

// ESM-safe generator wrapper
const _genObj: any = (_generate as any)
const _gen = _genObj.default || _genObj
const generate = (ast: any, opts?: any): string => _gen(ast, opts).code

import { removeVueDefaultImportIfUnused } from '../utils.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertTransform(name: string, input: string, expected: string): void {
  const ast = parse(input, { sourceType: 'module' })
  const file: any = { scriptAst: ast, source: input }
  removeVueDefaultImportIfUnused(file, () => {})
  const out = generate(ast, { comments: true, retainLines: false })
  if (out.trim() === expected.trim()) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected: ${JSON.stringify(expected)}`)
  }
}

function assertNoChange(name: string, input: string): void {
  const ast = parse(input, { sourceType: 'module' })
  const file: any = { scriptAst: ast, source: input }
  let changed = false
  removeVueDefaultImportIfUnused(file, () => { changed = true })
  if (!changed) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    const out = generate(ast, { comments: true, retainLines: false })
    fail++
    failures.push(`${name} (changed unexpectedly)\n     input:  ${JSON.stringify(input)}\n     actual: ${JSON.stringify(out)}`)
    console.log(`  ✗ ${name} (changed unexpectedly)`)
  }
}

// ============ 移除 default specifier (保留 named imports) ============
console.log('\n[default specifier + named imports]')

assertTransform(
  'import Vue + Vue 已无引用 → 移除 default specifier',
  `import Vue, { defineComponent, createApp } from 'vue';
const app = createApp({});`,
  `import { defineComponent, createApp } from 'vue';
const app = createApp({});`,
)

// ============ 整条 import 删除 (无 named imports) ============
console.log('\n[default-only import]')

assertTransform(
  'import Vue (无 named) + Vue 已无引用 → 整条删',
  `import Vue from 'vue';
const x = 1;`,
  `const x = 1;`,
)

assertTransform(
  'import Vue + 仅是声明但不用 → 整条删',
  `import Vue from 'vue';
function foo() {
  return 42;
}`,
  `function foo() {
  return 42;
}`,
)

// ============ 还有 Vue 引用 → 不动 ============
console.log('\n[Vue still in use]')

assertNoChange(
  'import Vue + Vue.use() 还在 → 保留',
  `import Vue from 'vue';
Vue.use(SomePlugin);
const x = 1;`,
)

assertNoChange(
  'import Vue + new Vue() 还在 → 保留',
  `import Vue from 'vue';
new Vue({ el: '#app' });`,
)

assertNoChange(
  'import Vue + Vue.config.productionTip 还在 → 保留',
  `import Vue from 'vue';
Vue.config.productionTip = false;`,
)

assertNoChange(
  'import Vue + Vue.extend() 还在 → 保留',
  `import Vue from 'vue';
const C = Vue.extend({});`,
)

assertNoChange(
  'import Vue + Vue.version 还在 → 保留',
  `import Vue from 'vue';
console.log(Vue.version);`,
)

// ============ 没有 import Vue → 无操作 ============
console.log('\n[no import Vue]')

assertNoChange(
  '没有 import Vue → 无操作',
  `import { ref } from 'vue';
const x = ref(0);`,
)

assertNoChange(
  '没有 vue import → 无操作',
  `const Vue = require('vue');
Vue.use(Something);`,
)

// ============ 混合 import + 部分用 ============
console.log('\n[mixed scenarios]')

assertTransform(
  'import Vue + Vue.use + Vue.filter 都无引用 → 移除',
  `import Vue from 'vue';
function setup() {
  return {};
}`,
  `function setup() {
  return {};
}`,
)

assertNoChange(
  'import Vue + Vue.someUnknown() 还在 → 保留 (因为我们没处理)',
  `import Vue from 'vue';
Vue.someUnknownMethod();`,
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
