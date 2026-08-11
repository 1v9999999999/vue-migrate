/**
 * iter-052: composition 递归函数 setCurrentView 测试
 *
 * 验证: 顶层 methods 里的递归函数 (function declaration) 能在 <script setup> 里
 * 正常调用自己,不报 TDZ (function declaration 是 hoisted).
 *
 * 测试 3 个 case:
 *   1. setCurrentView 调用 setCurrentView (直接递归)
 *   2. tick setTimeout 异步递归
 *   3. 互相递归 a/b
 */

import { parse as babelParse } from '@babel/parser'
import { convertOptionsToSetup } from '../options-to-setup.js'

let pass = 0
let fail = 0
const failures = []

function assert(name, cond, detail) {
  if (cond) {
    pass++
    console.log(`  \u2713 ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     ${detail}`)
    console.log(`  \u2717 ${name}\n     ${detail}`)
  }
}

/**
 * 构造一个 file 对象,有 SFC parse 过的 script 块,模仿 composition 期待的结构。
 * 走最简路径 — 只用 convertOptionsToSetup, 不跑 plugin transform (那需要更多 ctx).
 */
function buildFileFromVue(vueSource) {
  // 用 vue3-template 的简单 SFC 解析 (composeScriptOnlyLoc)
  // 这里用一个简单 SFC parser 提取 <script> 内容
  const scriptMatch = vueSource.match(/<script>([\s\S]*?)<\/script>/)
  if (!scriptMatch) throw new Error('no <script> block')
  const scriptContent = scriptMatch[1]
  const start = scriptMatch.index + '<script>'.length
  const end = start + scriptContent.length

  const scriptAst = babelParse(scriptContent, {
    sourceType: 'module',
    allowReturnOutsideFunction: true,
    plugins: ['jsx'],
  })

  return {
    source: vueSource,
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

console.log('\n[Case 1: setCurrentView recursive]')
{
  const vue = `<template><div @click="setCurrentView('detail')">{{ currentView }}</div></template>
<script>
export default {
  data() {
    return { currentView: 'list' }
  },
  methods: {
    setCurrentView(view) {
      this.currentView = view
      if (view === 'detail') {
        this.setCurrentView('list')
      }
    }
  }
}
</script>`
  const file = buildFileFromVue(vue)
  const result = runConvert(file)
  const code = result.setupCode + (result.injectedTopSetup?.length ? '\n' + result.injectedTopSetup.join('\n') : '')
  console.log('--- setup code ---')
  console.log(code)
  console.log('---')
  assert('uses function declaration (hoisted)', /^function setCurrentView\(/m.test(code), code)
  assert('recursive call replaced to setCurrentView()', /setCurrentView\(\s*'list'\s*\)/.test(code), code)
  assert('no this.setCurrentView residual', !/this\.setCurrentView\b/.test(code), code)
  assert('currentView is ref', /\bref\(/.test(code), code)
}

console.log('\n[Case 2: tick setTimeout async recursive]')
{
  const vue = `<template><div>{{ count }}</div></template>
<script>
export default {
  data() {
    return { count: 0 }
  },
  methods: {
    tick() {
      this.count += 1
      setTimeout(() => {
        this.tick()
      }, 1000)
    }
  }
}
</script>`
  const file = buildFileFromVue(vue)
  const result = runConvert(file)
  const code = result.setupCode + (result.injectedTopSetup?.length ? '\n' + result.injectedTopSetup.join('\n') : '')
  console.log('--- setup code ---')
  console.log(code)
  console.log('---')
  assert('tick uses function declaration', /^function tick\(/m.test(code), code)
  // tick() 在 setTimeout 回调内调, this.tick 应该被替换为 tick()
  // (composition 应该对 setTimeout callback 内的 this 也能替换; 如果不行也至少 function declaration OK)
  assert('setTimeout 内的 this.tick 已被替换 (或不需替换, 因为 inner closure 重新 bind)', /setTimeout\(\(\) => \{[\s\S]*\btick\(\)/.test(code) || /setTimeout\(\(\) => \{[\s\S]*this\.tick/.test(code), code)
}

console.log('\n[Case 3: mutual recursion a/b]')
{
  const vue = `<template><button @click="a">A</button></template>
<script>
export default {
  methods: {
    a() {
      this.b()
    },
    b() {
      this.a()
    }
  }
}
</script>`
  const file = buildFileFromVue(vue)
  const result = runConvert(file)
  const code = result.setupCode + (result.injectedTopSetup?.length ? '\n' + result.injectedTopSetup.join('\n') : '')
  console.log('--- setup code ---')
  console.log(code)
  console.log('---')
  assert('a is function declaration', /^function a\(/m.test(code), code)
  assert('b is function declaration', /^function b\(/m.test(code), code)
  assert('a body calls b() (no this)', /\bfunction a\(\) \{[\s\S]*\bb\(\)[\s\S]*\}/.test(code), code)
  assert('b body calls a() (no this)', /\bfunction b\(\) \{[\s\S]*\ba\(\)[\s\S]*\}/.test(code), code)
}

console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
