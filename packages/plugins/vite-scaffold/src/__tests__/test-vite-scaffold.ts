/**
 * @vue-migrate/plugin-vite-scaffold unit tests
 *
 * iter-049a P0 #1/#2/#3: Vite scaffold (vite.config.js, index.html, public/)
 * + P0 #5: 删 vue.config.js / babel.config.js
 *
 * 测:
 *   1. packageUsesVite / packageHasViteDeps / isViteProject 判定
 *   2. buildViteConfigTemplate / buildIndexHtmlTemplate 模板生成
 *   3. inferMainEntry 主入口推断
 *   4. 真实 analyze 钩子: 模拟 outDir, 验证文件被生成 / 删除
 */

import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
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

function assertContains(name: string, haystack: string, needle: string): void {
  if (haystack.includes(needle)) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     needle: ${JSON.stringify(needle)}\n     haystack (first 200): ${haystack.slice(0, 200)}`)
    console.log(`  ✗ ${name}`)
  }
}

// ============ 1. packageUsesVite ============
console.log('\n[packageUsesVite]')

assertTrue('scripts.vite 触发', _testable.packageUsesVite({ scripts: { dev: 'vite' } }))
assertTrue('scripts.build:vite build 触发', _testable.packageUsesVite({ scripts: { 'build:prod': 'vite build' } }))
assertTrue('scripts 含 vite preview 触发', _testable.packageUsesVite({ scripts: { preview: 'vite preview' } }))
assertTrue('vitest 不误触发', !_testable.packageUsesVite({ scripts: { test: 'vitest run' } }))
assertTrue('vite config 命令触发', _testable.packageUsesVite({ scripts: { 'lint': 'eslint && vite inspect' } }))
assertTrue('空 scripts 不触发', !_testable.packageUsesVite({ scripts: {} }))
assertTrue('空 package 不触发', !_testable.packageUsesVite({}))

// ============ 2. packageHasViteDeps ============
console.log('\n[packageHasViteDeps]')

assertTrue('devDeps.vite 触发', _testable.packageHasViteDeps({ devDependencies: { vite: '^5.0.0' } }))
assertTrue('devDeps.@vitejs/plugin-vue 触发', _testable.packageHasViteDeps({ devDependencies: { '@vitejs/plugin-vue': '^5.0.0' } }))
assertTrue('无 vite 不触发', !_testable.packageHasViteDeps({ devDependencies: { webpack: '^5.0.0' } }))

// ============ 3. isViteProject ============
console.log('\n[isViteProject]')

assertTrue('空 project = false', !_testable.isViteProject(null))
assertTrue('空 object = false', !_testable.isViteProject({}))
assertTrue('scripts 用 vite', _testable.isViteProject({ scripts: { dev: 'vite' } }))
assertTrue('devDeps 用 vite', _testable.isViteProject({ devDependencies: { vite: '^5.0.0' } }))
assertTrue('vue 2 项目 = false', !_testable.isViteProject({
  scripts: { dev: 'vue-cli-service serve' },
  devDependencies: { '@vue/cli-service': '4.4.4' },
}))

// ============ 4. buildViteConfigTemplate ============
console.log('\n[buildViteConfigTemplate]')

{
  const tpl = _testable.buildViteConfigTemplate()
  assertContains('含 defineConfig', tpl, "defineConfig")
  assertContains('含 @vitejs/plugin-vue', tpl, "@vitejs/plugin-vue")
  assertContains('含 alias @ → src', tpl, "'@': path.resolve(__dirname, 'src')")
  assertContains('含 base: /', tpl, "base: '/'")
  assertContains('含 server.port', tpl, "port: 9527")
  assertContains('含 build.outDir', tpl, "outDir: 'dist'")
  assertTrue('实际不含 webpack 引用', !tpl.includes('webpack'))
  assertTrue('含 export default', tpl.includes('export default defineConfig'))
}

// ============ 5. buildIndexHtmlTemplate ============
console.log('\n[buildIndexHtmlTemplate]')

{
  const tpl = _testable.buildIndexHtmlTemplate('/src/main.js', 'My Admin')
  assertContains('含 <div id="app">', tpl, '<div id="app"></div>')
  assertContains('含 main.js 入口', tpl, '/src/main.js')
  assertContains('含 title', tpl, '<title>My Admin</title>')
  assertContains('含 favicon', tpl, 'rel="icon"')
  assertContains('含 <!DOCTYPE html>', tpl, '<!DOCTYPE html>')
  assertContains('含 noscript', tpl, '<noscript>')
  assertContains('含 type="module"', tpl, 'type="module"')
}

{
  const tpl = _testable.buildIndexHtmlTemplate('/src/main.ts', 'TS App')
  assertContains('main.ts 入口', tpl, '/src/main.ts')
  assertContains('TS App title', tpl, 'TS App')
}

// ============ 6. inferMainEntry ============
console.log('\n[inferMainEntry]')

// 1) src/main.js 存在 → 优先
{
  const root = mkdtempSync(join(tmpdir(), 'vmig-vite-entry-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'main.js'), 'console.log(1)')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'X' }))
  const r = await _testable.inferMainEntry(root)
  assertEq('main.js 推断', r.entry, '/src/main.js')
  assertEq('name=title', r.title, 'X')
  rmSync(root, { recursive: true, force: true })
}

// 2) 只有 main.ts → 走 ts
{
  const root = mkdtempSync(join(tmpdir(), 'vmig-vite-entry-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'main.ts'), 'console.log(1)')
  const r = await _testable.inferMainEntry(root)
  assertEq('main.ts 推断', r.entry, '/src/main.ts')
  rmSync(root, { recursive: true, force: true })
}

// 3) 啥都没有 → fallback /src/main.js
{
  const root = mkdtempSync(join(tmpdir(), 'vmig-vite-entry-'))
  const r = await _testable.inferMainEntry(root)
  assertEq('fallback main.js', r.entry, '/src/main.js')
  assertEq('fallback title', r.title, 'Vue 3 App')
  rmSync(root, { recursive: true, force: true })
}

// 4) 用 description 做 title
{
  const root = mkdtempSync(join(tmpdir(), 'vmig-vite-entry-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  writeFileSync(join(root, 'src', 'main.js'), '')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ description: 'My desc' }))
  const r = await _testable.inferMainEntry(root)
  assertEq('description=title', r.title, 'My desc')
  rmSync(root, { recursive: true, force: true })
}

// ============ 7. analyze 钩子: 写 vite.config.js + index.html + public/ + 拷 favicon ============
console.log('\n[analyze: scaffold]')

{
  // 模拟源项目: 有 package.json (vite), 有 public/ + favicon.ico
  // 输出目录: 空目录
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-vite-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-vite-out-'))

  // 源 package.json (vite)
  writeFileSync(join(srcRoot, 'package.json'), JSON.stringify({
    name: 'vue-element-admin',
    scripts: { dev: 'vite', build: 'vite build' },
    devDependencies: { vite: '^5.0.0', '@vitejs/plugin-vue': '^5.0.0' },
  }))
  // 源 public/ + favicon
  mkdirSync(join(srcRoot, 'public'))
  writeFileSync(join(srcRoot, 'public', 'favicon.ico'), 'fake-ico-content')
  writeFileSync(join(srcRoot, 'public', 'index.html'), '<html><!-- source public html --></html>')
  // 源 src/main.js
  mkdirSync(join(srcRoot, 'src'))
  writeFileSync(join(srcRoot, 'src', 'main.js'), 'console.log(1)')

  // 模拟 outDir 已有 src/main.js (转换过) + 已有 vue.config.js
  mkdirSync(join(outDir, 'src'))
  writeFileSync(join(outDir, 'src', 'main.js'), '// converted')
  writeFileSync(join(outDir, 'vue.config.js'), "// vue cli config")
  writeFileSync(join(outDir, 'babel.config.js'), "module.exports = { presets: ['@vue/cli-plugin-babel/preset'] }")

  // 调用 analyze 钩子
  // @ts-ignore - 直接调钩子, 不走完整 pipeline
  const { default: plugin } = await import('../index.js')
  const ctx = {
    root: srcRoot,
    files: new Map(),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  if (plugin.analyze) {
    await plugin.analyze(ctx as any)
  }

  assertTrue('vite.config.js 已写', existsSync(join(outDir, 'vite.config.js')))
  assertTrue('index.html 已写', existsSync(join(outDir, 'index.html')))
  assertTrue('public/ 已建', existsSync(join(outDir, 'public')))
  assertTrue('public/favicon.ico 已拷', existsSync(join(outDir, 'public', 'favicon.ico')))
  assertTrue('vue.config.js 已删', !existsSync(join(outDir, 'vue.config.js')))
  assertTrue('babel.config.js 已删', !existsSync(join(outDir, 'babel.config.js')))

  // 内容校验
  const viteCfg = readFileSync(join(outDir, 'vite.config.js'), 'utf-8')
  assertContains('vite.config.js 含 alias', viteCfg, "'@'")
  const indexHtml = readFileSync(join(outDir, 'index.html'), 'utf-8')
  assertContains('index.html 含 /src/main.js', indexHtml, '/src/main.js')
  assertContains('index.html 含 <div id="app">', indexHtml, '<div id="app"></div>')

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 8. analyze 钩子: 已有 vite.config.js 时不覆盖 ============
console.log('\n[analyze: 不覆盖已有]')

{
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-vite-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-vite-out-'))

  writeFileSync(join(srcRoot, 'package.json'), JSON.stringify({
    scripts: { dev: 'vite' },
    devDependencies: { vite: '^5.0.0' },
  }))
  mkdirSync(join(srcRoot, 'src'))
  writeFileSync(join(srcRoot, 'src', 'main.js'), '')

  // outDir 已有 vite.config.js (用户手写)
  writeFileSync(join(outDir, 'vite.config.js'), '// my custom config')

  const { default: plugin } = await import('../index.js')
  const ctx = {
    root: srcRoot,
    files: new Map(),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  if (plugin.analyze) await plugin.analyze(ctx as any)

  const cfg = readFileSync(join(outDir, 'vite.config.js'), 'utf-8')
  assertEq('不覆盖已有 vite.config.js', cfg, '// my custom config')

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 9. analyze 钩子: 不是 vite 项目不做事 ============
console.log('\n[analyze: 非 vite 不动]')

{
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-vite-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-vite-out-'))

  writeFileSync(join(srcRoot, 'package.json'), JSON.stringify({
    scripts: { dev: 'webpack serve' },
    devDependencies: { webpack: '^5.0.0' },
  }))

  const { default: plugin } = await import('../index.js')
  const ctx = {
    root: srcRoot,
    files: new Map(),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  if (plugin.analyze) await plugin.analyze(ctx as any)

  assertTrue('webpack 项目不写 vite.config.js', !existsSync(join(outDir, 'vite.config.js')))
  assertTrue('webpack 项目不写 index.html', !existsSync(join(outDir, 'index.html')))
  assertTrue('webpack 项目不建 public/', !existsSync(join(outDir, 'public')))

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 10. analyze 钩子: dryRun 只打印不写 ============
console.log('\n[analyze: dryRun]')

{
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-vite-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-vite-out-'))

  writeFileSync(join(srcRoot, 'package.json'), JSON.stringify({
    scripts: { dev: 'vite' },
    devDependencies: { vite: '^5.0.0' },
  }))

  const { default: plugin } = await import('../index.js')
  const ctx = {
    root: srcRoot,
    files: new Map(),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: true, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  if (plugin.analyze) await plugin.analyze(ctx as any)

  assertTrue('dryRun 不实际写 vite.config.js', !existsSync(join(outDir, 'vite.config.js')))

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 11. analyze 钩子: 原项目也没 public/ 时建空目录 ============
console.log('\n[analyze: 空 public]')

{
  const srcRoot = mkdtempSync(join(tmpdir(), 'vmig-vite-src-'))
  const outDir = mkdtempSync(join(tmpdir(), 'vmig-vite-out-'))

  writeFileSync(join(srcRoot, 'package.json'), JSON.stringify({
    scripts: { dev: 'vite' },
  }))

  const { default: plugin } = await import('../index.js')
  const ctx = {
    root: srcRoot,
    files: new Map(),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  if (plugin.analyze) await plugin.analyze(ctx as any)

  assertTrue('建了 public/', existsSync(join(outDir, 'public')))
  assertTrue('public/.gitkeep', existsSync(join(outDir, 'public', '.gitkeep')))

  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
