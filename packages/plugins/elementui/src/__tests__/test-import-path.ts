/**
 * @vue-migrate/plugin-elementui unit tests (iter-044 B2)
 *
 * 测 `element-ui/lib/locale/...` 路径替换
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import _generate from '@babel/generator'

const _genObj: any = (_generate as any)
const generate = (ast: any): string => (_genObj.default || _genObj)(ast).code

// 复制一份 import-path 的收集函数,只测 src 改写
import { collectElementUIImports } from '../rules/import-path.js'

// 模拟 ctx
function makeCtx(source: string) {
  const ast = parse(source, { sourceType: 'module' })
  const marks: string[] = []
  const reviews: string[] = []
  return {
    file: { scriptAst: ast, source, path: '/main.js' },
    utils: {
      markChanged: (msg: string) => marks.push(msg),
      manualReview: (msg: string) => reviews.push(msg),
    },
    _marks: marks,
    _reviews: reviews,
  }
}

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

// ============ B2: locale 路径替换 ============
console.log('\n[B2: locale path]')

// 1) en lang
{
  const src = `import enLang from 'element-ui/lib/locale/lang/en';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B2-1: src 改为 element-plus/lib/locale/lang/en', out.includes('"element-plus/lib/locale/lang/en"') || out.includes("'element-plus/lib/locale/lang/en'"))
  assertTrue('B2-1: hasLocale=true', info.hasLocale === true)
  assertTrue('B2-1: 记录了改动', ctx._marks.some(m => m.includes('locale')))
}

// 2) zh-CN lang
{
  const src = `import zhCN from 'element-ui/lib/locale/lang/zh-CN';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B2-2: src 改为 element-plus/lib/locale/lang/zh-CN', out.includes('"element-plus/lib/locale/lang/zh-CN"') || out.includes("'element-plus/lib/locale/lang/zh-CN'"))
  assertTrue('B2-2: hasLocale=true', info.hasLocale === true)
}

// 3) 不带 lang 路径
{
  const src = `import x from 'element-ui/lib/locale';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B2-3: bare locale 改 element-plus/lib/locale', out.includes('"element-plus/lib/locale"') || out.includes("'element-plus/lib/locale'"))
  assertTrue('B2-3: hasLocale=true', info.hasLocale === true)
}

// 4) 主包 + locale 一起
{
  const src = `import Element from 'element-ui';
import enLang from 'element-ui/lib/locale/lang/en';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B2-4: 主包改 element-plus', out.includes('"element-plus"') || out.includes("'element-plus'"))
  assertTrue('B2-4: locale 改 element-plus/lib/locale/lang/en', out.includes('"element-plus/lib/locale/lang/en"') || out.includes("'element-plus/lib/locale/lang/en'"))
  assertTrue('B2-4: hasLocale=true', info.hasLocale === true)
}

// 5) element-plus 已被提前改过的情况(罕见,不应该误伤)
{
  const src = `import enLang from 'element-plus/lib/locale/lang/en';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  // 不该再触发 B2 规则
  assertTrue('B2-5: 已 element-plus 不再动', out === src)
  assertTrue('B2-5: hasLocale=false', info.hasLocale === false)
}

// 6) 不相关 import 不触发
{
  const src = `import x from 'element-ui/lib/other/path';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B2-6: 非 locale 路径不动', out === src)
  assertTrue('B2-6: hasLocale=false', info.hasLocale === false)
}

// ============ B7: deep import 路径映射 ============
console.log('\n[B7: deep import path]')

// 1) element-ui/src/utils/resize-event
{
  const src = `import { addResizeListener, removeResizeListener } from 'element-ui/src/utils/resize-event';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B7-1: src 改 element-plus/lib/utils/resize-event', out.includes('"element-plus/lib/utils/resize-event"') || out.includes("'element-plus/lib/utils/resize-event'"))
  assertTrue('B7-1: hasDeepImport=true', info.hasDeepImport === true)
  assertTrue('B7-1: 标 review 提示验证路径', ctx._reviews.some(r => r.includes('deep import')))
}

// 2) element-ui/packages/xxx
{
  const src = `import x from 'element-ui/packages/some-pkg/index';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B7-2: packages/ 映射', out.includes('"element-plus/some-pkg/index"') || out.includes("'element-plus/some-pkg/index'"))
  assertTrue('B7-2: hasDeepImport=true', info.hasDeepImport === true)
}

// 3) element-ui/lib/ 已有规则 (theme-chalk CSS, locale) 不冲突
{
  const src = `import enLang from 'element-ui/lib/locale/lang/en';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B7-3: locale 走 B2 规则', out.includes('"element-plus/lib/locale/lang/en"') || out.includes("'element-plus/lib/locale/lang/en'"))
  assertTrue('B7-3: hasLocale=true', info.hasLocale === true)
  assertTrue('B7-3: hasDeepImport=false (不是 deep import)', info.hasDeepImport === false)
}

// 4) 完全不相关 import 不触发
{
  const src = `import x from 'lodash';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B7-4: 无关 import 不动', out === src)
  assertTrue('B7-4: hasDeepImport=false', info.hasDeepImport === false)
  assertTrue('B7-4: hasLocale=false', info.hasLocale === false)
}

// 5) 主包 + deep import 一起
{
  const src = `import Element from 'element-ui';
import { addResizeListener } from 'element-ui/src/utils/resize-event';`
  const ctx = makeCtx(src)
  const info = collectElementUIImports(ctx as any)
  const out = generate(ctx.file.scriptAst)
  assertTrue('B7-5: 主包改 element-plus', out.includes('"element-plus"') || out.includes("'element-plus'"))
  assertTrue('B7-5: deep 改 element-plus/lib/utils/resize-event', out.includes('"element-plus/lib/utils/resize-event"') || out.includes("'element-plus/lib/utils/resize-event'"))
  assertTrue('B7-5: hasDeepImport=true', info.hasDeepImport === true)
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
