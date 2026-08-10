/**
 * tools/baseline-comparator/src/__tests__/metrics.test.ts
 *
 * 单元测试：用 node:test（无需第三方依赖）
 *   tsx --test src/__tests__/metrics.test.ts
 *
 * 覆盖：
 *   - 双方完全相同 → 全部指标接近 1
 *   - 双方大相径庭 → 指标反映差异
 *   - parse 失败
 *   - .vue 文件 script 提取
 *   - 各种 import 路径合法性
 *   - semantic pattern 计数
 *   - 内部 hashAst / jaccard 函数
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { compareOutputs, _internal } from '../metrics.js'

const { tryParse, extractVueScript, hashAst, jaccard, semanticDiffScore, runtimeSafeScore } = _internal

// ============ 辅助：构造 map ============

function mapOf(entries: Array<[string, string]>): Map<string, string> {
  return new Map(entries)
}

// ============ 1. 完全相同 ============

test('identical maps → compileOk=1, astEquivalent=1', async () => {
  const code = `
import { createApp } from 'vue'
import App from './App.vue'
const app = createApp(App)
app.mount('#app')
`
  const ours = mapOf([['main.js', code]])
  const off = mapOf([['main.js', code]])
  const m = await compareOutputs(ours, off)
  assert.equal(m.compileOk, 1)
  assert.equal(m.astEquivalent, 1)
  // semanticDiff 取决于 patterns：上面有 createApp
  assert.ok(m.semanticDiff > 0.5, `semanticDiff 应该 > 0.5, got ${m.semanticDiff}`)
})

// ============ 2. 完全不同 ============

test('diverged: ours=Vue3, official=Vue2 → semanticDiff / runtimeSafe 反映差异', async () => {
  const ourCode = `
import { createApp, defineComponent } from 'vue'
import App from './App.vue'
const app = createApp(App)
app.mount('#app')
export default defineComponent({})
`
  const offCode = `
import Vue from 'vue'
import Vuex from 'vuex'
new Vue({ el: '#app' })
Vue.use(Vuex)
Vue.component('Foo', {})
`
  const ours = mapOf([['main.js', ourCode]])
  const off = mapOf([['main.js', offCode]])
  const m = await compareOutputs(ours, off)
  // 双方都 parse 得了
  assert.equal(m.compileOk, 1)
  // AST 不会完全一致
  assert.ok(m.astEquivalent < 1, `astEquivalent 应 < 1, got ${m.astEquivalent}`)
  assert.ok(m.astEquivalent > 0, `astEquivalent 应 > 0, got ${m.astEquivalent}`)
  // 我方 semanticDiff 应该比"双方都用 Vue2 写"高
  // 但我们只看 ours，所以语义友好度 = 1.0（全好没有坏）
  assert.ok(m.semanticDiff > 0.5, `我方 semanticDiff 应 > 0.5, got ${m.semanticDiff}`)
  // runtimeSafe 看我方：我方用 createApp from 'vue'，named import，合法
  assert.equal(m.runtimeSafe, 1, `runtimeSafe 应为 1, got ${m.runtimeSafe}`)
})

// ============ 3. 我方不合法 import ============

test('ours uses element-ui → runtimeSafe < 1', async () => {
  const ourCode = `
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'
new Vue({ el: '#app' })
Vue.use(ElementUI)
`
  const offCode = `// whatever`
  const ours = mapOf([['main.js', ourCode]])
  const off = mapOf([['main.js', offCode]])
  const m = await compareOutputs(ours, off)
  // 4 个 import：vue (default → bad), element-ui (bad), element-ui/... (bad), 然后 require？算了 3 个
  // 反正 < 1
  assert.ok(m.runtimeSafe < 1, `runtimeSafe 应 < 1, got ${m.runtimeSafe}`)
  // semantic: 至少 4 个 bad pattern，无 good
  assert.ok(m.semanticDiff < 0.5, `semanticDiff 应 < 0.5, got ${m.semanticDiff}`)
})

// ============ 4. .vue 文件 script 提取 ============

test('extractVueScript handles <script setup>', () => {
  const code = `
<template>
  <div>{{ msg }}</div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
const msg = ref('hi')
</script>
<style scoped></style>
`
  const r = extractVueScript(code)
  assert.ok(r)
  assert.equal(r!.setup, true)
  assert.ok(r!.content.includes('ref('))
  assert.ok(r!.content.includes("'hi'"))
})

test('tryParse on a .vue file extracts <script> and parses', () => {
  const code = `
<template><div/></template>
<script>
export default { name: 'X' }
</script>
`
  const r = tryParse(code, 'X.vue')
  assert.equal(r.ok, true)
  assert.ok(r.scriptContent)
  assert.ok(r.ast)
})

test('tryParse on a .vue file with no <script> → ok with empty', () => {
  const r = tryParse('<template><div/></template>', 'Y.vue')
  assert.equal(r.ok, true)
  // 没有 script，ast 是 undefined（视为空但合法）
})

// ============ 5. parse 失败 ============

test('parse failure reduces compileOk', async () => {
  const good = `import { createApp } from 'vue'\nconst app = createApp({})`
  const bad = `this is { not valid javascript @#$`
  const ours = mapOf([['a.js', good], ['b.js', bad]])
  const off = mapOf([['a.js', good], ['b.js', good]])
  const m = await compareOutputs(ours, off)
  // a.js 双方都 parse（1/2 = 0.5），b.js 我方不 parse
  assert.equal(m.compileOk, 0.5)
  assert.deepEqual(m.details.parseFailed.ours, ['b.js'])
  assert.deepEqual(m.details.parseFailed.official, [])
})

// ============ 6. 文件覆盖差异 ============

test('files only in one side contribute to metrics', async () => {
  const code1 = `import { createApp } from 'vue'`
  const code2 = `import Vue from 'vue'`
  const ours = mapOf([
    ['a.js', code1],
    ['b.js', code2], // 只我方
  ])
  const off = mapOf([
    ['a.js', code1],
    ['c.js', code2], // 只官方
  ])
  const m = await compareOutputs(ours, off)
  assert.equal(m.details.totalFiles, 3) // a, b, c
  assert.equal(m.details.filesInBoth, 1) // a
  assert.equal(m.details.filesOnlyInOurs, 1) // b
  assert.equal(m.details.filesOnlyInOfficial, 1) // c
})

// ============ 7. 空 map ============

test('empty maps → all metrics 1 (degenerate case)', async () => {
  const m = await compareOutputs(new Map(), new Map())
  assert.equal(m.compileOk, 1)
  assert.equal(m.astEquivalent, 1)
  assert.equal(m.runtimeSafe, 1)
  assert.equal(m.semanticDiff, 0.5) // 中性
})

// ============ 8. 内部函数 ============

test('jaccard identical multisets → 1', () => {
  const a = new Map([['a', 2], ['b', 1]])
  const b = new Map([['a', 2], ['b', 1]])
  assert.equal(jaccard(a, b), 1)
})

test('jaccard disjoint → 0', () => {
  const a = new Map([['a', 1]])
  const b = new Map([['b', 1]])
  assert.equal(jaccard(a, b), 0)
})

test('jaccard partial overlap', () => {
  const a = new Map([['a', 1], ['b', 1]])
  const b = new Map([['a', 1], ['c', 1]])
  // inter=1 (a), union=3 → 0.333
  assert.ok(Math.abs(jaccard(a, b) - 1 / 3) < 1e-9)
})

test('hashAst: simple code', () => {
  const code = `const a = 1; const b = 2`
  const r = tryParse(code, 'x.js')
  assert.ok(r.ok)
  const h = hashAst(r.ast)
  assert.ok(h.size > 0)
  // 至少要有 VariableDeclaration 和 NumericLiteral
  let foundVar = false
  let foundNum = false
  for (const k of h.keys()) {
    if (k.startsWith('VariableDeclaration|')) foundVar = true
    if (k.startsWith('NumericLiteral|')) foundNum = true
  }
  assert.ok(foundVar, 'expected VariableDeclaration in hash keys')
  assert.ok(foundNum, 'expected NumericLiteral in hash keys')
})

test('semanticDiffScore: pure Vue2 → low', () => {
  const text = `
import Vue from 'vue'
import ElementUI from 'element-ui'
Vue.use(ElementUI)
new Vue({ el: '#app' })
`
  const s = semanticDiffScore(text)
  assert.ok(s < 0.5, `expected < 0.5, got ${s}`)
})

test('semanticDiffScore: pure Vue3 → high', () => {
  const text = `
import { createApp, defineComponent } from 'vue'
import { createStore } from 'vuex'
const app = createApp({})
app.use(createStore({}))
`
  const s = semanticDiffScore(text)
  assert.ok(s > 0.5, `expected > 0.5, got ${s}`)
})

test('runtimeSafeScore: all valid', () => {
  const text = `import { createApp } from 'vue'\nimport App from './App.vue'`
  const s = runtimeSafeScore(text)
  assert.equal(s.score, 1)
  assert.equal(s.total, 2)
})

test('runtimeSafeScore: element-ui invalid', () => {
  const text = `import ElementUI from 'element-ui'`
  const s = runtimeSafeScore(text)
  assert.equal(s.score, 0)
  assert.equal(s.total, 1)
})

test('runtimeSafeScore: Vue default import is invalid', () => {
  const text = `import Vue from 'vue'`
  const s = runtimeSafeScore(text)
  assert.equal(s.score, 0)
  assert.equal(s.total, 1)
})

test('runtimeSafeScore: Vue named import is valid', () => {
  const text = `import { createApp } from 'vue'`
  const s = runtimeSafeScore(text)
  assert.equal(s.score, 1)
  assert.equal(s.total, 1)
})

test('runtimeSafeScore: no imports → 1', () => {
  const text = `const x = 1`
  const s = runtimeSafeScore(text)
  assert.equal(s.score, 1)
  assert.equal(s.total, 0)
})

// ============ 9. 端到端：现实 Vue2 vs Vue3 转换 ============

test('e2e: Vue2 → Vue3 transformation should improve all metrics', async () => {
  const vue2 = `
import Vue from 'vue'
import ElementUI from 'element-ui'
Vue.config.productionTip = false
Vue.use(ElementUI)
new Vue({
  el: '#app',
  router,
  store,
  render: h => h(App)
})
`
  const vue3 = `
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')
`
  const ours = mapOf([['main.js', vue3]])
  const off = mapOf([['main.js', vue2]])
  const m = await compareOutputs(ours, off)
  // 双方都 parse
  assert.equal(m.compileOk, 1)
  // 我方用 createApp 和 element-plus，semanticDiff 应该高
  assert.ok(m.semanticDiff > 0.7, `semanticDiff 应 > 0.7, got ${m.semanticDiff}`)
  // runtimeSafe 看我方：3 个 import 全合法
  assert.equal(m.runtimeSafe, 1)
})
