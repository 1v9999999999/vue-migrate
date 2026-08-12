/**
 * @vue-migrate/plugin-ts-decorator iter-119 unit tests
 *
 * 测试 TypeScript class-based Vue component → <script setup> 转换.
 * 覆盖:
 *   - 基础 class + @Component
 *   - @Prop with various types
 *   - class fields
 *   - methods with this.xxx
 *   - lifecycle hooks
 *   - vuex-class @State / @Getter / @Action
 *   - computed getters
 *   - @Watch
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
    plugins: ['typescript', 'decorators-legacy', 'classProperties'],
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

function assertNotContains(name: string, haystack: string | string[] | Set<string>, mustNot: string[]): void {
  const h = Array.isArray(haystack) ? haystack.join('\n') : (haystack instanceof Set ? [...haystack].join('\n') : haystack)
  const present = mustNot.filter((s) => h.includes(s))
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

console.log('\n[basic class with @Component + @Prop]')
{
  const input = `
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  @Prop({ default: '' }) name!: string
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('defineProps emitted', code, ['defineProps'])
  assertContains('prop name with default', code, ['name:', "default: ''"])
  assertContains('vueImports has defineProps', r.vueImports, ['defineProps'])
}

console.log('\n[basic class with @Component + @Prop (JS mode)]')
{
  const input = `
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  @Prop({ default: 0 }) count!: number
}
`
  const r = run(input, false)  // JS mode
  const code = r.setupCode
  assertContains('JS mode: defineProps emitted', code, ['defineProps'])
  assertContains('JS mode: count with default 0', code, ['count:', 'default: 0'])
}

console.log('\n[class field (data): ref]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  count = 0
  title: string = 'hello'
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('count → ref(0)', code, ['const count = ref(0)'])
  assertContains('title → ref with type', code, ['const title = ref<string>'])
  assertContains('title default value', code, ["'hello'"])
  assertContains('vueImports has ref', [...r.vueImports], ['ref'])
}

console.log('\n[methods with this.xxx → ref.value]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  count = 0
  inc() { this.count++ }
  getValue() { return this.count * 2 }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('inc function emitted', code, ['function inc'])
  assertContains('getValue function emitted', code, ['function getValue'])
  assertContains('this.count → count.value (in inc)', code, ['count.value++'])
  assertContains('this.count → count.value (in getValue)', code, ['return count.value * 2'])
}

console.log('\n[lifecycle hooks → onMounted etc]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  mounted() { console.log('m') }
  beforeDestroy() { console.log('d') }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('mounted → onMounted', code, ['onMounted('])
  assertContains('beforeDestroy → onBeforeUnmount', code, ['onBeforeUnmount('])
  assertContains('vueImports has onMounted', [...r.vueImports], ['onMounted'])
  assertContains('vueImports has onBeforeUnmount', [...r.vueImports], ['onBeforeUnmount'])
}

console.log('\n[vuex-class @State]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'
import { State } from 'vuex-class'

@Component
export default class MyComp extends Vue {
  @State('user') user!: any
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('user → computed(() => useStore().state.user)', code, [
    'const user = computed',
    "useStore().state['user']",
  ])
  assertContains('vuex import added', r.extraImports, ["import { useStore } from 'vuex'"])
  assertContains('vueImports has computed', [...r.vueImports], ['computed'])
}

console.log('\n[vuex-class @Getter]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'
import { Getter } from 'vuex-class'

@Component
export default class MyComp extends Vue {
  @Getter('token') token!: string
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('token → computed(() => useStore().getters.token)', code, [
    'const token = computed',
    "useStore().getters['token']",
  ])
}

console.log('\n[vuex-class @Action]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'
import { Action } from 'vuex-class'

@Component
export default class MyComp extends Vue {
  @Action('login') login!: (payload: any) => Promise<any>
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('login → function', code, [
    'const login = (payload)',
    "useStore().dispatch('login', payload)",
  ])
}

console.log('\n[computed getter → computed(() => ...)]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  count = 0
  get double() { return this.count * 2 }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('double → computed', code, ['const double = computed('])
  assertContains('this.count → count.value in computed', code, ['count.value * 2'])
}

console.log('\n[@Watch on class field]')
{
  const input = `
import { Vue, Component, Watch } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  count = 0
  @Watch('count')
  onCountChange(newVal: number, oldVal: number) {
    console.log(newVal, oldVal)
  }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('watch emitted', code, ['watch('])
  assertContains('vueImports has watch', [...r.vueImports], ['watch'])
  // Type annotations should be stripped (no `: number`)
  assertNotContains('TS type annotations stripped from watch callback params', code, [': number'])
  // Closing paren of params should be present
  assertContains('watch callback params have closing paren', code, ['(newVal, oldVal) =>'])
}

console.log('\n[this.$nextTick / this.$route / this.$router]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  mounted() {
    this.$nextTick(() => console.log('tick'))
    const id = this.$route.params.id
    this.$router.push('/')
  }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('this.$nextTick → nextTick', code, ['nextTick('])
  assertContains('this.$route → route', code, ['route.params.id'])
  assertContains('this.$router → router', code, ["router.push('/')"])
  assertContains('vueImports has nextTick', [...r.vueImports], ['nextTick'])
  assertContains('vue-router import added', r.extraImports.join('\n'), ['useRoute'])
}

console.log('\n[@Component with components option → manual review]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component({ components: { ChildComp } })
export default class MyComp extends Vue {
  msg = 'hi'
}
`
  const r = run(input)
  assertContains('@Component({ components }) → manual review', r.reviewItems.join('\n'), ['components'])
}

console.log('\n[no @Component decorator (still a class) — no conversion]')
{
  // The plugin won't be invoked at all in this case, but the convertClassComponentToSetup
  // function should still handle a class without @Component. It will treat all fields
  // as plain data and methods as methods.
  const input = `
import { Vue } from 'vue-property-decorator'

export default class MyComp extends Vue {
  count = 0
  mounted() { console.log(this.count) }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('still converts to ref + onMounted', code, ['const count = ref(0)', 'onMounted('])
}

console.log('\n[all 3 vuex decorators together]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'
import { State, Getter, Action } from 'vuex-class'

@Component
export default class MyComp extends Vue {
  @State('user') user!: any
  @Getter('token') token!: string
  @Action('login') login!: (p: any) => Promise<any>
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('@State + @Getter + @Action all emitted', code, [
    'const user = computed',
    'const token = computed',
    "const login = (payload)",
  ])
  assertContains('vuex import', r.extraImports, ["import { useStore } from 'vuex'"])
}

console.log('\n[@State with module/key form]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'
import { State } from 'vuex-class'

@Component
export default class MyComp extends Vue {
  @State('app', 'count') count!: number
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('@State("app", "count") → useStore().state.app.count', code, [
    'useStore().state.app.count',
  ])
}

console.log('\n[method with type-annotated param — type stripped]')
{
  const input = `
import { Vue, Component } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  add(n: number) { return n * 2 }
}
`
  const r = run(input)
  const code = r.setupCode
  assertContains('add function emitted with type-stripped params', code, ['function add(n)'])
  assertNotContains('no type annotation in add params', code, [': number'])
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
