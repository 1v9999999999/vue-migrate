/**
 * @vue-migrate/plugin-store-bridge unit tests
 * iter-046: verify store.X.Y / store.dispatch / store.getters / useStore() conversion to Pinia
 */

import { registerPlugin, getPlugins } from '@vue-migrate/core'
import '../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

function makeFile(path: string, source: string, kind: 'vue' | 'js' = 'vue') {
  return { path, source, kind, transforms: [], changed: false, metadata: {}, sfc: { script: null, template: null, style: null, customBlocks: [], descriptor: null } }
}

function runTransform(file: any) {
  const ctx = {
    file,
    project: {
      files: new Map([[file.path, file]]),
      root: '/',
      stats: { manualReviewRequired: 0 },
      storeNames: {},
    },
    utils: {
      markChanged: (msg?: string) => { file.changed = true },
      manualReview: (reason: string) => { /* no-op */ },
    },
    log: (msg: string) => {},
  }
  const plugins = getPlugins()
  const p = plugins.find(pl => pl.name === 'store-bridge')
  p!.transform!(ctx)
}

function assertContains(name: string, output: string, must: string[]) {
  const missing = must.filter(s => !output.includes(s))
  if (missing.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - missing: ${missing.join(', ')}\n     output: ${output.slice(0, 600)}`)
    console.log(`  ✗ ${name} - missing: ${missing.join(', ')}`)
  }
}
function assertNotContains(name: string, output: string, mustNot: string[]) {
  const present = mustNot.filter(s => output.includes(s))
  if (present.length === 0) {
    pass++; console.log(`  ✓ ${name}`)
  } else {
    fail++; failures.push(`${name} - present: ${present.join(', ')}`)
    console.log(`  ✗ ${name} - present: ${present.join(', ')}`)
  }
}

// Helper to extract the <script> block from a vue file
function extractScript(source: string): string {
  const m = source.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)
  return m ? m[1] : source
}

console.log('\n[store-bridge: useStore() no-arg → useAppStore()]')
{
  const input = `<template><div>hi</div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
function f() { return store.state.app.sidebar }
</script>`

  const file = makeFile('/test/CompA.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('useStore() replaced with useAppStore()', script, ['useAppStore()'])
  assertNotContains('import useStore from pinia removed', script, ["from 'pinia'"])
  assertContains('store.state.app.sidebar → useAppStore().sidebar', script, ['useAppStore().sidebar'])
  assertContains('useAppStore import added', script, ["import { useAppStore } from '@/store'"])
}

console.log('\n[store-bridge: store.state.X.Y paths]')
{
  const input = `<template><div>{{ v }}</div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
const v = store.state.user.name
const t = store.state.user.token
const r = store.state.user.roles
const s = store.state.app.sidebar
const d = store.state.app.device
const tv = store.state.tagsView.visitedViews
const cv = store.state.tagsView.cachedViews
const perm = store.state.permission.routes
</script>`

  const file = makeFile('/test/CompB.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('useUserStore().name', script, ['useUserStore().name'])
  assertContains('useUserStore().token', script, ['useUserStore().token'])
  assertContains('useUserStore().roles', script, ['useUserStore().roles'])
  assertContains('useAppStore().sidebar', script, ['useAppStore().sidebar'])
  assertContains('useAppStore().device', script, ['useAppStore().device'])
  assertContains('useTagsViewStore().visitedViews', script, ['useTagsViewStore().visitedViews'])
  assertContains('useTagsViewStore().cachedViews', script, ['useTagsViewStore().cachedViews'])
  assertContains('usePermissionStore().routes', script, ['usePermissionStore().routes'])
  // 全部 useXxxStore import 应该合并到一行
  assertContains('useUserStore/useAppStore/useTagsViewStore/usePermissionStore in import', script, [
    'useUserStore', 'useAppStore', 'useTagsViewStore', 'usePermissionStore',
  ])
  assertContains('only one @/store import line', script, ["from '@/store'"])
}

console.log('\n[store-bridge: store.dispatch("X/Y", payload)]')
{
  const input = `<template><div></div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
function f1() { store.dispatch('app/toggleSideBar') }
function f2() { store.dispatch('user/login', loginForm) }
function f3() { store.dispatch('tagsView/delAllViews', null, { root: true }) }
function f4() { store.dispatch('app/closeSideBar', { withoutAnimation: false }) }
</script>`

  const file = makeFile('/test/CompC.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('app/toggleSideBar → useAppStore().toggleSideBar()', script, ['useAppStore().toggleSideBar()'])
  assertContains('user/login,loginForm → useUserStore().login(loginForm)', script, ['useUserStore().login(loginForm)'])
  assertContains('tagsView/delAllViews → useTagsViewStore().delAllViews(null,', script, ['useTagsViewStore().delAllViews(null,'])
  assertContains('app/closeSideBar,{withoutAnimation:false}', script, ['useAppStore().closeSideBar({ withoutAnimation: false })'])
}

console.log('\n[store-bridge: store.getters.X → useXxxStore().X]')
{
  const input = `<template><div></div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
const t = store.getters.token
const r = store.getters.roles
const a = store.getters.avatar
const s = store.getters.size
const ev = store.getters.errorLogs
const tv = store.getters.visitedViews
const pr = store.getters.permission_routes
</script>`

  const file = makeFile('/test/CompD.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('store.getters.token → useUserStore().token', script, ['useUserStore().token'])
  assertContains('store.getters.roles → useUserStore().roles', script, ['useUserStore().roles'])
  assertContains('store.getters.avatar → useUserStore().avatar', script, ['useUserStore().avatar'])
  assertContains('store.getters.size → useAppStore().size', script, ['useAppStore().size'])
  assertContains('store.getters.errorLogs → useErrorLogStore().errorLogs', script, ['useErrorLogStore().errorLogs'])
  assertContains('store.getters.visitedViews → useTagsViewStore().visitedViews', script, ['useTagsViewStore().visitedViews'])
  assertContains('store.getters.permission_routes → usePermissionStore().permission_routes', script, ['usePermissionStore().permission_routes'])
}

console.log('\n[store-bridge: store.commit("X/Y", payload) → useXxxStore().Y(payload)]')
{
  const input = `<template><div></div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
store.commit('user/SET_TOKEN', token)
store.commit('app/SET_SIZE', 'medium')
</script>`

  const file = makeFile('/test/CompE.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('user/SET_TOKEN → useUserStore().SET_TOKEN(token)', script, ['useUserStore().SET_TOKEN(token)'])
  assertContains('app/SET_SIZE → useAppStore().SET_SIZE(\'medium\')', script, ["useAppStore().SET_SIZE('medium')"])
}

console.log('\n[store-bridge: bare commit() / dispatch() in setup]')
{
  const input = `<template><div></div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
function f() {
  commit('user/SET_TOKEN', newToken)
  dispatch('app/toggleSideBar')
}
</script>`

  const file = makeFile('/test/CompF.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('commit(\'user/SET_TOKEN\', newToken) → useUserStore().SET_TOKEN(newToken)', script, ['useUserStore().SET_TOKEN(newToken)'])
  assertContains('dispatch(\'app/toggleSideBar\') → useAppStore().toggleSideBar()', script, ['useAppStore().toggleSideBar()'])
}

console.log('\n[store-bridge: edge case - no useStore / no store.X]')
{
  // 普通文件,无 useStore/store.dispatch
  const input = `<template><div>hi</div></template>
<script setup>
const x = 1
</script>`

  const file = makeFile('/test/CompG.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('unchanged - no useXxxStore import added', script, ['x = 1'])
  // not 包含 useXxxStore import
  if (!script.includes("from '@/store'")) {
    pass++; console.log('  ✓ no store import added when not needed')
  } else {
    fail++; failures.push('CompG - store import added when not needed')
    console.log('  ✗ CompG - store import added when not needed')
  }
}

console.log('\n[store-bridge: edge case - .js file (not .vue)]')
{
  const input = `import { useStore } from 'pinia'
const store = useStore()
function f() {
  return store.state.app.sidebar
}
function g() {
  return store.dispatch('user/login', p)
}`

  const file = makeFile('/test/compH.js', input, 'js')
  runTransform(file)

  assertContains('useStore() → useAppStore()', file.source, ['useAppStore()'])
  assertContains('store.state.app.sidebar → useAppStore().sidebar', file.source, ['useAppStore().sidebar'])
  assertContains('store.dispatch → useUserStore().login(p)', file.source, ['useUserStore().login(p)'])
  assertContains('useUserStore/useAppStore in import', file.source, ["from '@/store'"])
}

console.log('\n[store-bridge: edge case - file with existing store import]')
{
  const input = `<template><div></div></template>
<script setup>
import { useStore } from 'pinia'
import { useUserStore } from '@/store'
const userStore = useUserStore()
const store = useStore()
function f() { return store.state.app.sidebar }
</script>`

  const file = makeFile('/test/CompI.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  // 应该保留 useUserStore import + 新增 useAppStore
  assertContains('useUserStore preserved in import', script, ['useUserStore'])
  assertContains('useAppStore added to import', script, ['useAppStore'])
  // 仍然只有一行 @/store import
  const importMatches = script.match(/from\s+['"]@\/store['"]/g) || []
  if (importMatches.length === 1) {
    pass++; console.log('  ✓ single @/store import (deduped)')
  } else {
    fail++; failures.push(`CompI - expected 1 @/store import, got ${importMatches.length}`)
    console.log(`  ✗ CompI - expected 1 @/store import, got ${importMatches.length}`)
  }
}

console.log('\n[store-bridge: complex payload with parens/brackets]')
{
  const input = `<template><div></div></template>
<script setup>
import { useStore } from 'pinia'
const store = useStore()
function f() {
  store.dispatch('tagsView/updateVisitedView', { path: '/foo', query: {} })
}
</script>`

  const file = makeFile('/test/CompJ.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('complex object payload preserved', script, ["useTagsViewStore().updateVisitedView({ path: '/foo', query: {} })"])
}

console.log('\n[store-bridge: this.$store.X.Y in mixin/Options API]')
{
  // 像 layout/mixin/ResizeHandler.js 这种 Options API mixin
  const input = `export default {
  computed: {
    device() {
      return this.$store.state.app.device
    }
  },
  watch: {
    '$route'(route) {
      if (this.device === 'mobile') {
        this.$store.dispatch('app/closeSideBar', { withoutAnimation: false })
      }
    }
  },
  mounted() {
    const t = this.$store.getters.token
    this.$store.commit('user/SET_NAME', 'admin')
  }
}`

  const file = makeFile('/mixin/FixiOSBug.js', input, 'js')
  runTransform(file)

  assertContains('this.$store.state.app.device → useAppStore().device', file.source, ['useAppStore().device'])
  assertContains('this.$store.dispatch("app/closeSideBar", ...) → useAppStore().closeSideBar(...)', file.source, ['useAppStore().closeSideBar({ withoutAnimation: false })'])
  assertContains('this.$store.getters.token → useUserStore().token', file.source, ['useUserStore().token'])
  assertContains('this.$store.commit("user/SET_NAME", "admin") → useUserStore().SET_NAME("admin")', file.source, ["useUserStore().SET_NAME('admin')"])
  assertContains('useAppStore/useUserStore import added to mixin file', file.source, ['useAppStore', 'useUserStore'])
}

console.log('\n[store-bridge: .js file with "import store from @/store" (default import)]')
{
  // 像 utils/request.js, utils/permission.js
  const input = `import store from '@/store';
import { ElMessage } from "element-plus";

if (store.getters.token) {
  // ...
}

function reset() {
  return store.dispatch('user/resetToken');
}

function setName(name) {
  store.commit('user/SET_NAME', name);
}`

  const file = makeFile('/utils/request.js', input, 'js')
  runTransform(file)

  assertContains('default import removed', file.source, [])
  assertNotContains('default import "store from @/store" removed', file.source, ['import store from'])
  assertContains('store.getters.token → useUserStore().token', file.source, ['useUserStore().token'])
  assertContains('store.dispatch("user/resetToken") → useUserStore().resetToken()', file.source, ['useUserStore().resetToken()'])
  assertContains('store.commit("user/SET_NAME", name) → useUserStore().SET_NAME(name)', file.source, ['useUserStore().SET_NAME(name)'])
  assertContains('useUserStore import added', file.source, ["from '@/store'"])
}

console.log('\n[store-bridge: bare this.$store fallback to useAppStore()]')
{
  const input = `export default {
  methods: {
    foo() {
      return this.$store;  // 直接拿 store (罕见)
    }
  }
}`

  const file = makeFile('/mixin/UseStore.js', input, 'js')
  runTransform(file)

  assertContains('this.$store → useAppStore()', file.source, ['useAppStore()'])
  assertContains('useAppStore import added', file.source, ["from '@/store'"])
}

console.log('\n[store-bridge: short-circuit store.X && store.X.Y cleanup]')
{
  // utils/permission.js 原始: const roles = store.getters && store.getters.roles
  // 6.5 步先转 store.getters.roles → useUserStore().roles, 留下 store.getters &&
  // 6.7 步清理 store.getters && → 仅留 useUserStore().roles
  const input = `import { useUserStore } from '@/store'
function checkPermission(value) {
  if (value && value instanceof Array && value.length > 0) {
    const roles = store.getters && useUserStore().roles
    return roles.some(r => r === 'admin')
  }
  return false
}`

  const file = makeFile('/utils/perm.js', input, 'js')
  runTransform(file)

  assertNotContains('store.getters && removed', file.source, ['store.getters &&'])
  assertContains('useUserStore().roles preserved', file.source, ['useUserStore().roles'])
  // 不应破坏 roles 变量赋值
  assertContains('const roles = useUserStore().roles', file.source, ['const roles = useUserStore().roles'])
}

console.log('\n[store-bridge: short-circuit this.$store.X && this.$store.X.Y cleanup]')
{
  // Options API 源的短路
  const input = `export default {
  methods: {
    check() {
      const t = this.$store && this.$store.getters.token
      return t
    }
  }
}`

  const file = makeFile('/mixin/Check.js', input, 'js')
  runTransform(file)

  assertNotContains('this.$store && removed', file.source, ['this.$store &&'])
  assertContains('useUserStore().token preserved', file.source, ['useUserStore().token'])
}

console.log('\n[store-bridge: short-circuit || form]')
{
  const input = `import { useUserStore } from '@/store'
function f() {
  const t = store.getters || useUserStore().token
  return t
}`

  const file = makeFile('/utils/or.js', input, 'js')
  runTransform(file)

  assertNotContains('store.getters || removed', file.source, ['store.getters ||'])
  assertContains('useUserStore().token preserved', file.source, ['useUserStore().token'])
}

console.log('\n[store-bridge: short-circuit preserves import even when fully removed]')
{
  // 如果文件里 store.X.Y 是唯一一处 store 引用, 短路清理后 store 变量消失,
  // 但 useXxxStore import 仍应保留 (因为右侧 useUserStore().X 还在用)
  const input = `import { useUserStore } from '@/store'
function f() {
  return store.state && store.state.user.name
}`

  const file = makeFile('/utils/state.js', input, 'js')
  runTransform(file)

  assertNotContains('store.state && removed', file.source, ['store.state &&'])
  assertContains('useUserStore().name preserved', file.source, ['useUserStore().name'])
  assertContains('useUserStore import still present', file.source, ['useUserStore'])
}

console.log('\n[store-bridge: smart rewrite useAppStore().X when X in another store]')
{
  // composition plugin 输出 `useAppStore().avatar` (默认 fallback),
  // 但 avatar 实际在 user store, 智能改写
  const input = `<template><div>{{ avatar }}</div></template>
<script setup>
import { useAppStore } from '@/store'
const avatar = computed(() => useAppStore().avatar)
</script>`

  const file = makeFile('/components/Avatar.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('useAppStore().avatar rewritten to useUserStore().avatar', script, ['useUserStore().avatar'])
  assertNotContains('old useAppStore().avatar not present', script, ['useAppStore().avatar'])
  assertContains('useUserStore import added', script, ['useUserStore'])
}

console.log('\n[store-bridge: smart rewrite preserves useAppStore().X for app-store fields]')
{
  // device 在 app store, 不应改写
  const input = `<template><div></div></template>
<script setup>
import { useAppStore } from '@/store'
const device = computed(() => useAppStore().device)
</script>`

  const file = makeFile('/components/Device.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('useAppStore().device kept (app store)', script, ['useAppStore().device'])
}

console.log('\n[store-bridge: smart rewrite does not break useAppStore().method() calls]')
{
  // 跳过 useAppStore().method(p) 形式, 这是 action, 不动
  const input = `<template><div></div></template>
<script setup>
import { useAppStore } from '@/store'
function f() {
  return useAppStore().toggleSideBar()
}
</script>`

  const file = makeFile('/components/Action.vue', input)
  runTransform(file)
  const script = extractScript(file.source)

  assertContains('useAppStore().toggleSideBar() kept (action call)', script, ['useAppStore().toggleSideBar()'])
}

// =================================================================
// iter-109: dedup imports — 不重复 import 已经存在的 useXxxStore
// =================================================================

console.log('\n[store-bridge: dedup imports — 跳过已 import 的 store]')
{
  // 场景 1: 文件已经 `import { useAppStore } from '@/store/modules/app'`,
  //         store-bridge 不能再补一行 `import { useAppStore } from '@/store'`
  const input1 = `import { useAppStore } from '@/store/modules/app';
import { useUserStore } from '@/store/modules/user';
export const getters = {
  sidebar: () => useAppStore().sidebar,
  token: () => useUserStore().token
};
const x = store.getters.token;`

  const file1 = makeFile('/store/getters.js', input1, 'js')
  runTransform(file1)

  // 期望: 不再补 `import { useAppStore } from '@/store'` (因为已经 from @/store/modules/app)
  // 检查: 不能出现 `useAppStore has already been declared` (即不出现重复的 import line)
  const appStoreImportCount = (file1.source.match(/import\s*\{[^}]*useAppStore[^}]*\}\s*from\s*['"]@?\/store[^'"]*['"]/g) || []).length
  assertContains(
    'iter-109: useAppStore from @/store/modules/* 不再补 @/store 主入口',
    file1.source,
    [String(appStoreImportCount) === '1' ? 'ok' : 'fail']
  )

  // 也检查 useUserStore
  const userStoreImportCount = (file1.source.match(/import\s*\{[^}]*useUserStore[^}]*\}\s*from\s*['"]@?\/store[^'"]*['"]/g) || []).length
  assertContains(
    'iter-109: useUserStore from @/store/modules/* 不再补 @/store 主入口',
    file1.source,
    [String(userStoreImportCount) === '1' ? 'ok' : 'fail']
  )
}

console.log('\n[store-bridge: dedup imports — 已有 @/store import 时合并]')
{
  // 场景 2: 文件已经 `import { useUserStore } from '@/store'`, store-bridge 补 useAppStore
  //         应该合并到现有 import, 不新加一行
  //         关键: 必须有 store.* 调用触发 store-bridge 收集新 import
  const input2 = `import { useUserStore } from '@/store';
const roles = useUserStore().roles;
const perm = store.getters.permission_routes;
const device = store.state.app.device;`

  const file2 = makeFile('/utils/auth.js', input2, 'js')
  runTransform(file2)

  // 期望: 合并到一行 import, 不是两行
  const lines = file2.source.split('\n').filter(l => l.includes("from '@/store'"))
  if (lines.length === 1) {
    pass++; console.log(`  ✓ iter-109: 已有 @/store import 时合并为 1 行`)
  } else {
    fail++; console.log(`  ✗ iter-109: 合并失败, got ${lines.length} lines: ${lines.join(' || ')}`)
  }
  if (file2.source.includes('useAppStore')) {
    pass++; console.log(`  ✓ iter-109: 合并后包含 useAppStore`)
  } else {
    fail++; console.log(`  ✗ iter-109: 合并后缺失 useAppStore`)
  }
}

console.log(`\npass ${pass}\nfail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log('  - ' + f.split('\n')[0])
  process.exit(1)
}
