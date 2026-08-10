/**
 * @vue-migrate/plugin-vuex-pinia unit tests
 * iter-044a (Bug A2): vuex modules-mode store 自动转 pinia aggregator
 *
 * 关键场景:
 *   1. store/modules/<name>.js 文件: const state/mutations/actions + export default
 *      → 转成 export const useXxxStore = defineStore('xxx', { state, actions })
 *   2. store/index.js: new Vuex.Store({ modules, getters }) + require.context
 *      → 转成 pinia aggregator: import 每个 store + createPinia() + export
 *   3. mutation 单参 `state =>` 形式也正确去 state
 *   4. action 多参 `{commit}, payload` 形式去掉 destructure
 *   5. mutation 内部 `state.xxx = yyy` 正确改成 `this.xxx = yyy`
 *   6. action 内部 `commit('NAME', payload)` 正确改成 `this.NAME(payload)`
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'
const _genObj = _generate
const _gen = _genObj.default || _genObj
const generate = (ast) => _gen(ast, { comments: true, retainLines: false }).code

import { registerPlugin, getPlugins } from '@vue-migrate/core'
import './../index.js'

let pass = 0
let fail = 0
const failures = []

function runTransform(file) {
  const ctx = {
    file,
    project: { 
      files: new Map([[file.path, file]]), 
      root: '/', 
      stats: { manualReviewRequired: 0 },
      storeNames: {}
    },
    utils: { 
      markChanged: () => {}, 
      manualReview: () => {} 
    }
  }
  const plugins = getPlugins()
  const p = plugins.find(pl => pl.name === 'vuex-pinia')
  p.transform(ctx)
}

function assertContains(name, output, must) {
  const missing = must.filter(s => !output.includes(s))
  if (missing.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - missing: ${missing.join(', ')}\n     output: ${output.slice(0, 500)}`)
    console.log(`  ✗ ${name} - missing: ${missing.join(', ')}`)
  }
}
function assertNotContains(name, output, mustNot) {
  const present = mustNot.filter(s => output.includes(s))
  if (present.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - present: ${present.join(', ')}`)
    console.log(`  ✗ ${name} - present: ${present.join(', ')}`)
  }
}
function makeFile(path, source) {
  const ast = parse(source, { sourceType: 'module' })
  return { scriptAst: ast, source, path, transforms: [], changed: false }
}

// ========== Module file conversion ==========
console.log('\n[Module file → defineStore]')

{
  // 完整 module: app.js with state + mutations + actions
  const input = `import Cookies from 'js-cookie'

const state = {
  sidebar: { opened: true },
  device: 'desktop'
}

const mutations = {
  TOGGLE_SIDEBAR: state => {
    state.sidebar.opened = !state.sidebar.opened
  },
  SET_SIZE: (state, size) => {
    state.size = size
    Cookies.set('size', size)
  }
}

const actions = {
  toggleSideBar({ commit }) {
    commit('TOGGLE_SIDEBAR')
  },
  setSize({ commit }, size) {
    commit('SET_SIZE', size)
  }
}

export default {
  namespaced: true,
  state,
  mutations,
  actions
}`

  const file = makeFile('/store/modules/app.js', input)
  runTransform(file)
  const output = generate(file.scriptAst)

  assertContains('defineStore called', output, ['defineStore'])
  assertContains('store id "app"', output, ['"app"'])
  assertContains('useAppStore export', output, ['useAppStore'])
  assertContains('state is a function returning object', output, ['state: () =>'])
  assertContains('mutations ref still in actions', output, ['TOGGLE_SIDEBAR:'])
  assertContains('actions in actions', output, ['toggleSideBar:'])
  assertContains('this.sidebar.opened (state→this replacement)', output, ['this.sidebar.opened'])
  assertContains('this.size = size (state→this replacement in multi-arg mutation)', output, ['this.size = size'])
  assertContains('SET_SIZE single param (no state arg)', output, ['SET_SIZE: function (size)'])
  assertNotContains('old const state declaration', output, ['const state = {'])
  assertNotContains('old const mutations declaration', output, ['const mutations = {'])
  assertNotContains('old const actions declaration', output, ['const actions = {'])
  assertNotContains('old export default', output, ['export default {'])
  // commit destructure removed
  assertNotContains('commit destructure in toggleSideBar', output, ['toggleSideBar: function ({'])
  // commit call replaced
  assertNotContains('commit() calls', output, ["commit('TOGGLE_SIDEBAR')"])
  // defineStore import
  assertContains('defineStore from pinia', output, ['pinia'])
}

{
  // Edge case: mutation with 0 args (no state) - should keep as is
  const input = `const state = { x: 1 }
const mutations = {
  NOOP: () => { /* nothing */ }
}
export default { namespaced: true, state, mutations }`
  const file = makeFile('/store/modules/foo.js', input)
  runTransform(file)
  const output = generate(file.scriptAst)
  assertContains('NOOP kept as arrow fn', output, ['NOOP:'])
}

{
  // Edge case: not a vuex module file (no state/mutations/actions default export) → no-op
  const input = `import { foo } from 'bar'
export const x = 1`
  const file = makeFile('/some/random.js', input)
  runTransform(file)
  const output = generate(file.scriptAst)
  assertNotContains('random file untouched', output, ['defineStore'])
}

console.log('\n[Index.js modules pattern → pinia aggregator]')

{
  // 真实 vue-element-admin index.js 模式
  const input = `import Vue from 'vue'
import Vuex from 'vuex'
import getters from './getters'

Vue.use(Vuex)

const modulesFiles = require.context('./modules', true, /\\.js$/)

const modules = modulesFiles.keys().reduce((modules, modulePath) => {
  const moduleName = modulePath.replace(/^\\.\\/(.*)\\.\\w+$/, '$1')
  const value = modulesFiles(modulePath)
  modules[moduleName] = value.default
  return modules
}, {})

const store = new Vuex.Store({
  modules,
  getters
})

export default store`

  // 提供 store/modules/app.js, user.js, settings.js
  const projectFiles = new Map()
  const idx = makeFile('/store/index.js', input)
  projectFiles.set(idx.path, idx)
  for (const name of ['app', 'user', 'settings']) {
    const mf = makeFile(`/store/modules/${name}.js`, 
      `const state = { x: 1 }
const mutations = { NOOP: state => { state.x = 2 } }
const actions = { foo() {} }
export default { namespaced: true, state, mutations, actions }`)
    projectFiles.set(mf.path, mf)
  }

  const ctx = {
    file: idx,
    project: { 
      files: projectFiles, 
      root: '/', 
      stats: { manualReviewRequired: 0 },
      storeNames: {}
    },
    utils: { 
      markChanged: (msg) => { idx.changed = true }, 
      manualReview: () => {} 
    }
  }
  const plugins = getPlugins()
  const p = plugins.find(pl => pl.name === 'vuex-pinia')
  p.transform(ctx)

  // Check that file.source is replaced
  assertContains('createPinia import', idx.source, ['createPinia'])
  assertContains('useAppStore import', idx.source, ['useAppStore'])
  assertContains('useUserStore import', idx.source, ['useUserStore'])
  assertContains('useSettingsStore import', idx.source, ['useSettingsStore'])
  assertNotContains('no Vue.use(Vuex) in rewritten', idx.source, ['Vue.use(Vuex)'])
  assertNotContains('no require.context in rewritten', idx.source, ['require.context'])
  assertNotContains('no new Vuex.Store in rewritten', idx.source, ['new Vuex.Store'])
  assertNotContains('no import Vuex in rewritten', idx.source, ['import Vuex from'])
  assertContains('createPinia call', idx.source, ['createPinia()'])
  assertContains('export default pinia', idx.source, ['export default pinia'])
  // useRawSource is a property on the file object, not a string
  if ((idx).useRawSource === true) {
    pass++; console.log('  ✓ useRawSource flag set')
  } else {
    fail++; console.log('  ✗ useRawSource flag NOT set, got:', (idx).useRawSource)
  }
}

{
  // Edge case: empty modules (no module files in project)
  const input = `import Vuex from 'vuex'
const modules = {}
const store = new Vuex.Store({ modules, getters: {} })
export default store`
  const projectFiles = new Map()
  const idx = makeFile('/store/index.js', input)
  projectFiles.set(idx.path, idx)

  const ctx = {
    file: idx,
    project: { files: projectFiles, root: '/', stats: { manualReviewRequired: 0 }, storeNames: {} },
    utils: { markChanged: () => {}, manualReview: () => {} }
  }
  const plugins = getPlugins()
  const p = plugins.find(pl => pl.name === 'vuex-pinia')
  p.transform(ctx)
  // empty modules: we fall through to the old "review only" path, file unchanged
  assertNotContains('empty modules: no createPinia', idx.source, ['createPinia'])
}

console.log(`\n${pass} pass, ${fail} fail`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
