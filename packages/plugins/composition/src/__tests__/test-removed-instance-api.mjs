/**
 * iter-054: composition Vue 2 移除的 instance API 批量 review + mixins 字段
 *
 * 测 7 个 case:
 *   1) this.$children → 标 review
 *   2) this.$root → 标 review
 *   3) this.$vnode → 标 review
 *   4) this.$isServer → 标 review
 *   5) this.$isDestroyed → 标 review
 *   6) this.$options.componentName → 标 review
 *   7) mixins: [a, b] → 标 review
 *   8) 没有这些 → 不标 review
 *   9) 注释里 // this.$children → 不标 review
 */

import { parse as babelParse } from '@babel/parser'
import { convertOptionsToSetup } from '../options-to-setup.js'

let pass = 0
let fail = 0
const failures = []

function assert(name, cond, detail) {
  if (cond) { pass++; console.log(`  \u2713 ${name}`) }
  else { fail++; failures.push(`${name}\n     ${detail}`); console.log(`  \u2717 ${name}\n     ${detail}`) }
}

function buildFile(vue) {
  const scriptMatch = vue.match(/<script>([\s\S]*?)<\/script>/)
  if (!scriptMatch) throw new Error('no script')
  const scriptContent = scriptMatch[1]
  const start = scriptMatch.index + '<script>'.length
  const end = start + scriptContent.length
  const scriptAst = babelParse(scriptContent, {
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    plugins: ['jsx'],
  })
  return {
    source: vue,
    metadata: { lang: 'js' },
    path: '/test.vue',
    sfc: {
      script: {
        content: scriptContent,
        attrs: {},
        loc: { start: { offset: start }, end: { offset: end } },
      },
    },
    scriptAst,
    kind: 'vue',
  }
}

function runConvert(file) {
  const ctx = {
    file,
    project: { root: '/', stats: { filesScanned: 0, filesChanged: 0 }, storeNames: {} },
    utils: {
      markChanged: () => {},
      manualReview: () => {},
      reparse: () => {},
      syncScriptAstToSource: () => {},
    },
    log: () => {},
  }
  return convertOptionsToSetup(file, ctx)
}

// ============ 1) this.$children ============
console.log('\n[1) this.$children]')
{
  const vue = `<template><div /></template>
<script>
export default {
  mounted() {
    this.$children.forEach(c => c.refresh())
  }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('$children review', r.reviewItems.some((s) => s.includes('$children')), JSON.stringify(r.reviewItems))
}

// ============ 2) this.$root ============
console.log('\n[2) this.$root]')
{
  const vue = `<template><div /></template>
<script>
export default {
  methods: {
    go() { return this.$root.$store }
  }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('$root review', r.reviewItems.some((s) => s.includes('$root')), JSON.stringify(r.reviewItems))
}

// ============ 3) this.$vnode ============
console.log('\n[3) this.$vnode]')
{
  const vue = `<template><div /></template>
<script>
export default {
  mounted() {
    console.log(this.$vnode)
  }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('$vnode review', r.reviewItems.some((s) => s.includes('$vnode')), JSON.stringify(r.reviewItems))
}

// ============ 4) this.$isServer ============
console.log('\n[4) this.$isServer]')
{
  const vue = `<template><div /></template>
<script>
export default {
  data() { return { ssr: this.$isServer } }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('$isServer review', r.reviewItems.some((s) => s.includes('$isServer')), JSON.stringify(r.reviewItems))
}

// ============ 5) this.$isDestroyed ============
console.log('\n[5) this.$isDestroyed]')
{
  const vue = `<template><div /></template>
<script>
export default {
  beforeDestroy() {
    if (this.$isDestroyed) return
  }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('$isDestroyed review', r.reviewItems.some((s) => s.includes('$isDestroyed')), JSON.stringify(r.reviewItems))
}

// ============ 6) this.$options.componentName ============
console.log('\n[6) this.$options.componentName]')
{
  const vue = `<template><div /></template>
<script>
export default {
  name: 'MyComponent',
  mounted() {
    console.log(this.$options.componentName)
  }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('$options.componentName review', r.reviewItems.some((s) => s.includes('$options.componentName')), JSON.stringify(r.reviewItems))
  assert('mentions defineOptions', r.reviewItems.some((s) => s.includes('defineOptions')), JSON.stringify(r.reviewItems))
}

// ============ 7) mixins: [...] ============
console.log('\n[7) mixins: [a, b]]')
{
  const vue = `<template><div /></template>
<script>
export default {
  mixins: [resizeMixin, fetchMixin],
  data() { return { x: 1 } }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('mixins review', r.reviewItems.some((s) => s.includes('mixins:')), JSON.stringify(r.reviewItems))
  assert('mentions composables', r.reviewItems.some((s) => s.includes('composables')), JSON.stringify(r.reviewItems))
  assert('mentions both mixin names', r.reviewItems.some((s) => s.includes('resizeMixin') && s.includes('fetchMixin')), JSON.stringify(r.reviewItems))
}

// ============ 8) 没有这些 → 不标 ============
console.log('\n[8) no removed API]')
{
  const vue = `<template><div /></template>
<script>
export default {
  data() { return { x: 1 } }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('no $children review', !r.reviewItems.some((s) => s.includes('$children')), JSON.stringify(r.reviewItems))
  assert('no $root review', !r.reviewItems.some((s) => s.includes('$root')), JSON.stringify(r.reviewItems))
  assert('no $vnode review', !r.reviewItems.some((s) => s.includes('$vnode')), JSON.stringify(r.reviewItems))
  assert('no mixins review', !r.reviewItems.some((s) => s.includes('mixins:')), JSON.stringify(r.reviewItems))
}

// ============ 9) 注释里的 $children → 不标 ============
console.log('\n[9) // BUG fix: this.$children was removed]')
{
  const vue = `<template><div /></template>
<script>
// BUG fix: this.$children was removed in Vue 3
export default {
  data() { return { x: 1 } }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  assert('no $children review (comment only)', !r.reviewItems.some((s) => s.includes('$children')), JSON.stringify(r.reviewItems))
}

// ============ 10) 多处同一 API ============
console.log('\n[10) multiple this.$children calls]')
{
  const vue = `<template><div /></template>
<script>
export default {
  mounted() {
    this.$children.forEach(c => c.refresh())
    this.$children.length
  }
}
</script>`
  const file = buildFile(vue)
  const r = runConvert(file)
  const review = r.reviewItems.find((s) => s.includes('$children'))
  assert('says 2 次', review && /2 \u6b21/.test(review), review)
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
