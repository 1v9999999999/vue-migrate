/**
 * @vue-migrate/plugin-i18n-migrate unit tests
 * iter-121: vue-i18n v8 → v9 迁移
 *
 * 测：
 *   - 8 个 script AST 场景: this.$t/$tc/$i18n.t/$i18n.locale/Vue.use/default import/无 vue-i18n
 *   - 2 个 template 场景: {{ $t(...) }} 在 setup vs options 模式下行为不同
 *
 * 注意：直接调 plugin 的 transform 钩子需要完整 ctx, 比较重。
 * 这里只测核心检测函数 (i18n-script.ts, i18n-template.ts)。
 */

import { parse } from '@babel/parser'
import { migrateI18nScript } from '../rules/i18n-script.js'
import { transformI18nTemplate } from '../rules/i18n-template.js'

let pass = 0
let fail = 0
const failures: string[] = []

function makeCtx(source: string): any {
  let ast: any = null
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'classProperties'] })
  } catch {
    ast = parse(source, { sourceType: 'module' })
  }
  const reviews: string[] = []
  const file: any = { scriptAst: ast, source, path: '/test.js', kind: 'js' }
  return {
    file,
    utils: {
      markChanged: (_msg: string) => {},
      manualReview: (msg: string) => { reviews.push(msg) },
    },
    _reviews: reviews,
  }
}

function assertTrue(name: string, cond: boolean): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name}`)
  }
}

function assertContains(name: string, items: string[], substr: string): void {
  const found = items.some(i => i.includes(substr))
  if (found) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (expected to contain "${substr}", got: ${JSON.stringify(items)})`)
    console.log(`  ✗ ${name} (expected to contain "${substr}")`)
  }
}

// ============ 1. this.$t detection ============
console.log('\n[i18n v8 script patterns]')

{
  const src = `
export default {
  mounted() {
    console.log(this.$t('welcome', { name: 'vue' }))
  }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-1: detects 1 review (this.$t)', r.reviewItems.length === 1)
  assertContains('I18N-1: review mentions $t', r.reviewItems, '$t')
  assertTrue('I18N-1: hasUseI18n=false (no useI18n import)', r.hasUseI18n === false)
  assertTrue('I18N-1: hasVueI18nImport=false', r.hasVueI18nImport === false)
}

// ============ 2. this.$tc detection ============
{
  const src = `
export default {
  methods: {
    showCount(n) {
      return this.$tc('apples', n)
    }
  }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-2: detects $tc', r.reviewItems.length === 1)
  assertContains('I18N-2: review mentions $tc', r.reviewItems, '$tc')
}

// ============ 3. this.$i18n.t detection ============
{
  const src = `
export default {
  methods: {
    show() {
      return this.$i18n.t('key', { x: 1 })
    }
  }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-3: detects $i18n.t', r.reviewItems.length === 1)
  assertContains('I18N-3: review mentions $i18n.t', r.reviewItems, '$i18n.t')
}

// ============ 4. this.$i18n.locale assignment detection ============
{
  const src = `
export default {
  mounted() {
    this.$i18n.locale = 'en'
  }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-4: detects $i18n.locale assignment', r.reviewItems.length === 1)
  assertContains('I18N-4: review mentions locale', r.reviewItems, 'locale')
  assertContains('I18N-4: review mentions .value', r.reviewItems, '.value')
}

// ============ 5. Vue.use(VueI18n) detection ============
{
  const src = `
import VueI18n from 'vue-i18n'
Vue.use(VueI18n)
const i18n = new VueI18n({ locale: 'en' })
export default i18n
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-5: detects Vue.use + default import (2 reviews)', r.reviewItems.length === 2)
  assertContains('I18N-5: review mentions Vue.use', r.reviewItems, 'Vue.use')
  assertContains('I18N-5: review mentions createI18n', r.reviewItems, 'createI18n')
}

// ============ 6. import VueI18n from 'vue-i18n' default import ============
{
  const src = `
import VueI18n from 'vue-i18n'
const i18n = new VueI18n({ locale: 'en' })
export default i18n
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-6: detects default import (1 review)', r.reviewItems.length === 1)
  assertContains('I18N-6: review mentions createI18n', r.reviewItems, 'createI18n')
}

// ============ 7. Already-imported useI18n → no reviews ============
{
  const src = `
import { useI18n } from 'vue-i18n'
export default {
  setup() {
    const { t, locale } = useI18n()
    return { t, locale }
  }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-7: hasUseI18n=true', r.hasUseI18n === true)
  assertTrue('I18N-7: no reviews (v9 already)', r.reviewItems.length === 0)
}

// ============ 8. import { createI18n } from 'vue-i18n' (no useI18n but v9) ============
{
  const src = `
import { createI18n } from 'vue-i18n'
const i18n = createI18n({ locale: 'en' })
export default i18n
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-8: hasUseI18n=true (createI18n implies v9)', r.hasUseI18n === true)
  assertTrue('I18N-8: no reviews', r.reviewItems.length === 0)
}

// ============ 9. No i18n usage at all ============
{
  const src = `
export default {
  data() { return { count: 0 } },
  mounted() { console.log('hi') }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-9: no reviews when no i18n usage', r.reviewItems.length === 0)
  assertTrue('I18N-9: hasUseI18n=false', r.hasUseI18n === false)
  assertTrue('I18N-9: hasVueI18nImport=false', r.hasVueI18nImport === false)
}

// ============ 10. Multiple patterns in one file ============
{
  const src = `
import VueI18n from 'vue-i18n'
Vue.use(VueI18n)
export default {
  mounted() {
    this.$i18n.locale = 'zh'
    console.log(this.$t('hello'))
    console.log(this.$tc('apple', 3))
    console.log(this.$i18n.t('key'))
  }
}
`
  const ctx = makeCtx(src)
  const r = migrateI18nScript(ctx)
  assertTrue('I18N-10: detects 5+ reviews (Vue.use + import + 4 calls)', r.reviewItems.length >= 5)
}

// ============ Template tests ============
console.log('\n[i18n v8 template patterns]')

// 1. {{ $t(...) }} with hasUseI18n=true → auto-rewrite
{
  const tpl = `<div>{{ $t('hello') }}</div>`
  const r = transformI18nTemplate(tpl, true)
  assertTrue('TPL-1: changed with hasUseI18n', r.changed === true)
  assertTrue('TPL-1: rewrote $t → t', r.out.includes(`{{ t('hello') }}`))
  assertTrue('TPL-1: no reviews', r.reviewItems.length === 0)
}

// 2. {{ $t(...) }} with hasUseI18n=false → review only, no change
{
  const tpl = `<div>{{ $t('hello') }}</div>`
  const r = transformI18nTemplate(tpl, false)
  assertTrue('TPL-2: not changed (review mode)', r.changed === false)
  assertTrue('TPL-2: 1 review', r.reviewItems.length === 1)
  assertContains('TPL-2: review mentions $t', r.reviewItems, '$t')
  assertTrue('TPL-2: source unchanged', r.out === tpl)
}

// 3. {{ $tc(...) }} with hasUseI18n=true → rewrite
{
  const tpl = `<div>{{ $tc('apple', n) }}</div>`
  const r = transformI18nTemplate(tpl, true)
  assertTrue('TPL-3: $tc rewritten', r.changed && r.out.includes(`{{ t('apple', n)`))
}

// 4. attribute :title="$t('key')" with hasUseI18n=false → review
{
  const tpl = `<a-input :title="$t('placeholder')" />`
  const r = transformI18nTemplate(tpl, false)
  assertTrue('TPL-4: review emitted for attribute', r.reviewItems.length >= 1)
  assertTrue('TPL-4: not changed', r.changed === false)
}

// 5. attribute :title="$t('key')" with hasUseI18n=true → auto-rewrite
{
  const tpl = `<a-input :title="$t('placeholder')" />`
  const r = transformI18nTemplate(tpl, true)
  assertTrue('TPL-5: changed', r.changed === true)
  assertTrue('TPL-5: $t in attr rewritten to t', r.out.includes(`:title="t('placeholder')"`))
}

// 6. no $t at all → no change, no review
{
  const tpl = `<div>Hello</div>`
  const r = transformI18nTemplate(tpl, false)
  assertTrue('TPL-6: no $t → no change', r.changed === false)
  assertTrue('TPL-6: no reviews', r.reviewItems.length === 0)
}

// ============ Summary ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f.split('\n')[0]}`)
  process.exit(1)
}
