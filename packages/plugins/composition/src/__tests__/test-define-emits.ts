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

console.log(`\npass ${pass}\nfail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
