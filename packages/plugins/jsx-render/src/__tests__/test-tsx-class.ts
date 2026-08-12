/**
 * iter-123: jsx-render plugin test for .tsx class component review handling
 *
 * 验证 tsx-class-wrap.ts 规则:
 *   - post-conversion (file.useRawSource=true) → 不再标 review (ts-decorator 已改过)
 *   - pre-conversion (.tsx + @Component + class extends Vue + JSX) → fallback review
 *   - 非 tsx/jsx 文件 → 不处理
 *
 * 注意: ts-decorator 的 class-to-setup.ts 转换逻辑测试在 ts-decorator 包内的
 *   __tests__/test-tsx-class.ts (避免跨包 import 引 tsc rootDir 错误).
 *   端到端验证 (ts-decorator + jsx-render 联合) 走 CLI 跑 gap scenarios 目录.
 */

import { reviewTsxClassComponent } from '../rules/tsx-class-wrap.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertContains(name: string, haystack: string | string[] | Set<string>, must: string[]): void {
  const h = Array.isArray(haystack) ? haystack.join('\n') : (haystack instanceof Set ? [...haystack].join('\n') : haystack)
  const missing = must.filter((s) => !h.includes(s))
  if (missing.length === 0) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    const dump = h.length > 500 ? h.slice(0, 500) + '...[truncated]' : h
    failures.push(`${name} - missing: ${missing.join(', ')}\n     output (${h.length} chars):\n${dump}`)
    console.log(`  ✗ ${name} - missing: ${missing.join(', ')}`)
  }
}

function assertNotContains(name: string, haystack: string, mustNot: string[]): void {
  const present = mustNot.filter((s) => haystack.includes(s))
  if (present.length === 0) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} - should NOT contain: ${present.join(', ')}`)
    console.log(`  ✗ ${name} - should NOT contain: ${present.join(', ')}`)
  }
}

// ============================================================
// Test cases
// ============================================================

console.log('\n[tsx-class-wrap: post-conversion (useRawSource=true) → no review]')
{
  // Simulate file after ts-decorator has converted it
  const file: any = {
    kind: 'tsx',
    source: `import { computed, ref } from 'vue'

const items = ref([])

const title = computed(() => 'Hello')

function render() {
  return <div>{title}</div>
}`,
    useRawSource: true,  // ts-decorator set this
  }
  const r = reviewTsxClassComponent(file)
  assertNotContains('no review after conversion', JSON.stringify(r.reviewItems), ['iter-120'])
  // No modifications either
  if (r.modifications === 0) {
    pass++
    console.log('  ✓ modifications === 0 after conversion')
  } else {
    fail++
    failures.push('modifications should be 0 after conversion')
    console.log('  ✗ modifications should be 0 after conversion')
  }
}

console.log('\n[tsx-class-wrap: pre-conversion with JSX + class → fallback review]')
{
  // Simulate file BEFORE ts-decorator has run (or after parse failure)
  const file: any = {
    kind: 'tsx',
    source: `import { Component, Vue } from 'vue-property-decorator'

@Component
export default class MyTsx extends Vue {
  render() {
    return <div>{this.title}</div>
  }
  get title() { return 'Hello' }
}`,
    useRawSource: false,  // not yet converted
  }
  const r = reviewTsxClassComponent(file)
  assertContains('fallback review added', r.reviewItems.join('\n'), ['iter-120'])
}

console.log('\n[tsx-class-wrap: pre-conversion TS class without JSX → no review]')
{
  // Pure TS class (no JSX) - ts-decorator handles it, we don't review
  const file: any = {
    kind: 'tsx',
    source: `import { Component, Vue } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  count = 0
  mounted() { console.log(this.count) }
}`,
    useRawSource: false,
  }
  const r = reviewTsxClassComponent(file)
  if (r.modifications === 0 && r.reviewItems.length === 0) {
    pass++
    console.log('  ✓ pure TS class (no JSX) → no review (ts-decorator handles)')
  } else {
    fail++
    failures.push('pure TS class should not have review')
    console.log('  ✗ pure TS class should not have review')
  }
}

console.log('\n[tsx-class-wrap: not tsx/jsx file → no review]')
{
  const file: any = {
    kind: 'vue',
    source: `<template><div>{{ msg }}</div></template>
<script>
import { Component, Vue } from 'vue-property-decorator'
@Component
export default class MyComp extends Vue {
  render() { return <div>{this.title}</div> }
}
</script>`,
    useRawSource: false,
  }
  const r = reviewTsxClassComponent(file)
  if (r.modifications === 0 && r.reviewItems.length === 0) {
    pass++
    console.log('  ✓ no review for .vue file')
  } else {
    fail++
    failures.push('no review should be added for .vue file')
    console.log('  ✗ no review should be added for .vue file')
  }
}

console.log('\n[tsx-class-wrap: jsx class (not tsx) → no review after conversion]')
{
  // .jsx file post-conversion
  const file: any = {
    kind: 'jsx',
    source: `import { computed, ref } from 'vue'

const items = ref([])

function render() {
  return <div>{items.value.length}</div>
}`,
    useRawSource: true,
  }
  const r = reviewTsxClassComponent(file)
  if (r.modifications === 0) {
    pass++
    console.log('  ✓ .jsx post-conversion → no review')
  } else {
    fail++
    failures.push('.jsx post-conversion should not have review')
    console.log('  ✗ .jsx post-conversion should not have review')
  }
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
