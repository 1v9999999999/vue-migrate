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

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
