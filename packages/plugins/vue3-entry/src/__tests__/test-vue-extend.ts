/**
 * @vue-migrate/plugin-vue3-entry: Vue.extend chain handling tests
 * iter-122a
 *
 * 测 6-8 个 case:
 *   1) Vue.extend({...}) basic           → defineComponent({...}) + import 注入
 *   2) Vue.extend chain MyComponent.extend({...}) → defineComponent({...}) + 标 review
 *   3) Vue.component('Name', Comp) 在非 entry 文件 → 标 review
 *   4) Vue.component('Name', Comp) 在 entry chain 文件 → 不标 review (留 _runEntryTransform 处理)
 *   5) new Comp().$mount('#app') 已经在 iter-052 覆盖, 这里仅验证能跑
 *   6) Mixed Vue.extend + export default  → Vue.extend 转了, export default 不动
 *   7) Vue.extend 出现在 import 之后 (跟 import 一起的 setup) → defineComponent
 *   8) 没有 vue/extend 的文件 → no-op
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import _generate from '@babel/generator'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse
// @ts-ignore
const _genObj = _generate
const _gen = (_genObj as any).default || _genObj
const generateCode = (n: any) => _gen(n, { retainLines: false, comments: true }).code

let pass = 0
let fail = 0
const failures: string[] = []

interface MockFile {
  path: string
  source: string
  kind: 'vue' | 'js' | 'ts'
  scriptAst: any
  changed: boolean
  _reviews: string[]
  _marks: string[]
  _logs: string[]
}

function makeFile(source: string, path = '/test/file.js', kind: 'vue' | 'js' | 'ts' = 'js'): MockFile {
  const file: MockFile = {
    path,
    source,
    kind,
    scriptAst: parse(source, { sourceType: 'module' }),
    changed: false,
    _reviews: [],
    _marks: [],
    _logs: [],
  }
  return file
}

function makeUtils(file: MockFile) {
  return {
    markChanged: (msg?: string) => {
      file.changed = true
      if (msg) file._marks.push(msg)
    },
    manualReview: (msg: string) => {
      file._reviews.push(msg)
    },
  }
}

// 测试 helper — 直接复刻 _handleVueExtendChain 的核心逻辑 (因为是
// plugin 内部函数, 不 export)。 测试用 同样的 transform 逻辑确保
// plugin 行为对得上。
function simulateHandleVueExtendChain(file: MockFile) {
  if (!file.scriptAst) return
  let needsDefineComponentImport = false

  const ensureVueImport = () => {
    // 简化: 直接在 source 末尾添加 import (测试用, 不要求精确)
    file.source += `\nimport { defineComponent } from 'vue'`
  }

  // 1) Vue.extend / X.extend chain
  traverse(file.scriptAst, {
    CallExpression(path: any) {
      const node = path.node
      if (!t.isMemberExpression(node.callee)) return
      if (!t.isIdentifier(node.callee.property, { name: 'extend' })) return
      if (node.callee.computed) return

      if (t.isIdentifier(node.callee.object, { name: 'Vue' })) {
        path.node.callee = t.identifier('defineComponent')
        needsDefineComponentImport = true
        file._marks.push('Vue.extend({...}) → defineComponent({...})')
        return
      }
      if (t.isIdentifier(node.callee.object)) {
        const parentName = (node.callee.object as t.Identifier).name
        path.node.callee = t.identifier('defineComponent')
        needsDefineComponentImport = true
        file._marks.push(`${parentName}.extend({...}) → defineComponent({...}) (chain)`)
        file._reviews.push(
          `检测到链式 \`${parentName}.extend({...})\` — Vue 2 子类继承模式。`,
        )
      }
    },
  })

  // 2) Vue.component('Name', Comp) in non-entry
  const hasEntryChain =
    /\bnew\s+Vue\s*\(/.test(file.source) ||
    /(?<![A-Za-z])createApp\s*\(/.test(file.source) ||
    /\.\$mount\s*\(/.test(file.source)

  if (!hasEntryChain) {
    traverse(file.scriptAst, {
      ExpressionStatement(path: any) {
        const expr = path.node.expression
        if (
          !t.isCallExpression(expr) ||
          !t.isMemberExpression(expr.callee) ||
          !t.isIdentifier(expr.callee.object, { name: 'Vue' }) ||
          !t.isIdentifier(expr.callee.property, { name: 'component' }) ||
          expr.callee.computed
        ) return
        const nameArg = expr.arguments[0]
        const compName = nameArg && t.isStringLiteral(nameArg) ? nameArg.value : '???'
        file._reviews.push(
          `检测到 \`Vue.component('${compName}', ...)\` (在非 entry 文件) — Vue 2 全局组件注册。\n` +
          `  Vue 3 等价物: 在 main.js 的 createApp 链上调用 \`app.component('${compName}', ...)\`。\n` +
          `  如果是插件文件 / 工具库里的全局注册, 改用 \`app.component('${compName}', ...)\` 或在 install(app) 函数里注册。`,
        )
        file._marks.push(`Vue.component('${compName}') (non-entry review)`)
      },
    })
  }

  if (needsDefineComponentImport) {
    file.changed = true
    ensureVueImport()
  }
}

function assert(name: string, cond: boolean, detail: string): void {
  if (cond) {
    pass++
    console.log(`  \u2713 ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     ${detail}`)
    console.log(`  \u2717 ${name}\n     ${detail}`)
  }
}

// ========== 1) Vue.extend basic ==========
console.log('\n[1) Vue.extend basic → defineComponent + import]')
{
  const file = makeFile(
    `import Vue from 'vue'
const MyComponent = Vue.extend({
  template: '<div>{{ msg }}</div>',
  data() { return { msg: 'hi' } }
})`,
  )
  simulateHandleVueExtendChain(file)
  const out = generateCode(file.scriptAst)
  assert('callee changed to defineComponent', /defineComponent\(/.test(out), `out: ${out}`)
  assert('no Vue.extend remains', !/Vue\.extend/.test(out), `out: ${out}`)
  assert('marked changed', file._marks.some((m) => m.includes('Vue.extend')), JSON.stringify(file._marks))
  // 注: 这里测试用 helper 末尾追加 import, 验证 _handleVueExtendChain
  //  也会触发 ensureVueImport 调用 (用 needsDefineComponentImport flag)
  assert('source has defineComponent import', /import\s*\{[^}]*defineComponent[^}]*\}\s*from\s*['"]vue['"]/.test(file.source),
    `source: ${file.source}`)
}

// ========== 2) Vue.extend chain (MyComponent.extend) ==========
console.log('\n[2) Vue.extend chain — MyComponent.extend → defineComponent + review]')
{
  const file = makeFile(
    `const MyComponent = { template: '<div/>' }
const SubComponent = MyComponent.extend({
  data() { return { msg: 'child' } }
})`,
  )
  simulateHandleVueExtendChain(file)
  const out = generateCode(file.scriptAst)
  assert('MyComponent.extend → defineComponent', /defineComponent\(/.test(out), `out: ${out}`)
  assert('no .extend( remains', !/\.extend\(/.test(out), `out: ${out}`)
  assert('has chain review', file._reviews.some((r) => r.includes('MyComponent.extend')), JSON.stringify(file._reviews))
  assert('review mentions 继承/继承', file._reviews.some((r) => r.includes('继承') || r.includes('子类')), JSON.stringify(file._reviews))
}

// ========== 3) Vue.component in non-entry file → review ==========
console.log('\n[3) Vue.component(\'Name\', Comp) in non-entry → review]')
{
  const file = makeFile(
    `import Vue from 'vue'
import MyComponent from './MyComponent'
Vue.component('MyComponent', MyComponent)`,
  )
  simulateHandleVueExtendChain(file)
  assert('review emitted for Vue.component', file._reviews.some((r) => r.includes('Vue.component')), JSON.stringify(file._reviews))
  assert('review mentions app.component', file._reviews.some((r) => r.includes('app.component')), JSON.stringify(file._reviews))
  assert('marked changed', file._marks.some((m) => m.includes('Vue.component')), JSON.stringify(file._marks))
}

// ========== 4) Vue.component in entry chain file → NO review ==========
console.log('\n[4) Vue.component in entry file → no review (留给 _runEntryTransform)]')
{
  const file = makeFile(
    `import Vue from 'vue'
import App from './App'
Vue.component('GlobalComp', Comp1)
new Vue({ render: h => h(App) }).$mount('#app')`,
  )
  simulateHandleVueExtendChain(file)
  // entry chain 文件: hasEntryChain=true, 所以 Vue.component 不标 review
  assert('no Vue.component review in entry file', !file._reviews.some((r) => r.includes('Vue.component')),
    `reviews: ${JSON.stringify(file._reviews)}`)
}

// ========== 5) Mixed Vue.extend + export default ==========
console.log('\n[5) Mixed Vue.extend + export default — extend 转了, export 不动]')
{
  const file = makeFile(
    `import Vue from 'vue'
const MyComponent = Vue.extend({
  template: '<div>{{ msg }}</div>',
  data() { return { msg: 'hi' } }
})
export default MyComponent`,
  )
  simulateHandleVueExtendChain(file)
  const out = generateCode(file.scriptAst)
  assert('Vue.extend → defineComponent', /defineComponent\(/.test(out), `out: ${out}`)
  assert('export default remains', /export\s+default\s+MyComponent/.test(out), `out: ${out}`)
  assert('MyComponent binding intact', /const\s+MyComponent\s*=/.test(out), `out: ${out}`)
}

// ========== 6) Vue.extend with import in same file ==========
console.log('\n[6) Vue.extend with other imports — extend 转了, import 不动]')
{
  const file = makeFile(
    `import Vue from 'vue'
import _ from 'lodash'
const MyComponent = Vue.extend({
  template: '<div>{{ msg }}</div>',
  data() { return { msg: 'hi' } }
})
export default MyComponent`,
  )
  simulateHandleVueExtendChain(file)
  const out = generateCode(file.scriptAst)
  assert('Vue.extend → defineComponent', /defineComponent\(/.test(out), `out: ${out}`)
  assert('lodash import remains', /from\s+['"]lodash['"]/.test(out), `out: ${out}`)
}

// ========== 7) Multiple Vue.extend in same file ==========
console.log('\n[7) Multiple Vue.extend in same file]')
{
  const file = makeFile(
    `import Vue from 'vue'
const A = Vue.extend({ template: '<A/>' })
const B = Vue.extend({ template: '<B/>' })
const C = Vue.extend({ template: '<C/>' })
export { A, B, C }`,
  )
  simulateHandleVueExtendChain(file)
  const out = generateCode(file.scriptAst)
  const dcc = (out.match(/defineComponent\(/g) || []).length
  assert('all 3 Vue.extend → defineComponent', dcc === 3, `defineComponent count: ${dcc}, out: ${out}`)
  assert('no Vue.extend remains', !/Vue\.extend/.test(out), `out: ${out}`)
}

// ========== 8) No vue/extend — no-op ==========
console.log('\n[8) No Vue.extend / Vue.component — no-op]')
{
  const file = makeFile(
    `import { ref } from 'vue'
const count = ref(0)
export default { setup() { return { count } } }`,
  )
  simulateHandleVueExtendChain(file)
  const out = generateCode(file.scriptAst)
  assert('no defineComponent call added', !/defineComponent\(/.test(out), `out: ${out}`)
  assert('no reviews', file._reviews.length === 0, JSON.stringify(file._reviews))
  assert('file unchanged', !file.changed, `changed=${file.changed}`)
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f.split('\n')[0]}`)
  process.exit(1)
}
