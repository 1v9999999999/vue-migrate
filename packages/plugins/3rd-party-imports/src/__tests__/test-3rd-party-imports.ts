/**
 * @vue-migrate/plugin-3rd-party-imports unit tests
 *
 * 测两个核心规则：
 *   - fixEchartsImports
 *   - fixDefaultToNamespace
 *
 * 测法：构造 mock TransformContext + AST，调规则，验证 specifier 形态。
 */

import * as t from '@babel/types'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import { parse as _parse } from '@babel/parser'
import { fixEchartsImports } from '../rules/echarts.js'
import { fixDefaultToNamespace } from '../rules/import-default-to-namespace.js'

const traverse = (_traverse as any).default || _traverse
const generate = (_generate as any).default || _generate
const parse = _parse as any

let pass = 0
let fail = 0
const failures: string[] = []

function assertEq<T>(name: string, actual: T, expected: T): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     actual:   ${JSON.stringify(actual)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     actual:   ${JSON.stringify(actual)}\n     expected: ${JSON.stringify(expected)}`)
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

interface MockCtx {
  file: { scriptAst: any }
  utils: { markChanged: (s: string) => void; messages: string[] }
}

function makeCtx(source: string): MockCtx {
  const ast = parse(source, { sourceType: 'module' })
  const messages: string[] = []
  const ctx: MockCtx = {
    file: { scriptAst: ast },
    utils: {
      markChanged(s: string) {
        messages.push(s)
      },
      get messages() {
        return messages
      },
    } as any,
  }
  return ctx
}

function genSource(ast: any): string {
  return generate(ast).code
}

// ============ fixEchartsImports ============
console.log('\n[fixEchartsImports]')

// 1) default import → namespace import
{
  const ctx = makeCtx(`import echarts from 'echarts'`)
  const r = fixEchartsImports(ctx)
  assertTrue('default → namespace, 触发 changed', r.changed)
  const out = genSource(ctx.file.scriptAst)
  assertTrue('输出含 import * as echarts', out.includes('* as echarts'))
  assertTrue('输出不再有 default import', !/import\s+echarts\s+from/.test(out))
  assertTrue('markChanged 被调', (ctx.utils as any).messages.length === 1)
}

// 2) 已经是 namespace import 不动
{
  const ctx = makeCtx(`import * as echarts from 'echarts'`)
  const r = fixEchartsImports(ctx)
  assertTrue('namespace 形式不动', !r.changed)
}

// 3) 已经是 named import 不动
{
  const ctx = makeCtx(`import { init } from 'echarts'`)
  const r = fixEchartsImports(ctx)
  assertTrue('named 形式不动', !r.changed)
}

// 4) default + named 混合 → 改 namespace
{
  const ctx = makeCtx(`import echarts, { init } from 'echarts'`)
  const r = fixEchartsImports(ctx)
  assertTrue('混合形式也改', r.changed)
  const out = genSource(ctx.file.scriptAst)
  assertTrue('输出 * as echarts', out.includes('* as echarts'))
}

// 5) sub-path 不动 (echarts/lib/...)
{
  const ctx = makeCtx(`import echarts from 'echarts/lib/echarts'`)
  const r = fixEchartsImports(ctx)
  assertTrue('sub-path 不动', !r.changed)
}

// 6) 重命名 import (import Foo from 'echarts')
{
  const ctx = makeCtx(`import Foo from 'echarts'`)
  const r = fixEchartsImports(ctx)
  assertTrue('重命名 default 也改', r.changed)
  const out = genSource(ctx.file.scriptAst)
  assertTrue('保留本地名 Foo', out.includes('* as Foo'))
}

// 7) 多个 import 中只有 echarts 改
{
  const ctx = makeCtx(`import echarts from 'echarts'\nimport Vue from 'vue'\nimport _ from 'lodash'`)
  const r = fixEchartsImports(ctx)
  assertTrue('多 import 中只改 echarts', r.changed)
  const out = genSource(ctx.file.scriptAst)
  assertTrue('echarts 改 namespace', out.includes('* as echarts'))
  assertTrue('Vue 保留', out.includes(`import Vue from 'vue'`))
  assertTrue('lodash 保留', out.includes(`import _ from 'lodash'`))
}

// ============ fixDefaultToNamespace ============
console.log('\n[fixDefaultToNamespace]')

// 1) screenfull 改 namespace
{
  const ctx = makeCtx(`import screenfull from 'screenfull'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', localName: 'screenfull', reason: 'test' },
  ])
  assertTrue('screenfull 触发 changed', r.changed)
  assertTrue('hits 含 screenfull', r.hits.some((h) => h.includes('screenfull')))
  const out = genSource(ctx.file.scriptAst)
  assertTrue('输出 * as screenfull', out.includes('* as screenfull'))
}

// 2) 不在 rules 里的不动
{
  const ctx = makeCtx(`import Vue from 'vue'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', reason: 'test' },
  ])
  assertTrue('非规则包不动', !r.changed)
}

// 3) 已经是 named import 不动
{
  const ctx = makeCtx(`import { foo } from 'screenfull'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', reason: 'test' },
  ])
  assertTrue('named 形式不动', !r.changed)
}

// 4) 已经是 namespace 不动
{
  const ctx = makeCtx(`import * as screenfull from 'screenfull'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', reason: 'test' },
  ])
  assertTrue('namespace 形式不动', !r.changed)
}

// 5) sub-path 不动
{
  const ctx = makeCtx(`import x from 'screenfull/lib/index'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', reason: 'test' },
  ])
  assertTrue('sub-path 不动', !r.changed)
}

// 6) 多个 rules
{
  const ctx = makeCtx(`import a from 'screenfull'\nimport b from 'foo-bar'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', reason: 'r1' },
    { name: 'foo-bar', reason: 'r2' },
  ])
  assertTrue('多 rules 都改', r.changed)
  assertTrue('hits 包含 2 项', r.hits.length === 2)
}

// 7) 复合 import: default + namespace 共存
{
  const ctx = makeCtx(`import screenfull from 'screenfull'\nimport * as echarts from 'echarts'`)
  const r = fixDefaultToNamespace(ctx, [
    { name: 'screenfull', reason: 'test' },
  ])
  assertTrue('screenfull 改', r.changed)
  const out = genSource(ctx.file.scriptAst)
  assertTrue('echarts 保留 namespace', out.includes('* as echarts'))
  assertTrue('screenfull 改 namespace', out.includes('* as screenfull'))
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
