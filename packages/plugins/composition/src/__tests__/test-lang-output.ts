/**
 * @vue-migrate/plugin-composition unit tests
 * iter-040: output lang-aware (JS source → JS output, no TS generics)
 *
 * 验证当源文件是 <script> 或 <script lang="js"> 时, 输出不带 <T> 泛型。
 * 当 <script lang="ts"> 时, 保留 <T> 泛型。
 */

import { parse } from '@babel/parser'
import { convertOptionsToSetup } from '../options-to-setup.js'

let pass = 0
let fail = 0
const failures: string[] = []

function makeFile(lang: any, sfcLang?: string) {
  const source = `
    <template><div>{{ items }}</div></template>
    <script${sfcLang ? ` lang="${sfcLang}"` : ''}>
    export default {
      name: 'Test',
      data() { return { items: [] } },
      methods: { handleEvent() {} },
      mounted() { console.log(this.items) },
    }
    </script>
  `
  const ast = parse(source.replace(/<template>[\s\S]*?<\/template>/, '').replace(/<script[^>]*>/, '').replace(/<\/script>/, ''), { sourceType: 'module' })
  return {
    source,
    scriptAst: ast,
    sfc: {
      script: { lang: sfcLang, content: '', attrs: {}, loc: { start: { offset: 0, line: 0, column: 0 }, end: { offset: 0, line: 0, column: 0 } } },
      template: null,
      style: null,
      customBlocks: [],
      descriptor: {},
    },
    metadata: { lang, features: [], dependencies: [] },
    transforms: [],
    changed: false,
  } as any
}

function runConvert(file: any): string {
  const ctx: any = { file, utils: { markChanged: () => {}, manualReview: () => {} } }
  const result = convertOptionsToSetup(file, ctx)
  return result.setupCode + (result.injectedTopSetup?.length ? '\n' + result.injectedTopSetup.join('\n') : '')
}

function assertNoGeneric(name: string, code: string): void {
  if (!/ref<|reactive<|defineEmits<|defineProps</.test(code)) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (still has generic)\n     code: ${code}`)
    console.log(`  ✗ ${name} (still has generic)\n     code: ${code}`)
  }
}

function assertHasGeneric(name: string, code: string): void {
  if (/ref<|reactive<|defineEmits<|defineProps</.test(code)) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (no generic, but expected)\n     code: ${code}`)
    console.log(`  ✗ ${name} (no generic, but expected)\n     code: ${code}`)
  }
}

// ============ JS source → JS output (no generics) ============
console.log('\n[JS source → JS output]')

{
  const file = makeFile('js', 'js')
  const code = runConvert(file)
  assertNoGeneric('<script lang="js"> → no ref<reactive<', code)
}

{
  const file = makeFile('js', undefined)  // no lang attr
  const code = runConvert(file)
  assertNoGeneric('<script> (no lang) → no ref<reactive<', code)
}

{
  const file = makeFile(undefined, undefined)
  const code = runConvert(file)
  assertNoGeneric('metadata.lang undefined → no ref<reactive<', code)
}

// ============ TS source → TS output (with generics) ============
console.log('\n[TS source → TS output]')

{
  const file = makeFile('ts', 'ts')
  const code = runConvert(file)
  assertHasGeneric('<script lang="ts"> → has ref<reactive<', code)
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
