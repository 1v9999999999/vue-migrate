/**
 * @vue-migrate/plugin-v-model-emit-fixer unit tests
 *
 * iter-049a P1 #15: 修 v-model 双向不通
 *
 * 测:
 *   1. needsFix: 检测 defineEmits / emit
 *   2. fixVModelEmits: 改 'input' → 'update:modelValue'
 *   3. 边界: 多 emit / 引号 / 不该改的
 *   4. transform 真实场景
 */

import { _testable } from '../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertEq<T>(name: string, actual: T, expected: T): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     actual:   ${JSON.stringify(actual)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     actual:   ${JSON.stringify(actual)}\n     expected: ${JSON.stringify(expected)}`)
  }
}

function assertTrue(name: string, cond: boolean, extra?: string): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}${extra ? '\n     ' + extra : ''}`)
    console.log(`  ✗ ${name}${extra ? '\n     ' + extra : ''}`)
  }
}

// ============ 1. needsFix ============
console.log('\n[needsFix]')

assertTrue('含 defineEmits input', _testable.needsFix(`const emit = defineEmits(['input'])`))
assertTrue('含 emit input', _testable.needsFix(`emit('input', x)`))
assertTrue('都不含', !_testable.needsFix(`const emit = defineEmits(['update:modelValue'])`))
assertTrue('无关 input', !_testable.needsFix(`const x = 'input'`))
assertTrue('update:modelValue 不算', !_testable.needsFix(`const emit = defineEmits(['update:modelValue'])`))
assertTrue('onInput 不算', !_testable.needsFix(`const emit = defineEmits(['onInput'])`))
assertTrue('空', !_testable.needsFix(''))

// ============ 2. fixVModelEmits ============
console.log('\n[fixVModelEmits]')

{
  // 单引号 defineEmits
  const r = _testable.fixVModelEmits(`const emit = defineEmits(['input'])`)
  assertTrue('changed', r.changed)
  assertTrue('fixedCount = 1', r.fixedCount === 1)
  assertEq('替换后', r.newSource, `const emit = defineEmits(['update:modelValue'])`)
}

{
  // 双引号
  const r = _testable.fixVModelEmits(`const emit = defineEmits(["input"])`)
  assertEq('双引号替换', r.newSource, `const emit = defineEmits(["update:modelValue"])`)
}

{
  // 多个 emit, 其中有 'input'
  const r = _testable.fixVModelEmits(`const emit = defineEmits(['change', 'input', 'blur'])`)
  assertTrue('changed', r.changed)
  assertEq('只改 input',
    r.newSource,
    `const emit = defineEmits(['change', 'update:modelValue', 'blur'])`)
}

{
  // emit('input', x)
  const r = _testable.fixVModelEmits(`function onChange() { emit('input', newVal) }`)
  assertTrue('emit changed', r.changed)
  assertEq('emit 替换',
    r.newSource,
    `function onChange() { emit('update:modelValue', newVal) }`)
}

{
  // emit("input", x) 双引号
  const r = _testable.fixVModelEmits(`function onChange() { emit("input", newVal) }`)
  assertEq('emit 双引号',
    r.newSource,
    `function onChange() { emit("update:modelValue", newVal) }`)
}

{
  // 多个 emit 调用
  const r = _testable.fixVModelEmits(`
    function a() { emit('input', 1) }
    function b() { emit('change', 2) }
    function c() { emit('input', 3) }
  `)
  assertTrue('多 emit changed', r.changed)
  // 没 defineEmits, 只有 2 个 emit('input') 调用 → fixedCount = 2
  assertTrue('fixedCount = 2', r.fixedCount === 2)
  assertTrue('emit(input) 都改了', !r.newSource.includes(`emit('input'`))
  assertTrue('emit(change) 没动', r.newSource.includes(`emit('change'`))
}

{
  // 同时有 defineEmits + emit 调用 → 计数累加
  const r = _testable.fixVModelEmits(`
    const emit = defineEmits(['input'])
    function onChange() { emit('input', 1) }
  `)
  assertTrue('多 fix changed', r.changed)
  // 1 (defineEmits) + 1 (emit) = 2
  assertTrue('defineEmits + emit 计数 = 2', r.fixedCount === 2)
}

{
  // 已经 update:modelValue
  const r = _testable.fixVModelEmits(`const emit = defineEmits(['update:modelValue'])`)
  assertTrue('already updated, no change', !r.changed)
  assertEq('already updated, count = 0', r.fixedCount, 0)
}

{
  // 'onInput' 不应被改
  const r = _testable.fixVModelEmits(`const emit = defineEmits(['onInput', 'input'])`)
  assertTrue('mixed changed', r.changed)
  assertEq('onInput 保留, input 改',
    r.newSource,
    `const emit = defineEmits(['onInput', 'update:modelValue'])`)
}

{
  // 没引号的 input 名字 (e.g. dynamic) 不应被改
  const r = _testable.fixVModelEmits(`emit('on-input', 1)`)
  // 我们的 regex 只匹配 'input' / "input" 整体, 'on-input' 不会
  assertTrue('on-input 不动', !r.changed)
}

// ============ 3. transform 真实场景 ============
console.log('\n[transform: 真实场景]')

{
  // 真实场景: MarkdownEditor 子组件
  const { default: plugin } = await import('../index.js') as any
  const src = `<template>
  <div ref="rootEl" :id="id" />
</template>
<script setup>
const props = defineProps({
  value: { type: String, default: '' }
});
const emit = defineEmits(['input']);
function onChange() {
  emit('input', 'new val');
}
</script>`
  const file = {
    path: '/test/comp.vue',
    relativePath: 'comp.vue',
    kind: 'vue',
    source: src,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx = {
    file,
    project: { root: '/test', files: new Map(), dependencyGraph: new Map(), typeCache: new Map(), plugins: [], stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 }, config: {}, storeNames: {} },
    utils: {
      markChanged: (msg?: string) => { file.changed = true; file._mark = msg },
      manualReview: (msg: string) => { file._review = (file._review || []).concat([msg]) },
      reparse: () => {},
      syncScriptAstToSource: () => {},
    } as any,
    syncScriptAstToSource: () => {},
    log: (m: string) => {},
    __changed: false,
  }
  await plugin.transform(ctx)

  assertTrue('文件改', file.changed)
  assertTrue("defineEmits 改", file.source.includes("['update:modelValue']"))
  assertTrue("emit 改", file.source.includes("emit('update:modelValue'"))
  assertTrue("input 引用都没了", !file.source.includes("'input'") && !file.source.includes('"input"'))
  // prop 名 value 保留 (保守策略)
  assertTrue('prop value 保留', file.source.includes('value: { type: String'))
  assertTrue('有 review', (file._review || []).length > 0)
}

{
  // 不需要 fix 的文件不动
  const { default: plugin } = await import('../index.js') as any
  const src = `<script setup>
const emit = defineEmits(['change'])
</script>`
  const file = {
    path: '/test/x.vue',
    relativePath: 'x.vue',
    kind: 'vue',
    source: src,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx = {
    file,
    project: { root: '/test', files: new Map(), dependencyGraph: new Map(), typeCache: new Map(), plugins: [], stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 }, config: {}, storeNames: {} },
    utils: {
      markChanged: (msg?: string) => { file.changed = true },
      manualReview: (msg: string) => { file._review = (file._review || []).concat([msg]) },
      reparse: () => {},
      syncScriptAstToSource: () => {},
    } as any,
    syncScriptAstToSource: () => {},
    log: (m: string) => {},
    __changed: false,
  }
  await plugin.transform(ctx)
  assertTrue('无 input emit, 不动', !file.changed)
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
