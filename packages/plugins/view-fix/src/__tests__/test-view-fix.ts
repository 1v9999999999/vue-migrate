/**
 * @vue-migrate/plugin-view-fix unit tests
 *
 * 测 7 个 view-level bug 修复规则
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _testable } from '../index.js'

let pass = 0
let fail = 0
const failures: string[] = []

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

function makeFileCtx(path: string, source: string, root: string) {
  const file: any = {
    path,
    relativePath: path.replace(root + '\\', '').replace(/\\/g, '/'),
    kind: 'vue',
    source,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx: any = {
    file,
    project: { root, files: new Map(), dependencyGraph: new Map(), typeCache: new Map(), plugins: [], stats: { totalFiles: 0, modifiedFiles: 0, newTypesInferred: 0, manualReviewRequired: 0, errors: 0 }, config: {}, storeNames: {} },
    utils: {
      markChanged: (msg?: string) => { file.changed = true; file._mark = msg },
      manualReview: (msg: string) => { file._review = (file._review || []).concat([msg]) },
      reparse: () => {},
      syncScriptAstToSource: () => {},
    } as any,
    syncScriptAstToSource: () => {},
    log: (m: string) => {},
    __changed: false,
  }
  return { file, ctx }
}

// ============ BUG-009: dashboard currentRole ============
console.log('\n[BUG-009: dashboard currentRole]')

{
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-009-'))
  mkdirSync(join(root, 'src/views/dashboard/admin'), { recursive: true })
  mkdirSync(join(root, 'src/views/dashboard/editor'), { recursive: true })
  writeFileSync(join(root, 'src/views/dashboard/admin/index.vue'), '')
  writeFileSync(join(root, 'src/views/dashboard/editor/index.vue'), '')

  const src = `<template>
  <div class="dashboard-container">
    <component :is="currentRole" />
  </div>
</template>
<script setup>
import { useUserStore } from '@/store';
import { computed, ref } from 'vue';
const currentRole = ref('adminDashboard')
const roles = computed(() => useUserStore().roles)
if (!roles.value.includes('admin')) {
  currentRole.value = 'editorDashboard';
}
</script>`
  const path = join(root, 'src/views/dashboard/index.vue')
  const { file, ctx } = makeFileCtx(path, src, root)

  const r = _testable.fixDashboardCurrentRole(ctx, root)
  assertTrue('触发', r)
  assertTrue('import adminDashboard', file.source.includes("import adminDashboard from './admin'"))
  assertTrue('import editorDashboard', file.source.includes("import editorDashboard from './editor'"))
  assertTrue('currentRole = ref(adminDashboard)', file.source.includes('currentRole = ref(adminDashboard)'))
  assertTrue('currentRole.value = editorDashboard', file.source.includes('currentRole.value = editorDashboard'))

  rmSync(root, { recursive: true, force: true })
}

// ============ BUG-010: FixedThead defaultFormThead ============
console.log('\n[BUG-010: FixedThead defaultFormThead]')

{
  const src = `<template><div /></template>
<script setup>
import { ref } from 'vue'
const checkboxVal = ref(defaultFormThead)
const formThead = ref(defaultFormThead)
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-010-'))
  const { file, ctx } = makeFileCtx(join(root, 'src/views/table/dynamic-table/components/FixedThead.vue'), src, root)
  const r = _testable.fixFixedTheadDefault(ctx)
  assertTrue('触发', r)
  assertTrue('defaultFormThead 已注入', /const\s+defaultFormThead\s*=\s*\['apple',\s*'banana'\]/.test(file.source))

  rmSync(root, { recursive: true, force: true })
}

{
  // 已修不重复
  const src = `<script setup>
const defaultFormThead = ['x', 'y']
const checkboxVal = ref(defaultFormThead)
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-010-'))
  const { file, ctx } = makeFileCtx(join(root, 'FixedThead.vue'), src, root)
  const r = _testable.fixFixedTheadDefault(ctx)
  assertTrue('已修不重复', !r)

  rmSync(root, { recursive: true, force: true })
}

// ============ BUG-011: Sidebar/Item.vue empty template ============
console.log('\n[BUG-011: Sidebar/Item.vue empty template]')

{
  const src = `<template>

</template>
<script setup>
const props = defineProps({ icon: String, title: String })
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-011-'))
  const { file, ctx } = makeFileCtx(join(root, 'src/layout/components/Sidebar/Item.vue'), src, root)
  const r = _testable.fixSidebarItemTemplate(ctx)
  assertTrue('触发', r)
  assertTrue('注入 svg-icon', file.source.includes('svg-icon'))
  assertTrue('注入 {{ title }}', file.source.includes('{{ title }}'))

  rmSync(root, { recursive: true, force: true })
}

{
  // template 非空不修
  const src = `<template>
  <div>OK</div>
</template>
<script setup>
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-011-'))
  const { file, ctx } = makeFileCtx(join(root, 'src/layout/components/Sidebar/Item.vue'), src, root)
  const r = _testable.fixSidebarItemTemplate(ctx)
  assertTrue('非空不修', !r)

  rmSync(root, { recursive: true, force: true })
}

{
  // 完全无 <template> 块
  const src = `<script setup>
const props = defineProps({ icon: String, title: String })
</script>
<style scoped>
.x { color: red }
</style>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-011-'))
  const { file, ctx } = makeFileCtx(join(root, 'src/layout/components/Sidebar/Item.vue'), src, root)
  const r = _testable.fixSidebarItemTemplate(ctx)
  assertTrue('无 template 块也修', r)
  assertTrue('注入 <template>', file.source.includes('<template>'))
  assertTrue('注入 svg-icon', file.source.includes('svg-icon'))

  rmSync(root, { recursive: true, force: true })
}

// ============ BUG-012/013: isExternal 命名冲突 ============
console.log('\n[BUG-012/013: isExternal 命名冲突]')

{
  const src = `<script setup>
import { isExternal } from '@/utils/validate';
const props = defineProps({ iconClass: String });
const isExternal = computed(() => {
  return isExternal(props.iconClass);
});
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-012-'))
  const { file, ctx } = makeFileCtx(join(root, 'src/components/SvgIcon/index.vue'), src, root)
  const r = _testable.fixIsExternalNameCollision(ctx)
  assertTrue('触发', r)
  assertTrue('import 改 alias', file.source.includes('import { isExternal as validateIsExternal } from \'@/utils/validate\''))
  assertTrue('computed 内调别名', file.source.includes('return validateIsExternal('))
  assertTrue('const isExternal = computed 保留', file.source.includes('const isExternal = computed'))

  rmSync(root, { recursive: true, force: true })
}

{
  // 已修不重复
  const src = `<script setup>
import { isExternal as validateIsExternal } from '@/utils/validate';
const isExternal = computed(() => validateIsExternal(props.iconClass));
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-012-'))
  const { file, ctx } = makeFileCtx(join(root, 'src/components/SvgIcon/index.vue'), src, root)
  const r = _testable.fixIsExternalNameCollision(ctx)
  assertTrue('已 alias 不修', !r)

  rmSync(root, { recursive: true, force: true })
}

// ============ BUG-014: popper-append-to-body ============
console.log('\n[BUG-014: popper-append-to-body]')

{
  const src = `<template>
  <el-sub-menu :index="x" popper-append-to-body>
    <span>Menu</span>
  </el-sub-menu>
</template>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-014-'))
  const { file, ctx } = makeFileCtx(join(root, 'SidebarItem.vue'), src, root)
  const r = _testable.fixPopperAppendToBody(ctx)
  assertTrue('触发', r)
  assertTrue('popper-append-to-body 已删', !file.source.includes('popper-append-to-body'))
  assertTrue('保留其他 props', file.source.includes(':index="x"'))

  rmSync(root, { recursive: true, force: true })
}

// ============ BUG-068: checkPermission ============
console.log('\n[BUG-068: checkPermission import]')

{
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-068-'))
  mkdirSync(join(root, 'src/utils'), { recursive: true })
  writeFileSync(join(root, 'src/utils/permission.js'), 'export function checkPermission() {}')

  const src = `<template>
  <div v-if="checkPermission(['admin'])">Admin</div>
</template>
<script setup>
import { ref } from 'vue'
</script>`
  const { file, ctx } = makeFileCtx(join(root, 'src/views/permission/directive.vue'), src, root)
  const r = _testable.fixCheckPermissionImport(ctx, root)
  assertTrue('触发', r)
  assertTrue('import checkPermission 已注入', file.source.includes("import { checkPermission } from '@/utils/permission'"))

  rmSync(root, { recursive: true, force: true })
}

// ============ BUG-070: uppercaseFirst ============
console.log('\n[BUG-070: uppercaseFirst fallback]')

{
  // src/utils/validate.js 不存在或不含 uppercaseFirst → 注入 inline
  const root = mkdtempSync(join(tmpdir(), 'vmig-vf-070-'))
  const src = `<template>
  <div>{{ uppercaseFirst(user.role) }}</div>
</template>
<script setup>
import { ref } from 'vue'
const user = ref({ role: 'admin' })
</script>`
  const { file, ctx } = makeFileCtx(join(root, 'src/views/profile/components/UserCard.vue'), src, root)
  const r = _testable.fixUppercaseFirstImport(ctx, root)
  assertTrue('触发', r)
  assertTrue('uppercaseFirst 已注入', /const\s+uppercaseFirst\s*=/.test(file.source))

  rmSync(root, { recursive: true, force: true })
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
