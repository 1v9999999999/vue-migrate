/**
 * @vue-migrate/plugin-composition iter-046 unit tests
 * 验证 defineEmits 包含收集到的事件名 + 已有 <script setup> 缺 defineProps/Emits 时自动补
 */

import { convertOptionsToSetup } from '../options-to-setup.js'

let pass = 0
let fail = 0
const failures: string[] = []

// @ts-ignore
import { parse } from '@babel/parser'

function makeFile(path: string, source: string) {
  // 找 <script> ... </script> 块, 模拟 SFC 解析结果
  const scriptMatch = source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)
  if (!scriptMatch) {
    throw new Error(`No <script> block found in ${path}`)
  }
  const scriptInner = scriptMatch[1]
  // 解析 scriptInner 成 AST
  const lang = (source.match(/<script\b[^>]*lang=["']([^"']+)["']/i) || [])[1] || 'js'
  let scriptAst: any = null
  try {
    scriptAst = parse(scriptInner, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      plugins: lang === 'ts' ? ['typescript'] : [],
    })
  } catch (e: any) {
    console.error('parse error:', e.message)
  }
  return {
    path,
    source,
    kind: 'vue',
    scriptAst,
    transforms: [],
    changed: false,
    metadata: { features: [], dependencies: [], lang },
    sfc: {
      script: {
        content: scriptInner,
        attrs: lang === 'ts' ? { lang: 'ts' } : {},
        loc: {
          start: { offset: scriptMatch.index! + scriptMatch[0].indexOf('>') + 1, line: 0, column: 0 },
          end: { offset: scriptMatch.index! + scriptMatch[0].length - '</script>'.length, line: 0, column: 0 },
        },
      },
      template: null,
      style: null,
      customBlocks: [],
      descriptor: null,
    },
  }
}

function runConvert(file: any) {
  const ctx: any = {
    file,
    project: { files: new Map(), root: '/', stats: { manualReviewRequired: 0 }, storeNames: {} },
    utils: { markChanged: () => {}, manualReview: () => {} },
    log: () => {},
  }
  return convertOptionsToSetup(file, ctx)
}

function assertContains(name: string, output: string, must: string[]) {
  const missing = must.filter((s) => !output.includes(s))
  if (missing.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - missing: ${missing.join(', ')}\n     output (first 800):\n${output.slice(0, 800)}`)
    console.log(`  ✗ ${name} - missing: ${missing.join(', ')}`)
  }
}

function assertNotContains(name: string, output: string, mustNot: string[]) {
  const present = mustNot.filter((s) => output.includes(s))
  if (present.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - should NOT contain: ${present.join(', ')}\n     output (first 800):\n${output.slice(0, 800)}`)
    console.log(`  ✗ ${name} - should NOT contain: ${present.join(', ')}`)
  }
}

console.log('\n[defineEmits: collects event names from this.$emit calls]')
{
  const input = `<template><div @click="handleClick">x</div></template>
<script>
export default {
  methods: {
    handleClick() {
      this.$emit('click')
      this.$emit('update', payload)
      this.$emit('close')
    }
  }
}
</script>`

  const file = makeFile('/test/A.vue', input)
  const result = runConvert(file)
  const code = result.setupCode

  assertContains('emitNames collected: click/update/close',
    Array.from(result.emitNames).sort().join(','),
    ['click', 'close', 'update'])
  assertContains('defineEmits with sorted event names',
    code,
    [`defineEmits([`])
  assertContains('all 3 events in defineEmits array',
    code,
    [`'click'`, `'close'`, `'update'`])
}

console.log('\n[defineEmits: empty (no this.$emit in source)]')
{
  const input = `<template><div>x</div></template>
<script>
export default {
  data() { return { x: 1 } }
}
</script>`

  const file = makeFile('/test/B.vue', input)
  const result = runConvert(file)
  const code = result.setupCode

  assertContains('no defineEmits when no $emit in source',
    result.emitNames.size === 0 ? 'empty' : 'has',
    ['empty'])
  assertContains('code does not contain defineEmits',
    code.includes('defineEmits') ? 'has' : 'no',
    ['no'])
}

console.log('\n[defineEmits: TS mode (typed) emits as defineEmits<{...}>()]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    handleClick() {
      this.$emit('update:visible', false)
      this.$emit('change', val)
    }
  }
}
</script>`

  const file = makeFile('/test/C.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const result = runConvert(file)
  const code = result.setupCode

  // iter-082: TS 模式现在生成 `interface EmitsPayloads` + `defineEmits<EmitsPayloads>()`
  // (代替 iter-046 的 inline `defineEmits<{...}>()`)
  assertContains('TS defineEmits uses EmitsPayloads interface (iter-082)', code, ['defineEmits<EmitsPayloads>()'])
  assertContains('TS defineEmits declares EmitsPayloads interface', code, ['interface EmitsPayloads'])
  assertContains('TS events in generic: update:visible + change',
    code,
    ['update:visible', 'change'])
}

console.log('\n[defineProps: JS path with type info from source]')
{
  // 用户写 props: { title: { type: String, default: 'Hello' }, count: { type: Number, default: 0 } }
  // JS 路径下,我们应该输出 const props = defineProps({ title: { type: String, default: 'Hello' }, count: { type: Number, default: 0 } })
  const input = `<template><div>{{ props.title }}</div></template>
<script>
export default {
  props: {
    title: { type: String, default: 'Hello' },
    count: { type: Number, default: 0 },
    items: { type: Array, default: () => [] }
  },
  methods: {
    f() { return this.title }
  }
}
</script>`

  const file = makeFile('/test/D.vue', input)
  const result = runConvert(file)
  const code = result.setupCode

  // generator 美化输出, 多行, 不强求单行
  assertContains('JS defineProps preserves type for title', code, ["type: String"])
  assertContains('JS defineProps preserves type for count', code, ["type: Number"])
  assertContains('JS defineProps preserves type for items', code, ["type: Array"])
  assertContains('JS defineProps preserves default for title', code, ["default: 'Hello'"])
  assertContains('JS defineProps preserves default for count', code, ['default: 0'])
  assertContains('JS defineProps preserves default for items (factory fn)', code, ['default: () => []'])
}

console.log('\n[defineProps: JS path with simple identifier type]')
{
  // props: { title: String, count: Number } — 直接用 identifier
  const input = `<template><div>{{ props.title }}</div></template>
<script>
export default {
  props: {
    title: String,
    count: Number
  },
  methods: {
    f() { return this.title }
  }
}
</script>`

  const file = makeFile('/test/E.vue', input)
  const result = runConvert(file)
  const code = result.setupCode

  assertContains('JS simple identifier prop preserved as identifier (or wrapped)', code, [
    'title:', 'count:',
  ])
}

// ============================================================
// iter-082: arg count 推断 (TS 模式 interface EmitsPayloads)
// ============================================================

console.log('\n[iter-082 arg count: zero args → [] tuple]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    close() { this.$emit('close') },
    open() { this.$emit('open') }
  }
}
</script>`
  const file = makeFile('/test/iter082-0.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  assertContains('zero-arg event → [] tuple', code, ['close: []'])
  assertContains('zero-arg event → [] tuple (open)', code, ['open: []'])
}

console.log('\n[iter-082 arg count: single arg → [arg1: any]]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    onClick() { this.$emit('click', id) }
  }
}
</script>`
  const file = makeFile('/test/iter082-1.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  assertContains('single-arg event → [arg1: any]', code, ['click: [arg1: any]'])
}

console.log('\n[iter-082 arg count: two args → [arg1: any, arg2: any]]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    update() { this.$emit('update', id, value) }
  }
}
</script>`
  const file = makeFile('/test/iter082-2.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  assertContains('two-arg event → [arg1: any, arg2: any]', code, ['update: [arg1: any, arg2: any]'])
}

console.log('\n[iter-082 arg count: repeated emit with different arg counts → max wins]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    handler() {
      this.$emit('change')          // 0 args
      this.$emit('change', x)       // 1 arg
      this.$emit('change', x, y)    // 2 args
    }
  }
}
</script>`
  const file = makeFile('/test/iter082-max.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  // max 应该是 2, 但同一个 event 在多次调用中, take max(count)
  // 注意: 这里生成的 tuple shape 是 [arg1: any, arg2: any]
  assertContains('repeated emit takes max arg count', code, ['change: [arg1: any, arg2: any]'])
}

console.log('\n[iter-082 arg count: nested ()/[]/{} commas NOT counted as args]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    handler() {
      this.$emit('search', { a: 1, b: 2 }, [1, 2, 3], fn(x, y))
    }
  }
}
</script>`
  const file = makeFile('/test/iter082-nested.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  // {a:1, b:2} 是 1 arg, [1,2,3] 是 1 arg, fn(x,y) 是 1 arg, 总共 3 args
  assertContains('nested commas ignored, only 3 top-level args', code, ['search: [arg1: any, arg2: any, arg3: any]'])
}

console.log('\n[iter-082 arg count: string literal with embedded comma is ONE arg]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    show() { this.$emit('msg', 'a,b,c') }
  }
}
</script>`
  const file = makeFile('/test/iter082-str.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  // 'a,b,c' 是单个 string literal, 内部 `,` 不算 arg 分隔
  assertContains('string literal commas ignored', code, ['msg: [arg1: any]'])
}

console.log('\n[iter-082 arg count: object literal commas NOT counted]')
{
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    set() { this.$emit('config', { a: 1, b: 2, c: 3 }) }
  }
}
</script>`
  const file = makeFile('/test/iter082-obj.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  // {a:1, b:2, c:3} 是单个 object literal
  assertContains('object literal commas ignored', code, ['config: [arg1: any]'])
}

console.log('\n[iter-082 arg count: dynamic event name (lenient — prefix captured as static)]')
{
  // 已知行为: regex `(['"`])([^'"`]+)\1` 把 'foo' 静态部分当 event name (不管后面 `+ bar` 拼接)
  // 这是 iter-081 风险 2 提到的 (regex-based leniency 限制), 见 plan
  const input = `<template><div></div></template>
<script lang="ts">
export default {
  methods: {
    handler() {
      this.$emit('foo' + bar)  // 动态 event name, 但 regex 仍把 'foo' 抓走
    }
  }
}
</script>`
  const file = makeFile('/test/iter082-dyn.vue', input)
  file.sfc.script.attrs.lang = 'ts'
  const { setupCode: code } = runConvert(file)
  // 实际行为: 'foo' 出现在 emitNames, argsStr=' + bar' 算 0 args (字符串字面量被 regex 吃掉了部分)
  assertContains('dynamic emit: prefix "foo" captured as static event name', code, ['foo: []'])
  assertNotContains('NO EmitsPayloads interface (we DO generate it)', code, ['defineEmits<any>()'])
}

console.log(`\npass ${pass}\nfail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
