/**
 * iter-123: ts-decorator plugin test for .tsx class component conversion
 *
 * 验证 .tsx 文件 (含 JSX 语法) 能被 ts-decorator 正确解析和转换:
 *   - basic TSX class with JSX render()
 *   - @Prop + JSX render()
 *   - methods using this.field → this.field.value in render body (含 JSX)
 *   - class getter method (computed) → this.xxx → xxx (no .value)
 *   - non-JSX TSX class with h() inside render()
 *
 * 关键改动 (iter-123):
 *   - ts-decorator babel parser 加 'jsx' plugin → 能解析 .tsx
 *   - class-to-setup 加 computedNames set → 识别 class getter method
 */

import * as p from '@babel/parser'
import { convertClassComponentToSetup } from '../class-to-setup.js'

let pass = 0
let fail = 0
const failures: string[] = []

function parse(code: string): any {
  return p.parse(code, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: ['typescript', 'decorators-legacy', 'classProperties', 'jsx'],
  })
}

function extractClass(code: string): any {
  const ast = parse(code)
  const exp = ast.program.body.find((n: any) => n.type === 'ExportDefaultDeclaration')
  if (!exp) throw new Error('no export default in test code')
  return exp.declaration
}

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

function run(input: string, isTs = true) {
  const cls = extractClass(input)
  const result = convertClassComponentToSetup(cls, input, isTs)
  return result
}

// ============================================================
// Test cases
// ============================================================

console.log('\n[basic TSX class with JSX render]')
{
  const input = `import { Component, Vue } from 'vue-property-decorator'

@Component
export default class MyTsx extends Vue {
  render() {
    return (
      <div class="container">
        <h1>{this.title}</h1>
        {this.items.map(item => <p key={item.id}>{item.name}</p>)}
      </div>
    )
  }
  get title() { return 'Hello' }
  items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
}`
  const r = run(input)
  const code = r.setupCode
  // Should have ref + computed imports
  assertContains('vue imports: ref + computed', r.vueImports, ['ref', 'computed'])
  // items should become ref
  assertContains('items → ref([...])', code, ['const items = ref'])
  // title getter should become computed (no this.title.value)
  assertContains('title → computed(() => "Hello")', code, ['const title = computed'])
  // render() should be preserved as function with JSX
  assertContains('render() function preserved', code, ['function render()'])
  assertContains('JSX div preserved in render', code, ['<div class="container">'])
  // this.items should be replaced with items.value
  assertContains('this.items → items.value in JSX', code, ['items.value.map'])
  assertNotContains('this.items NOT remaining in JSX', code, ['this.items'])
  // this.title should be replaced with title (no .value, since title is a computed)
  assertContains('this.title → title in JSX', code, ['{title}'])
  assertNotContains('this.title NOT remaining in JSX', code, ['this.title'])
}

console.log('\n[TSX class with @Prop + render]')
{
  const input = `import { Component, Vue, Prop } from 'vue-property-decorator'

@Component
export default class MyPropTsx extends Vue {
  @Prop({ default: '' }) name!: string
  render() {
    return <div class="greet">Hello {this.name}</div>
  }
}`
  const r = run(input)
  const code = r.setupCode
  // Should have defineProps
  assertContains('vue imports: defineProps', r.vueImports, ['defineProps'])
  // defineProps emitted
  assertContains('defineProps emitted with name', code, ['defineProps', 'name:'])
  // this.name → props.name in JSX
  assertContains('this.name → props.name in JSX', code, ['props.name'])
  assertNotContains('this.name NOT remaining in JSX', code, ['this.name'])
  // render preserved
  assertContains('render() function preserved', code, ['function render()'])
}

console.log('\n[TSX class with method using this.field]')
{
  const input = `import { Component, Vue } from 'vue-property-decorator'

@Component
export default class MyMethodTsx extends Vue {
  count = 0
  render() {
    return <button onClick={this.inc}>{this.count}</button>
  }
  inc() {
    this.count++
  }
}`
  const r = run(input)
  const code = r.setupCode
  // count → ref
  assertContains('count → ref(0)', code, ['const count = ref(0)'])
  // this.count in JSX → count.value
  assertContains('this.count in JSX → count.value', code, ['{count.value}'])
  assertNotContains('this.count NOT remaining in JSX', code, ['this.count'])
  // this.inc in JSX → inc (method)
  assertContains('this.inc in JSX → inc', code, ['onClick={inc}'])
  // inc method preserved with this.count → count.value
  assertContains('inc method preserved', code, ['function inc()'])
  assertContains('inc body: this.count++ → count.value++', code, ['count.value++'])
}

console.log('\n[TSX class with h() inside render]')
{
  // Non-JSX TSX class - tests that h() in render body gets this.xxx → xxx.value
  const input = `import { Component, Vue } from 'vue-property-decorator'

@Component
export default class NoJsxTsx extends Vue {
  count = 0
  render() {
    return h('div', { class: 'foo' }, this.count)
  }
}`
  const r = run(input)
  const code = r.setupCode
  assertContains('count → ref(0)', code, ['const count = ref(0)'])
  assertContains('render() function preserved', code, ['function render()'])
  // this.count in h() call → count.value
  assertContains('this.count → count.value in h() call', code, ['count.value'])
}

console.log('\n[TSX class with @Watch and JSX]')
{
  const input = `import { Component, Vue, Watch } from 'vue-property-decorator'

@Component
export default class MyWatchTsx extends Vue {
  count = 0
  @Watch('count')
  onCountChange(newVal: number, oldVal: number) {
    console.log(newVal, oldVal)
  }
  render() {
    return <div>{this.count}</div>
  }
}`
  const r = run(input)
  const code = r.setupCode
  assertContains('count → ref(0)', code, ['const count = ref(0)'])
  assertContains('watch emitted', code, ['watch('])
  assertContains('render() function preserved', code, ['function render()'])
  // this.count in JSX → count.value
  assertContains('this.count in JSX → count.value', code, ['{count.value}'])
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
