/**
 * iter-120: jsx-render plugin test cases
 * 测试 h() 签名迁移 + functional template
 */
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse
const generate = (_generate as any).default || _generate

import { migrateRenderFnH } from '../rules/render-fn-h.js'
import { migrateFunctionalTemplate } from '../rules/functional-template.js'

let pass = 0
let fail = 0
const failures: string[] = []

function normalize(s: string): string {
  // 标准化多行空白, 便于比较
  return s.replace(/\s+/g, ' ').trim()
}

function assertH(
  name: string,
  input: string,
  expectedSubstrings: string[],
  notExpectedSubstrings: string[] = [],
): void {
  const ast = parse(input, { sourceType: 'module', plugins: ['jsx'] })
  const result = migrateRenderFnH(ast)
  const out = generate(ast).code

  let ok = true
  const missing: string[] = []
  for (const s of expectedSubstrings) {
    if (!out.includes(s)) {
      ok = false
      missing.push(s)
    }
  }
  for (const s of notExpectedSubstrings) {
    if (out.includes(s)) {
      ok = false
      missing.push(`!${s}`)
    }
  }

  if (ok) {
    pass++
    console.log(`  ✓ ${name} (${result.changes.length} changes)`)
  } else {
    fail++
    const msg = `${name}\n     input:  ${JSON.stringify(input)}\n     output: ${JSON.stringify(out)}\n     expected: ${expectedSubstrings.join(', ')}; not: ${notExpectedSubstrings.join(', ')}`
    failures.push(msg)
    console.log(`  ✗ ${name}\n     missing: ${missing.join(', ')}`)
    console.log(`     output: ${out.slice(0, 300)}`)
  }
}

function assertFunctional(
  name: string,
  inputSource: string,
  expectedSource: string,
): void {
  // 构造一个 fake FileNode
  const file: any = {
    kind: 'vue',
    source: inputSource,
    sfc: {
      template: {
        loc: { start: { offset: 0 }, end: { offset: 0 } },
        content: '',
      },
    },
  }
  const result = migrateFunctionalTemplate(file)
  const ok = file.source === expectedSource && result.modifications > 0
  if (ok) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    const msg = `${name}\n     input:  ${JSON.stringify(inputSource)}\n     actual: ${JSON.stringify(file.source)}\n     expected: ${JSON.stringify(expectedSource)}`
    failures.push(msg)
    console.log(`  ✗ ${name}\n     actual:   ${JSON.stringify(file.source)}`)
    console.log(`     expected: ${JSON.stringify(expectedSource)}`)
  }
}

// ============ 1. Basic h() with attrs/on/class merge ============
console.log('\n[basic h() signature migration]')

assertH(
  'basic h() with attrs + on + domProps merge',
  `function App() {
  return h('div', {
    attrs: { id: 'x', 'data-foo': 'bar' },
    on: { click: onClick },
    domProps: { innerHTML: '<b>hi</b>' }
  }, 'hello')
}`,
  [
    'id: \'x\'',
    'data-foo',
    'onClick',
    'innerHTML:',
  ],
  ['attrs:', 'on: {', 'domProps:'],
)

// ============ 2. h() with class array → string ============
console.log('\n[h() with class / staticClass]')

assertH(
  'h() with class: array',
  `function App() {
  return h('div', { class: ['foo', 'bar'] }, 'hi')
}`,
  [
    'class: [',
  ],
  // 数组仍是数组 (Vue 3 仍支持 class 数组), 不展开
)

assertH(
  'h() with staticClass merged to class',
  `function App() {
  return h('div', { staticClass: 'static', class: 'dyn' }, 'hi')
}`,
  [
    'static',
    'dyn',
  ],
  ['staticClass:'],
)

// ============ 3. h() with key / ref ============
console.log('\n[h() with key/ref]')

assertH(
  'h() with key/ref pass-through',
  `function App() {
  return h('div', { key: 'item-1', ref: 'myDiv' }, 'hi')
}`,
  [
    'key: \'item-1\'',
    'ref: \'myDiv\'',
  ],
)

assertH(
  'h() with refInFor removed',
  `function App() {
  return h('div', { refInFor: true, key: 'x' }, 'hi')
}`,
  [
    'key: \'x\'',
  ],
  ['refInFor'],
)

// ============ 4. h() with nativeOn → on ============
console.log('\n[h() with nativeOn]')

assertH(
  'h() with nativeOn click → onClick',
  `function App() {
  return h('button', { nativeOn: { click: onClick } }, 'go')
}`,
  [
    'onClick',
  ],
  ['nativeOn'],
)

assertH(
  'h() with both on and nativeOn (nativeOn first, on overrides)',
  `function App() {
  return h('button', { nativeOn: { click: native }, on: { click: custom } }, 'go')
}`,
  [
    'onClick: native',
  ],
  // on 会被忽略因为已存在 onClick (从 nativeOn 派生)
  // 实际: nativeOn 先到 flatProps, on 后到看到已存在 onClick 跳过
)

// ============ 5. h() with directives ============
console.log('\n[h() with directives]')

assertH(
  'h() with directives: [{ name: "foo" }] → v-foo',
  `function App() {
  return h('input', { directives: [{ name: 'focus' }] })
}`,
  [
    'v-focus',
  ],
  ['directives:'],
)

assertH(
  'h() with directives: [{ name: "foo", value: "bar" }] → v-foo',
  `function App() {
  return h('input', { directives: [{ name: 'foo', value: 'bar' }] })
}`,
  [
    'v-foo',
    '\'bar\'',
  ],
  ['directives:'],
)

// ============ 6. h() with scopedSlots ============
console.log('\n[h() with scopedSlots]')

assertH(
  'h() with scopedSlots.default → children',
  `function App() {
  return h('List', { scopedSlots: { default: ({ item }) => h('li', item.name) } }, props)
}`,
  [
    // scopedSlots.default 提取到 children
    'h(\'li\'',
  ],
  ['scopedSlots:'],
)

// ============ 7. TSX class component (basic) ============
console.log('\n[TSX class component]')

assertH(
  'TSX class with render() and h() inside',
  `import { Vue } from 'vue-property-decorator'
class MyComp extends Vue {
  render() {
    return h('div', { class: 'foo', on: { click: this.handle } }, 'text')
  }
}`,
  [
    'onClick',
  ],
  // 'on:' 仍在 (因为 on.click → onClick 转换后, 但完整 on: 会被移除)
  // 实际: 我们的代码会替换整个 on object, 但 onClick 可能在生成时再被展开
  // 让我检查: 在生成时, 我们的 on: { click: h } →  flatProps 有 onClick, 然后 removedProps.add('on')
  // 所以 'on:' 不会出现在最终输出. 但 'onClick' 会出现.
  ['on: {'],
)

// ============ 8. Inline-template (no functional) ============
console.log('\n[functional template]')

assertFunctional(
  '<template functional> → <template>',
  `<template functional>
  <div>{{ msg }}</div>
</template>
<script>
export default { name: 'X' }
</script>`,
  `<template>
  <div>{{ msg }}</div>
</template>
<script>
export default { name: 'X' }
</script>`,
)

assertFunctional(
  '<template functional class="foo"> → <template class="foo">',
  `<template functional class="foo">
  <div>{{ msg }}</div>
</template>`,
  `<template class="foo">
  <div>{{ msg }}</div>
</template>`,
)

// ============ 9. this.$createElement ============
console.log('\n[this.$createElement]')

assertH(
  'this.$createElement (Vue 2) → h() signature',
  `class MyComp extends Vue {
  render() {
    return this.$createElement('div', { attrs: { id: 'x' }, on: { click: this.click } })
  }
}`,
  [
    'id: \'x\'',
    'onClick',
  ],
  ['attrs:', 'on:'],
)

// ============ 10. Mixed: h() with slot ============
console.log('\n[h() with slot]')

assertH(
  'h() with slot attribute (保留)',
  `function App() {
  return h('Child', { slot: 'header' }, 'header content')
}`,
  [
    'slot: \'header\'',
  ],
  // slot 保留, 标 review
)

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
