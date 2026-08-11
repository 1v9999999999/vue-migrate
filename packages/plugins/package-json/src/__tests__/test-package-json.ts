/**
 * @vue-migrate/plugin-package-json unit tests
 *
 * 不需要起 plugin 钩子（analyze 阶段写盘副作用较大），
 * 直接 import 纯函数测：
 *   - applyDepMap / applyDevDepMap / applyScriptMap
 *   - isVue2Project (通过 transformPackageJson 间接覆盖)
 */

import {
  applyDepMap,
  isVueCliPlugin,
  DEP_MAP,
} from '../rules/dependencies.js'
import { applyDevDepMap } from '../rules/devDependencies.js'
import { applyScriptMap } from '../rules/scripts.js'

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

// ============ isVueCliPlugin ============
console.log('\n[isVueCliPlugin]')
assertTrue('@vue/cli-plugin-babel 是 cli plugin', isVueCliPlugin('@vue/cli-plugin-babel'))
assertTrue('vue 不是 cli plugin', !isVueCliPlugin('vue'))
assertTrue('@vue/compiler-sfc 不是 cli plugin', !isVueCliPlugin('@vue/compiler-sfc'))

// ============ DEP_MAP ============
console.log('\n[DEP_MAP 表]')
assertTrue('vue 映射到 ^3.4.0', DEP_MAP['vue']?.version === '^3.4.0')
assertTrue('vuex 映射到 pinia', DEP_MAP['vuex']?.name === 'pinia')
assertTrue('element-ui 映射到 element-plus', DEP_MAP['element-ui']?.name === 'element-plus')
assertTrue('vue-template-compiler 标记 remove', DEP_MAP['vue-template-compiler']?.remove === true)

// ============ applyDepMap ============
console.log('\n[applyDepMap]')

// 1) 简单重命名 vue ^2.6 → vue ^3.4
{
  const r = applyDepMap({ 'vue': '^2.6.11' })
  assertEq('vue ^2.6 → ^3.4', r.deps, { 'vue': '^3.4.0' })
  assertTrue('记录 1 项改动', r.changes.length === 1)
}

// 2) vuex 替换为 pinia
{
  const r = applyDepMap({ 'vuex': '^3.6.0' })
  assertEq('vuex → pinia ^2.1', r.deps, { 'pinia': '^2.1.0' })
  assertTrue('记录替换', r.changes.some((c) => c.includes('vuex') && c.includes('pinia')))
}

// 3) element-ui → element-plus
{
  const r = applyDepMap({ 'element-ui': '^2.15.0' })
  assertEq('element-ui → element-plus', r.deps, { 'element-plus': '^2.4.0' })
}

// 4) vue-template-compiler 删除
{
  const r = applyDepMap({ 'vue-template-compiler': '^2.6.11' })
  assertEq('vue-template-compiler 删除', r.deps, {})
  assertTrue('记录删除', r.changes.some((c) => c.includes('移除') && c.includes('vue-template-compiler')))
}

// 5) 未知依赖原样保留
{
  const r = applyDepMap({ 'lodash': '^4.17.0', 'axios': '^1.6.0' })
  assertEq('未知依赖保留', r.deps, { 'lodash': '^4.17.0', 'axios': '^1.6.0' })
  assertTrue('无变化', r.changes.length === 0)
}

// 6) @vue/cli-plugin-* 通配删除
{
  const r = applyDepMap({
    '@vue/cli-plugin-babel': '~5.0.0',
    '@vue/cli-plugin-typescript': '~5.0.0',
    'vue': '^2.6.11',
  })
  assertEq('@vue/cli-plugin-* 都被删', r.deps, { 'vue': '^3.4.0' })
  assertTrue('记录 2 次删除', r.changes.filter((c) => c.includes('移除') && c.includes('@vue/cli-plugin')).length === 2)
}

// 7) undefined 安全
{
  const r = applyDepMap(undefined)
  assertEq('undefined 输入安全', r.deps, {})
  assertEq('无改动', r.changes, [])
}

// 8) 混合场景
{
  const r = applyDepMap({
    'vue': '^2.6.11',
    'vuex': '^3.6.0',
    'vue-router': '^3.5.0',
    'element-ui': '^2.15.0',
    'axios': '^1.6.0',
    'vue-template-compiler': '^2.6.11',
    '@vue/cli-service': '~5.0.0',
  })
  assertEq('混合场景', r.deps, {
    'vue': '^3.4.0',
    'pinia': '^2.1.0',
    'vue-router': '^4.2.0',
    'element-plus': '^2.4.0',
    'axios': '^1.6.0',
  })
  assertTrue('@vue/cli-service 被删', r.changes.some((c) => c.includes('@vue/cli-service')))
}

// ============ iter-045b: 3rd-party 库升级 + manualReview ============
console.log('\n[iter-045b 3rd-party 升级]')

// 9) vuedraggable 2.20.0 → 4.1.0
{
  const r = applyDepMap({ 'vuedraggable': '2.20.0' })
  assertEq('vuedraggable 2.20 → ^4.1', r.deps, { 'vuedraggable': '^4.1.0' })
  assertTrue('vuedraggable 记录升版本', r.changes.some((c) => c.includes('升 vuedraggable') && c.includes('2.20.0') && c.includes('4.1.0')))
  assertTrue('vuedraggable 附 manualReview 提示', r.changes.some((c) => c.includes('⚠') && c.includes('vuedraggable') && c.includes('review')))
}

// 10) vue-count-to 1.0.13 → 2.x
{
  const r = applyDepMap({ 'vue-count-to': '1.0.13' })
  assertEq('vue-count-to 1.0.13 → ^2.0', r.deps, { 'vue-count-to': '^2.0.0' })
  assertTrue('vue-count-to 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('vue-count-to')))
}

// 11) echarts 4.2.1 → 5.x
{
  const r = applyDepMap({ 'echarts': '4.2.1' })
  assertEq('echarts 4.2.1 → ^5.5', r.deps, { 'echarts': '^5.5.0' })
  assertTrue('echarts 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('echarts') && c.includes('ESM')))
}

// 12) screenfull 4.2.0 → 6.x
{
  const r = applyDepMap({ 'screenfull': '4.2.0' })
  assertEq('screenfull 4.2 → ^6', r.deps, { 'screenfull': '^6.0.0' })
  assertTrue('screenfull 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('screenfull')))
}

// 13) tui-editor 1.3.3 → @toast-ui/editor 3.x (改名)
{
  const r = applyDepMap({ 'tui-editor': '1.3.3' })
  assertEq('tui-editor → @toast-ui/editor ^3.2', r.deps, { '@toast-ui/editor': '^3.2.0' })
  assertTrue('tui-editor 记录改名 + 升版本', r.changes.some((c) => c.includes('tui-editor') && c.includes('@toast-ui/editor')))
  assertTrue('tui-editor 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('tui-editor')))
}

// 14) vue-splitpane 1.0.4 → 1.0.6 (社区 Vue3 fork)
{
  const r = applyDepMap({ 'vue-splitpane': '1.0.4' })
  assertEq('vue-splitpane 1.0.4 → ^1.0.6', r.deps, { 'vue-splitpane': '^1.0.6' })
  assertTrue('vue-splitpane 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('vue-splitpane')))
}

// 15) driver.js 0.9.5 → 1.3.0
{
  const r = applyDepMap({ 'driver.js': '0.9.5' })
  assertEq('driver.js 0.9.5 → ^1.3', r.deps, { 'driver.js': '^1.3.0' })
  assertTrue('driver.js 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('driver.js')))
}

// 16) @vue/test-utils 1.x → 2.x (devDeps 复用 DEP_MAP)
{
  const r = applyDevDepMap({ '@vue/test-utils': '1.0.0-beta.29', 'autoprefixer': '9.5.1' }, false)
  assertEq('@vue/test-utils 1.x → ^2.4', r.deps, {
    '@vue/test-utils': '^2.4.0',
    'autoprefixer': '9.5.1',
  })
  assertTrue('@vue/test-utils 附 manualReview', r.changes.some((c) => c.includes('⚠') && c.includes('@vue/test-utils')))
}

// 17) path → path-browserify (Vite 浏览器需要 polyfill)
{
  const r = applyDepMap({ 'path': '0.12.7' })
  assertEq('path → path-browserify', r.deps, { 'path-browserify': '^1.0.1' })
  assertTrue('path 记录改包名', r.changes.some((c) => c.includes('path') && c.includes('path-browserify')))
}

// 18) jest / babel-jest → vitest
{
  const r = applyDepMap({ 'jest': '26.5.3', 'babel-jest': '26.5.3' })
  assertEq('jest → vitest ^1.0', r.deps, { 'vitest': '^1.0.0' })
}

// 19) vue-jest → @vue/vue3-jest
{
  const r = applyDepMap({ 'vue-jest': '4.0.0' })
  assertEq('vue-jest → @vue/vue3-jest', r.deps, { '@vue/vue3-jest': '^29.0.0' })
}

// 20) webpack 专属 devDeps 删除
{
  const r = applyDepMap({
    'html-webpack-plugin': '4.5.0',
    'script-ext-html-webpack-plugin': '2.1.3',
    'svg-sprite-loader': '4.1.3',
    'script-loader': '0.7.2',
    'babel-plugin-dynamic-import-node': '2.3.3',
  })
  assertEq('webpack-only 全部删除', r.deps, {})
  assertTrue('记录 5 个删除', r.changes.filter((c) => c.includes('移除')).length === 5)
}

// 21) babel-eslint → @babel/eslint-parser
{
  const r = applyDepMap({ 'babel-eslint': '10.1.0' })
  assertEq('babel-eslint → @babel/eslint-parser', r.deps, { '@babel/eslint-parser': '^7.23.0' })
}

// 22) manualReview 提示: 多个 break 一次性输出多个 ⚠
{
  const r = applyDepMap({
    'echarts': '4.2.1',
    'vue-count-to': '1.0.13',
    'vuedraggable': '2.20.0',
  })
  const reviewCount = r.changes.filter((c) => c.startsWith('⚠')).length
  assertTrue('3 个 review 提示', reviewCount === 3)
}

// 23) 完整 vue-element-admin 风格混合场景
{
  const r = applyDepMap({
    'vue': '2.6.10',
    'vue-router': '3.0.2',
    'vuex': '3.1.0',
    'element-ui': '2.13.2',
    'axios': '0.18.1',
    'clipboard': '2.0.4',
    'echarts': '4.2.1',
    'vue-count-to': '1.0.13',
    'vuedraggable': '2.20.0',
    'screenfull': '4.2.0',
    'tui-editor': '1.3.3',
    'vue-splitpane': '1.0.4',
    'driver.js': '0.9.5',
    'sortablejs': '1.8.4',
    'xlsx': '0.14.1',
    'jszip': '3.2.1',
  })
  assertTrue('echarts 升 5.x', r.deps['echarts'] === '^5.5.0')
  assertTrue('vue-count-to 升 2.x', r.deps['vue-count-to'] === '^2.0.0')
  assertTrue('vuedraggable 升 4.x', r.deps['vuedraggable'] === '^4.1.0')
  assertTrue('screenfull 升 6.x', r.deps['screenfull'] === '^6.0.0')
  assertTrue('tui-editor 改名 @toast-ui/editor', r.deps['tui-editor'] === undefined && r.deps['@toast-ui/editor'] === '^3.2.0')
  assertTrue('vue-splitpane 升 1.0.6', r.deps['vue-splitpane'] === '^1.0.6')
  assertTrue('driver.js 升 1.3', r.deps['driver.js'] === '^1.3.0')
  assertTrue('axios 0.18.1 保留', r.deps['axios'] === '0.18.1')
  assertTrue('clipboard 2.0.4 保留', r.deps['clipboard'] === '2.0.4')
  assertTrue('sortablejs 1.8.4 保留', r.deps['sortablejs'] === '1.8.4')
  assertTrue('xlsx 0.14.1 保留', r.deps['xlsx'] === '0.14.1')
  // 至少 7 个 manualReview 提示
  const reviewCount = r.changes.filter((c) => c.startsWith('⚠')).length
  assertTrue('完整场景 7+ 个 review 提示', reviewCount >= 7)
}

// ============ applyDevDepMap ============
console.log('\n[applyDevDepMap]')

// 1) 注入 vite + @vitejs/plugin-vue
{
  const r = applyDevDepMap({}, true)
  assertEq('空对象 + 注入 vite', r.deps, { 'vite': '^5.0.0', '@vitejs/plugin-vue': '^5.0.0' })
  assertTrue('记录 2 项注入', r.changes.filter((c) => c.includes('注入')).length === 2)
}

// 2) 已有 vite 不重复注入
{
  const r = applyDevDepMap({ 'vite': '^4.0.0' }, true)
  assertEq('已有 vite 保留原值', r.deps, { 'vite': '^4.0.0', '@vitejs/plugin-vue': '^5.0.0' })
  assertTrue('只注入 @vitejs/plugin-vue', r.changes.length === 1)
}

// 3) injectVite=false 不注入
{
  const r = applyDevDepMap({}, false)
  assertEq('不注入 vite', r.deps, {})
  assertEq('无改动', r.changes, [])
}

// 4) DEP_MAP 也作用于 devDep
{
  const r = applyDevDepMap({
    'vue-loader': '^15.9.0',
    '@vue/cli-plugin-eslint': '~5.0.0',
    'sass': '^1.69.0',
  }, false)
  assertEq('vue-loader ^15 → ^17, sass 保留', r.deps, {
    'vue-loader': '^17.4.0',
    'sass': '^1.69.0',
  })
  assertTrue('@vue/cli-plugin-eslint 被删', r.changes.some((c) => c.includes('@vue/cli-plugin-eslint')))
}

// ============ applyScriptMap ============
console.log('\n[applyScriptMap]')

// 1) serve → dev
{
  const r = applyScriptMap({ 'serve': 'vue-cli-service serve' })
  assertEq('serve → dev', r.scripts, { 'dev': 'vite' })
  assertTrue('记录 1 项重命名（重命名优先级高于改命令）', r.changes.length === 1)
  assertTrue('描述含 serve → dev', r.changes[0]?.includes('serve') && r.changes[0]?.includes('dev'))
}

// 2) build 改命令
{
  const r = applyScriptMap({ 'build': 'vue-cli-service build' })
  assertEq('build 改 vite build', r.scripts, { 'build': 'vite build' })
  assertTrue('记录 1 项改动', r.changes.length === 1)
}

// 3) lint 改命令
{
  const r = applyScriptMap({ 'lint': 'vue-cli-service lint' })
  assertEq('lint 改 eslint', r.scripts, { 'lint': 'eslint --ext .js,.vue,.ts src' })
}

// 4) test:unit
{
  const r = applyScriptMap({ 'test:unit': 'vue-cli-service test:unit' })
  assertEq('test:unit 改 vitest run', r.scripts, { 'test:unit': 'vitest run' })
}

// 5) 未知命令保留
{
  const r = applyScriptMap({
    'serve': 'vue-cli-service serve',
    'build': 'vue-cli-service build',
    'lint': 'vue-cli-service lint',
    'docs': 'vuepress dev docs',
    'deploy': 'gh-pages -d dist',
  })
  assertEq('混合 scripts', r.scripts, {
    'dev': 'vite',
    'build': 'vite build',
    'lint': 'eslint --ext .js,.vue,.ts src',
    'docs': 'vuepress dev docs',
    'deploy': 'gh-pages -d dist',
  })
}

// 6) undefined 安全
{
  const r = applyScriptMap(undefined)
  assertEq('undefined 输入安全', r.scripts, {})
  assertEq('无改动', r.changes, [])
}

// 7) 已是 vite 项目不动
{
  const r = applyScriptMap({ 'dev': 'vite', 'build': 'vite build' })
  assertEq('已经是 vite', r.scripts, { 'dev': 'vite', 'build': 'vite build' })
  assertEq('无改动', r.changes, [])
}

// 8) B1: build --mode staging 保留 args
{
  const r = applyScriptMap({ 'build:stage': 'vue-cli-service build --mode staging' })
  assertEq('build:stage 保留 --mode staging', r.scripts, { 'build:stage': 'vite build --mode staging' })
  assertTrue('记录 1 项改动', r.changes.length === 1)
  assertTrue('描述含 build --mode staging', r.changes[0]?.includes('build:stage'))
}

// 9) B1: 复合命令 jest --clearCache && vue-cli-service test:unit
{
  const r = applyScriptMap({ 'test:unit': 'jest --clearCache && vue-cli-service test:unit' })
  assertEq('test:unit 复合命令替换', r.scripts, { 'test:unit': 'jest --clearCache && vitest run' })
  assertTrue('记录 1 项改动', r.changes.length === 1)
}

// 10) B1: 三段命令
{
  const r = applyScriptMap({ 'test:ci': 'npm run lint && vue-cli-service test:unit && echo done' })
  assertEq('三段命令替换', r.scripts, { 'test:ci': 'npm run lint && vitest run && echo done' })
  assertTrue('记录 1 项改动', r.changes.length === 1)
}

// 11) B1: vue-cli-service serve 后面带 --port
{
  const r = applyScriptMap({ 'dev': 'vue-cli-service serve --port 8080' })
  assertEq('serve 保留 --port', r.scripts, { 'dev': 'vite --port 8080' })
}

// 12) B1: 长前缀 my-vue-cli-service 不误匹配
{
  const r = applyScriptMap({ 'custom': 'my-vue-cli-service serve' })
  assertEq('长前缀不误匹配', r.scripts, { 'custom': 'my-vue-cli-service serve' })
  assertEq('无改动', r.changes, [])
}

// 13) B1: 未知 subcmd 原样保留
{
  const r = applyScriptMap({ 'foo': 'vue-cli-service some-unknown-cmd --flag' })
  assertEq('未知 subcmd 保留', r.scripts, { 'foo': 'vue-cli-service some-unknown-cmd --flag' })
  assertEq('无改动', r.changes, [])
}

// ============ iter-048a F5: copyDir 单测 ============
console.log('\n[F5: copyDir]')

// 跑实际的 copyDir 行为
// 模拟场景:在临时目录创建 src/styles/ 几个文件,调用 copyDir,验证 dest 目录里有它们
{
  const { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join: pathJoin } = await import('node:path')
  const srcRoot = mkdtempSync(pathJoin(tmpdir(), 'vmig-f5-src-'))
  const destRoot = mkdtempSync(pathJoin(tmpdir(), 'vmig-f5-dest-'))

  // 准备 src/styles/...
  mkdirSync(pathJoin(srcRoot, 'src', 'styles'), { recursive: true })
  writeFileSync(pathJoin(srcRoot, 'src', 'styles', 'index.scss'), 'body { color: red; }')
  writeFileSync(pathJoin(srcRoot, 'src', 'styles', 'variables.scss'), '$c: red;')
  mkdirSync(pathJoin(srcRoot, 'src', 'styles', 'sub'), { recursive: true })
  writeFileSync(pathJoin(srcRoot, 'src', 'styles', 'sub', 'deep.scss'), '/* deep */')
  // 跳过目录
  mkdirSync(pathJoin(srcRoot, 'src', 'styles', 'node_modules'), { recursive: true })
  writeFileSync(pathJoin(srcRoot, 'src', 'styles', 'node_modules', 'skip.js'), 'should skip')

  // 单测只测核心行为:能递归复制,跳过 node_modules
  // (package-json/index.ts 的 copyDir 不 export,这里用 inline reimplementation)
  const fsSync = await import('node:fs')
  const pathSync = await import('node:path')
  async function manualCopyDir(src: string, dest: string, skip: string[]): Promise<number> {
    let n = 0
    function walk(d: string) {
      const entries = fsSync.readdirSync(d, { withFileTypes: true })
      if (!fsSync.existsSync(dest + d.slice(src.length))) {
        fsSync.mkdirSync(dest + d.slice(src.length), { recursive: true })
      }
      for (const e of entries) {
        if (skip.includes(e.name)) continue
        const s = pathSync.join(d, e.name)
        const t = dest + s.slice(src.length)
        if (e.isDirectory()) walk(s)
        else if (e.isFile()) { fsSync.copyFileSync(s, t); n++ }
      }
    }
    walk(src)
    return n
  }

  const n = await manualCopyDir(
    pathJoin(srcRoot, 'src', 'styles'),
    pathJoin(destRoot, 'src', 'styles'),
    ['node_modules'],
  )
  assertEq('复制 3 个文件 (跳过 node_modules)', n, 3)
  assertTrue('index.scss 已复制', existsSync(pathJoin(destRoot, 'src', 'styles', 'index.scss')))
  assertTrue('sub/deep.scss 已复制', existsSync(pathJoin(destRoot, 'src', 'styles', 'sub', 'deep.scss')))
  assertTrue('node_modules 跳过', !existsSync(pathJoin(destRoot, 'src', 'styles', 'node_modules')))
  assertEq('index.scss 内容一致', readFileSync(pathJoin(destRoot, 'src', 'styles', 'index.scss'), 'utf-8'), 'body { color: red; }')

  // 清理
  rmSync(srcRoot, { recursive: true, force: true })
  rmSync(destRoot, { recursive: true, force: true })
}

// ============ iter-050a: projectNeedsElementPlusIcons ============
console.log('\n[iter-050a P0#4: projectNeedsElementPlusIcons]')

{
  const { _testable } = await import('../index.js')
  assertTrue('有 element-plus 触发', _testable.projectNeedsElementPlusIcons({ dependencies: { 'element-plus': '^2.4.0' } }))
  assertTrue('有 element-plus + 其他 deps 触发', _testable.projectNeedsElementPlusIcons({ dependencies: { 'element-plus': '^2.4.0', 'vue': '^3.0.0' } }))
  assertTrue('无 element-plus 不触发', !_testable.projectNeedsElementPlusIcons({ dependencies: { 'vue': '^2.6.0' } }))
  assertTrue('无 dependencies 不触发', !_testable.projectNeedsElementPlusIcons({}))
  assertTrue('element-ui (老) 不触发', !_testable.projectNeedsElementPlusIcons({ dependencies: { 'element-ui': '^2.13.0' } }))
  assertTrue('已有 icons-vue 不重复 (但仍 true, 由调用方决定是否再加)', _testable.projectNeedsElementPlusIcons({ dependencies: { 'element-plus': '^2.4.0', '@element-plus/icons-vue': '^2.3.0' } }))
}

// ============ iter-050a: projectImportsElementPlusIcons ============
console.log('\n[iter-050a P0#4: @element-plus/icons-vue 扫 import]')

{
  const { _testable } = await import('../index.js')
  // 模拟一个 ProjectContext.files (用 Map<string, FileNode>)
  function mockCtx(sources: Record<string, string>): any {
    const files = new Map<string, any>()
    for (const [path, source] of Object.entries(sources)) {
      files.set(path, { path, source })
    }
    return { files, root: '/x' }
  }

  // 1) 没引用 → false
  {
    const ctx = mockCtx({
      'a.vue': '<template><div></div></template>',
      'b.js': 'import lodash from "lodash"',
    })
    assertTrue('无 icons-vue 引用 = false', !_testable.projectImportsElementPlusIcons(ctx))
  }

  // 2) 一个 .vue 引用 → true
  {
    const ctx = mockCtx({
      'src/views/zip/index.vue': '<script setup>\nimport { Document } from "@element-plus/icons-vue"\n</script>',
    })
    assertTrue('vue 文件 import icons-vue = true', _testable.projectImportsElementPlusIcons(ctx))
  }

  // 3) 一个 .js 引用 → true
  {
    const ctx = mockCtx({
      'src/utils/icon.js': 'const { Upload } = require("@element-plus/icons-vue")',
    })
    assertTrue('js 文件 require icons-vue = true', _testable.projectImportsElementPlusIcons(ctx))
  }

  // 4) import.meta.glob 形式 → true
  {
    const ctx = mockCtx({
      'src/icons/index.js': 'const m = import.meta.glob("@element-plus/icons-vue/*")',
    })
    assertTrue('import.meta.glob icons-vue = true', _testable.projectImportsElementPlusIcons(ctx))
  }

  // 5) 多个文件, 至少一个引用 → true
  {
    const ctx = mockCtx({
      'a.vue': '<template></template>',
      'b.js': 'const x = 1',
      'c.ts': 'import { CaretBottom } from "@element-plus/icons-vue"',
    })
    assertTrue('混合文件, 1 个引用 = true', _testable.projectImportsElementPlusIcons(ctx))
  }

  // 6) 空 ctx → false
  {
    const ctx: any = { files: new Map(), root: '/x' }
    assertTrue('空 files = false', !_testable.projectImportsElementPlusIcons(ctx))
  }

  // 7) 只有 source 为空的 file → false
  {
    const ctx = mockCtx({ 'a.vue': '' })
    assertTrue('空 source = false', !_testable.projectImportsElementPlusIcons(ctx))
  }
}

// ============ iter-050a: isVue2Project 边界 ============
console.log('\n[iter-050a: isVue2Project 边界]')

{
  // 直接 require 私有函数
  const { isVue2Project } = await import('../index.js').then((m: any) => m._testable) as any
  // 边界场景 — 我们需要 isVue2Project 接受:
  assertTrue('vue ^2.6.11 = true', isVue2Project({ dependencies: { vue: '^2.6.11' } }))
  assertTrue('vue 2.6.10 = true', isVue2Project({ dependencies: { vue: '2.6.10' } }))
  assertTrue('vue ~2.5.0 = true', isVue2Project({ dependencies: { vue: '~2.5.0' } }))
  assertTrue('vue ^3.0.0 + vue-cli-service script = true',
    isVue2Project({ dependencies: { vue: '^3.0.0' }, scripts: { dev: 'vue-cli-service serve' } }))
  assertTrue('vue ^3.0.0 + @vue/cli-service devDep = true',
    isVue2Project({ dependencies: { vue: '^3.0.0' }, devDependencies: { '@vue/cli-service': '~5.0.0' } }))
  assertTrue('element-ui 残留 = true',
    isVue2Project({ dependencies: { element_ui: '2.13.0' } } as any) || isVue2Project({ dependencies: { 'element-ui': '2.13.0' } }))
  assertTrue('纯 vue ^3 + vite = false',
    !isVue2Project({ dependencies: { vue: '^3.4.0' }, devDependencies: { vite: '^5.0.0' }, scripts: { dev: 'vite' } }))
  assertTrue('空 = false', !isVue2Project({}))
  assertTrue('null = false', !isVue2Project(null as any))
}

// ============ iter-050a: P0#4 真实 analyze 钩子 ============
console.log('\n[iter-050a: P0#4 analyze 钩子]')

{
  // 模拟一个 vue 2 项目 + 部分转过, 但 deps 没 icons-vue + 代码 import 了 icons-vue
  const { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join: pathJoin } = await import('node:path')

  const root = mkdtempSync(pathJoin(tmpdir(), 'vmig-pkg-icons-'))
  const outDir = mkdtempSync(pathJoin(tmpdir(), 'vmig-pkg-icons-out-'))

  // 源 package.json: 有 element-plus, 没 icons-vue
  writeFileSync(pathJoin(root, 'package.json'), JSON.stringify({
    name: 'demo',
    dependencies: { vue: '^2.6.11', 'element-ui': '^2.13.2' },
    scripts: { dev: 'vue-cli-service serve' },
  }, null, 2))
  // 源 src/zip/index.vue: 用了 icons-vue
  mkdirSync(pathJoin(root, 'src', 'views', 'zip'), { recursive: true })
  writeFileSync(pathJoin(root, 'src', 'views', 'zip', 'index.vue'),
    '<script setup>\nimport { Document } from "@element-plus/icons-vue"\n</script>\n<template><div></div></template>')

  // 直接调 analyze
  const { default: plugin } = await import('../index.js') as any
  const ctx = {
    root,
    files: new Map<string, any>([[
      pathJoin(root, 'src', 'views', 'zip', 'index.vue'),
      { path: pathJoin(root, 'src', 'views', 'zip', 'index.vue'), source: '<script setup>\nimport { Document } from "@element-plus/icons-vue"\n</script>\n<template><div></div></template>' },
    ]]),
    dependencyGraph: new Map(),
    typeCache: new Map(),
    plugins: [],
    stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 },
    config: { outDir, dryRun: false, keepStructure: false, plugins: [] },
    storeNames: {},
  }
  if (plugin.analyze) await plugin.analyze(ctx)

  const outPkg = JSON.parse(readFileSync(pathJoin(outDir, 'package.json'), 'utf-8'))
  assertTrue('element-plus 已加', !!outPkg.dependencies['element-plus'])
  assertTrue('@element-plus/icons-vue 已自动注入', !!outPkg.dependencies['@element-plus/icons-vue'])
  assertEq('icons-vue 版本 ^2.3.0', outPkg.dependencies['@element-plus/icons-vue'], '^2.3.0')
  assertTrue('dev 脚本改 vite', outPkg.scripts.dev === 'vite')

  rmSync(root, { recursive: true, force: true })
  rmSync(outDir, { recursive: true, force: true })
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
