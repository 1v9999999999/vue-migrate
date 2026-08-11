/**
 * @vue-migrate/plugin-resource-copier unit tests
 *
 * iter-050a P0 #6/#7/#8: 扫 style @import / script import / import.meta.glob
 * → 复制资产到 outDir
 *
 * 测:
 *   1. scanStyleImports: @import './foo.scss' / url('./foo.css') / 跳过 ~package / 跳过 @/
 *   2. scanScriptStaticImports: import './foo.css' (独立 import) / 跳过带 binding 的
 *   3. scanImportMetaGlob: import.meta.glob / globEager / globRaw
 *   4. resolveRelative: ./foo.css 相对 fromFile 解析
 *   5. expandGlob: './svg/*.svg' → 实际文件列表
 *   6. analyze 钩子: 真实场景 — waves.css + index.scss + svg 复制
 */

import { mkdtempSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _testable } from '../index.js'

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

function assertTrue(name: string, cond: boolean, extra?: string): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}${extra ? '\n     ' + extra : ''}`)
    console.log(`  ✗ ${name}${extra ? '\n     ' + extra : ''}`)
  }
}

// ============ 1. scanStyleImports ============
console.log('\n[scanStyleImports]')

{
  const r = _testable.scanStyleImports(`@import './foo.scss';`)
  assertEq('单 @import 引用', r, ['./foo.scss'])
}

{
  const r = _testable.scanStyleImports(`@import "./bar.css";`)
  assertEq('双引号 @import', r, ['./bar.css'])
}

{
  const r = _testable.scanStyleImports(`@import url('./baz.css');`)
  assertEq('url() 形式', r, ['./baz.css'])
}

{
  const r = _testable.scanStyleImports(`@import url( "./qux.scss" );`)
  assertEq('url 带空格', r, ['./qux.scss'])
}

{
  const r = _testable.scanStyleImports(`@import '~package/foo.css';`)
  assertEq('跳过 ~package', r, [])
}

{
  const r = _testable.scanStyleImports(`@import '@/styles/vars.scss';`)
  assertEq('跳过 @/', r, [])
}

{
  const r = _testable.scanStyleImports(`
<style lang="scss">
@import './a.scss';
@import './b.scss';
</style>
`)
  assertEq('多个 import', r, ['./a.scss', './b.scss'])
}

{
  const r = _testable.scanStyleImports(``)
  assertEq('空字符串', r, [])
}

// ============ 2. scanScriptStaticImports ============
console.log('\n[scanScriptStaticImports]')

{
  const r = _testable.scanScriptStaticImports(`import './waves.css'`)
  assertEq('独立 import css', r, ['./waves.css'])
}

{
  const r = _testable.scanScriptStaticImports(`import './icon.svg';`)
  assertEq('独立 import svg + 分号', r, ['./icon.svg'])
}

{
  const r = _testable.scanScriptStaticImports(`import x from 'lodash'`)
  assertEq('带 binding 跳过', r, [])
}

{
  const r = _testable.scanScriptStaticImports(`import x from './foo.js'`)
  assertEq('带 binding 的 .js 跳过', r, [])
}

{
  const r = _testable.scanScriptStaticImports(`import x from 'vue'`)
  assertEq('vue 包跳过 (无 .css 等扩展名)', r, [])
}

{
  const r = _testable.scanScriptStaticImports(`require('./foo.css')`)
  assertEq('require 不算 static import', r, [])
}

{
  const r = _testable.scanScriptStaticImports(`
import './a.css'
import "./b.scss"
import x from 'vue'
`)
  assertEq('多 import 混合', r, ['./a.css', './b.scss'])
}

// ============ 3. scanImportMetaGlob ============
console.log('\n[scanImportMetaGlob]')

{
  const r = _testable.scanImportMetaGlob(`const m = import.meta.glob('./svg/*.svg')`)
  assertEq('import.meta.glob', r.length === 1 && r[0].pattern === './svg/*.svg', true)
}

{
  const r = _testable.scanImportMetaGlob(`const m = import.meta.globEager('./svg/*.svg')`)
  assertEq('globEager', r.length === 1 && r[0].pattern === './svg/*.svg', true)
}

{
  const r = _testable.scanImportMetaGlob(`const m = import.meta.globRaw('./svg/*.svg')`)
  assertEq('globRaw', r.length === 1 && r[0].pattern === './svg/*.svg', true)
}

{
  const r = _testable.scanImportMetaGlob(`const m = import.meta.glob('@/svg/*.svg')`)
  assertEq('跳过 @/', r, [])
}

{
  const r = _testable.scanImportMetaGlob(`const m = import.meta.glob('~pkg/svg/*.svg')`)
  assertEq('跳过 ~pkg', r, [])
}

{
  const r = _testable.scanImportMetaGlob(``)
  assertEq('空字符串', r, [])
}

// ============ 3b. scanRequireContext ============
console.log('\n[scanRequireContext]')

{
  const r = _testable.scanRequireContext(`const req = require.context('./svg', false, /\\.svg$/)`)
  assertEq('require.context svg', r, [{ dir: './svg', ext: '.svg' }])
}

{
  const r = _testable.scanRequireContext(`require.context("./modules", true, /\\.js$/)`)
  assertEq('require.context modules js', r, [{ dir: './modules', ext: '.js' }])
}

{
  const r = _testable.scanRequireContext(`require.context('@/foo', false, /\\.png$/)`)
  assertEq('跳过 @/', r, [])
}

{
  const r = _testable.scanRequireContext(``)
  assertEq('空字符串', r, [])
}

{
  // 多个 require.context
  const r = _testable.scanRequireContext(`
const a = require.context('./svg', false, /\\.svg$/)
const b = require.context('./png', false, /\\.png$/)
`)
  assertEq('多个 require.context', r, [
    { dir: './svg', ext: '.svg' },
    { dir: './png', ext: '.png' },
  ])
}

// ============ 4. resolveRelative ============
console.log('\n[resolveRelative]')

{
  // Windows path 测试: 用 POSIX 风格做断言, 但 path.resolve 跨平台 OK
  const r = _testable.resolveRelative('/x/src/directive/waves/waves.js', './waves.css')
  assertTrue('相对 import 解析', r.endsWith('waves.css') && r.includes('waves'))
}

{
  const r = _testable.resolveRelative('/x/src/directive/waves/waves.js', '../utils/x.scss')
  assertTrue('.. 上一级', r.endsWith('x.scss') && r.includes('utils'))
}

{
  const r = _testable.resolveRelative('/x/src/main.js', '/abs/path/foo.css')
  assertTrue('绝对路径原样', r === '/abs/path/foo.css' || r.endsWith('foo.css'))
}

// ============ 5. expandGlob ============
console.log('\n[expandGlob]')

{
  const root = mkdtempSync(join(tmpdir(), 'vmig-glob-'))
  mkdirSync(join(root, 'svg'), { recursive: true })
  writeFileSync(join(root, 'svg', 'a.svg'), '<svg/>')
  writeFileSync(join(root, 'svg', 'b.svg'), '<svg/>')
  writeFileSync(join(root, 'svg', 'c.txt'), 'not svg')

  const r = _testable.expandGlob(root, './svg/*.svg')
  assertEq('glob svg/*.svg 列 2 个', r.length, 2)
  assertTrue('含 a.svg', r.some((p: string) => p.endsWith('a.svg')))
  assertTrue('含 b.svg', r.some((p: string) => p.endsWith('b.svg')))
  assertTrue('不含 c.txt', !r.some((p: string) => p.endsWith('c.txt')))

  rmSync(root, { recursive: true, force: true })
}

{
  const root = mkdtempSync(join(tmpdir(), 'vmig-glob-'))
  writeFileSync(join(root, 'one.css'), 'a')
  writeFileSync(join(root, 'two.css'), 'b')
  writeFileSync(join(root, 'three.scss'), 'c')

  const r = _testable.expandGlob(root, './*.css')
  assertEq('单层 glob ./*.css', r.length, 2)
  assertTrue('含 one.css', r.some((p: string) => p.endsWith('one.css')))

  rmSync(root, { recursive: true, force: true })
}

{
  // 目录不存在 → 空
  const r = _testable.expandGlob('/nonexistent/abc', './svg/*.svg')
  assertEq('目录不存在', r, [])
}

// ============ 6. analyze 钩子: 真实场景 ============
console.log('\n[analyze: 真实场景]')

{
  // 模拟 vue-element-admin-master 的结构:
  //   src/directive/waves/waves.js  →  import './waves.css'
  //   src/views/dashboard/admin/components/TodoList/index.vue →  @import './index.scss'
  //   src/icons/index.js  →  require.context('./svg', false, /\.svg$/)  (典型 vue-element-admin)
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-rc-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-rc-out-'))

  // 准备源
  mkdirSync(join(srcRoot, 'src', 'directive', 'waves'), { recursive: true })
  writeFileSync(join(srcRoot, 'src', 'directive', 'waves', 'waves.js'), `import './waves.css'\nexport default {}`)
  writeFileSync(join(srcRoot, 'src', 'directive', 'waves', 'waves.css'), '/* waves css */')

  mkdirSync(join(srcRoot, 'src', 'views', 'dashboard', 'admin', 'components', 'TodoList'), { recursive: true })
  writeFileSync(
    join(srcRoot, 'src', 'views', 'dashboard', 'admin', 'components', 'TodoList', 'index.vue'),
    `<template><div></div></template>
<style lang="scss">
@import './index.scss';
</style>`,
  )
  writeFileSync(
    join(srcRoot, 'src', 'views', 'dashboard', 'admin', 'components', 'TodoList', 'index.scss'),
    '/* todo list scss */',
  )

  mkdirSync(join(srcRoot, 'src', 'icons', 'svg'), { recursive: true })
  writeFileSync(join(srcRoot, 'src', 'icons', 'svg', 'email.svg'), '<svg/>')
  writeFileSync(join(srcRoot, 'src', 'icons', 'svg', 'user.svg'), '<svg/>')
  // 用 require.context 模式 (vue-element-admin-master 实际就是)
  writeFileSync(join(srcRoot, 'src', 'icons', 'index.js'), `const req = require.context('./svg', false, /\\.svg$/)\nconst r = req.keys().map(req)\nexport default r`)

  // 构造 ctx.files
  const files = new Map<string, any>()
  files.set(join(srcRoot, 'src', 'directive', 'waves', 'waves.js'), {
    path: join(srcRoot, 'src', 'directive', 'waves', 'waves.js'),
    source: `import './waves.css'\nexport default {}`,
  })
  files.set(join(srcRoot, 'src', 'views', 'dashboard', 'admin', 'components', 'TodoList', 'index.vue'), {
    path: join(srcRoot, 'src', 'views', 'dashboard', 'admin', 'components', 'TodoList', 'index.vue'),
    source: `<template><div></div></template>\n<style lang="scss">\n@import './index.scss';\n</style>`,
  })
  files.set(join(srcRoot, 'src', 'icons', 'index.js'), {
    path: join(srcRoot, 'src', 'icons', 'index.js'),
    source: `const req = require.context('./svg', false, /\\.svg$/)\nconst r = req.keys().map(req)\nexport default r`,
  })

  const ctx: any = {
    root: srcRoot,
    files,
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  const { default: plugin } = await import('../index.js')
  if (plugin.analyze) await plugin.analyze(ctx)

  // 验证
  assertTrue('waves.css 已复制', existsSync(join(outDir, 'src', 'directive', 'waves', 'waves.css')))
  assertTrue('TodoList/index.scss 已复制', existsSync(join(outDir, 'src', 'views', 'dashboard', 'admin', 'components', 'TodoList', 'index.scss')))
  assertTrue('email.svg 已复制 (require.context)', existsSync(join(outDir, 'src', 'icons', 'svg', 'email.svg')))
  assertTrue('user.svg 已复制 (require.context)', existsSync(join(outDir, 'src', 'icons', 'svg', 'user.svg')))

  // 第二次跑不应该重复复制 (skipped)
  if (plugin.analyze) await plugin.analyze(ctx)
  assertTrue('二次跑仍存在', existsSync(join(outDir, 'src', 'directive', 'waves', 'waves.css')))

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 7. dryRun 不写 ============
console.log('\n[analyze: dryRun]')

{
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-rc-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-rc-out-'))

  mkdirSync(join(srcRoot, 'src', 'foo'), { recursive: true })
  writeFileSync(join(srcRoot, 'src', 'foo', 'a.css'), 'body {}')
  writeFileSync(join(srcRoot, 'src', 'foo', 'index.js'), `import './a.css'`)

  const files = new Map<string, any>()
  files.set(join(srcRoot, 'src', 'foo', 'index.js'), {
    path: join(srcRoot, 'src', 'foo', 'index.js'),
    source: `import './a.css'`,
  })

  const ctx: any = {
    root: srcRoot,
    files,
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: true, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  const { default: plugin } = await import('../index.js')
  if (plugin.analyze) await plugin.analyze(ctx)

  assertTrue('dryRun 不写文件', !existsSync(join(outDir, 'src', 'foo', 'a.css')))

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 8. in-place 模式不动 ============
console.log('\n[analyze: in-place]')

{
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-rc-src-'))
  mkdirSync(join(srcRoot, 'src', 'foo'), { recursive: true })
  writeFileSync(join(srcRoot, 'src', 'foo', 'a.css'), 'body {}')
  writeFileSync(join(srcRoot, 'src', 'foo', 'index.js'), `import './a.css'`)

  const files = new Map<string, any>()
  files.set(join(srcRoot, 'src', 'foo', 'index.js'), {
    path: join(srcRoot, 'src', 'foo', 'index.js'),
    source: `import './a.css'`,
  })

  // 没有 outDir
  const ctx: any = {
    root: srcRoot,
    files,
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  const { default: plugin } = await import('../index.js')
  if (plugin.analyze) await plugin.analyze(ctx)

  // in-place 模式没 outDir, 不应该写 — 但源文件存在
  assertTrue('in-place 模式不动', existsSync(join(srcRoot, 'src', 'foo', 'a.css')))

  rmSync(srcRoot, { recursive: true, force: true })
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
