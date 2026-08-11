/**
 * @vue-migrate/plugin-auto-import-components unit tests
 *
 * iter-049a P1 #16/#17/#18 + #58-63: 自动 import 缺失组件
 *
 * 测:
 *   1. extractTemplateTags: 提取 template 块内所有 tag
 *   2. extractScriptImports: 提取 script 块内已 import 的名字
 *   3. kebabToPascal: 'tab-pane' → 'TabPane'
 *   4. inferComponentPaths: 推断 .vue 路径
 *   5. 真实 transform 钩子: <tab-pane> + <upload-excel-component> + <Share /> → 自动注入 import
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
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

// ============ 1. kebabToPascal ============
console.log('\n[kebabToPascal]')

assertEq('tab-pane → TabPane', _testable.kebabToPascal('tab-pane'), 'TabPane')
assertEq('upload-excel → UploadExcel', _testable.kebabToPascal('upload-excel'), 'UploadExcel')
assertEq('upload-excel-component → UploadExcelComponent', _testable.kebabToPascal('upload-excel-component'), 'UploadExcelComponent')
assertEq('single word', _testable.kebabToPascal('div'), 'Div')
assertEq('already Pascal', _testable.kebabToPascal('TabPane'), 'TabPane')

// ============ 2. extractTemplateTags ============
console.log('\n[extractTemplateTags]')

{
  const src = `<template>
  <div class="x">
    <tab-pane :type="item.key" />
    <upload-excel-component @success="ok" />
    <el-button>Go</el-button>
  </div>
</template>`
  const r = _testable.extractTemplateTags(src)
  assertTrue('含 div', r.includes('div'))
  assertTrue('含 tab-pane', r.includes('tab-pane'))
  assertTrue('含 upload-excel-component', r.includes('upload-excel-component'))
  assertTrue('含 el-button', r.includes('el-button'))
}

{
  const src = `<template>
  <svg><path d="..."/></svg>
  <component :is="x" />
  <keep-alive><tab-pane /></keep-alive>
</template>`
  const r = _testable.extractTemplateTags(src)
  assertTrue('含 svg', r.includes('svg'))
  assertTrue('含 path', r.includes('path'))
  assertTrue('含 component', r.includes('component'))
  assertTrue('含 keep-alive', r.includes('keep-alive'))
}

{
  const src = `<div></div>`  // 无 <template>
  const r = _testable.extractTemplateTags(src)
  assertEq('无 template = []', r, [])
}

// ============ 3. extractScriptImports ============
console.log('\n[extractScriptImports]')

{
  const src = `<script setup>
import { useRoute, useRouter } from 'vue-router'
import { ref } from 'vue'
import TabPane from './components/TabPane.vue'
import * as utils from '@/utils'
export default { name: 'X' }
</script>`
  const r = _testable.extractScriptImports(src)
  assertTrue('含 useRoute', r.has('useRoute'))
  assertTrue('含 useRouter', r.has('useRouter'))
  assertTrue('含 ref', r.has('ref'))
  assertTrue('含 TabPane', r.has('TabPane'))
  assertTrue('含 utils (namespace)', r.has('utils'))
}

{
  const src = `<script setup>
import { ref as r } from 'vue'
</script>`
  const r = _testable.extractScriptImports(src)
  assertTrue('含 r (as alias)', r.has('r'))
  assertTrue('不含 ref', !r.has('ref'))
}

{
  const src = `<script setup>
import './waves.css'  // side-effect
import { foo } from './bar.js'
</script>`
  const r = _testable.extractScriptImports(src)
  assertTrue('含 foo', r.has('foo'))
  // side-effect 不在 names — 没有 'waves' 字符串被收集
  assertTrue('不含 .css 名字', !Array.from(r).some((n: string) => n.includes('waves') || n.includes('.css')))
}

{
  const src = ``  // 无 script
  const r = _testable.extractScriptImports(src)
  assertEq('无 script = []', [...r], [])
}

// ============ 4. inferComponentPaths ============
console.log('\n[inferComponentPaths]')

{
  // 真实场景: src/views/tab/index.vue 用 <tab-pane>
  //   应指向 src/views/tab/components/TabPane.vue
  const root = mkdtempSync(join(tmpdir(), 'vmig-infer-'))
  mkdirSync(join(root, 'src', 'views', 'tab', 'components'), { recursive: true })
  writeFileSync(join(root, 'src', 'views', 'tab', 'components', 'TabPane.vue'), '')
  const fromFile = join(root, 'src', 'views', 'tab', 'index.vue')
  // 这里我们用 ctxRoot = fromFile 父, 不精确但能跑 (existsSync 测的是 ctxRoot 解析后的路径)
  // 实际用 ctxRoot = root
  const r = _testable.inferComponentPaths(fromFile, root, 'tab-pane')
  assertTrue('能找到 tab-pane 候选', r.length > 0)
  assertTrue('第一个候选是 components/TabPane.vue', r[0]?.endsWith('components/TabPane.vue'))
  rmSync(root, { recursive: true, force: true })
}

{
  // 真实场景: upload-excel → src/components/UploadExcel/index.vue
  const root = mkdtempSync(join(tmpdir(), 'vmig-infer-'))
  mkdirSync(join(root, 'src', 'components', 'UploadExcel'), { recursive: true })
  writeFileSync(join(root, 'src', 'components', 'UploadExcel', 'index.vue'), '')
  const fromFile = join(root, 'src', 'views', 'excel', 'upload-excel.vue')
  const r = _testable.inferComponentPaths(fromFile, root, 'upload-excel')
  assertTrue('能找到 upload-excel 候选', r.length > 0)
  assertTrue('候选含 components/UploadExcel/index.vue', r.some((c: string) => c.includes('components/UploadExcel/index.vue')))
  rmSync(root, { recursive: true, force: true })
}

// ============ 5. transform 钩子: 真实场景 ============
console.log('\n[transform: 真实场景]')

{
  // 模拟 views/tab/index.vue: 用了 <tab-pane> 但没 import
  // 真实文件位置: src/views/tab/components/TabPane.vue
  const root = mkdtempSync(join(tmpdir(), 'vmig-auto-'))
  mkdirSync(join(root, 'src', 'views', 'tab', 'components'), { recursive: true })
  writeFileSync(join(root, 'src', 'views', 'tab', 'components', 'TabPane.vue'), '<template><div /></template>')

  // vue 文件: 用了 <tab-pane> 但 setup 没 import
  const tabVue = `<template>
  <div>
    <tab-pane :type="item.key" />
  </div>
</template>
<script setup>
import { useRoute } from 'vue-router'
import { ref } from 'vue'
const activeName = ref('CN')
</script>`
  const tabPath = join(root, 'src', 'views', 'tab', 'index.vue')
  writeFileSync(tabPath, tabVue)

  // 直接调 transform
  const { default: plugin } = await import('../index.js') as any
  const file = {
    path: tabPath,
    relativePath: 'src/views/tab/index.vue',
    kind: 'vue',
    source: tabVue,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx = {
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
  await plugin.transform(ctx)

  assertTrue('文件被修改', file.changed)
  assertTrue('注入了 import TabPane', file.source.includes("import TabPane from '"))
  assertTrue('路径正确 (./components/TabPane.vue)', file.source.includes("./components/TabPane.vue"))

  rmSync(root, { recursive: true, force: true })
}

{
  // 场景 2: 用了 <upload-excel-component>, 路径在 src/components/UploadExcel/index.vue
  const root = mkdtempSync(join(tmpdir(), 'vmig-auto-'))
  mkdirSync(join(root, 'src', 'components', 'UploadExcel'), { recursive: true })
  mkdirSync(join(root, 'src', 'views', 'excel'), { recursive: true })
  writeFileSync(join(root, 'src', 'components', 'UploadExcel', 'index.vue'), '<template><div /></template>')

  const src = `<template>
  <upload-excel-component :on-success="handleSuccess" />
</template>
<script setup>
import { ref } from 'vue'
</script>`
  const fromPath = join(root, 'src', 'views', 'excel', 'upload-excel.vue')
  writeFileSync(fromPath, src)

  const { default: plugin } = await import('../index.js') as any
  const file = {
    path: fromPath,
    relativePath: 'src/views/excel/upload-excel.vue',
    kind: 'vue',
    source: src,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx = {
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
  await plugin.transform(ctx)

  assertTrue('文件被修改 (upload-excel)', file.changed)
  assertTrue('注入了 import UploadExcel', file.source.includes("UploadExcel"))
  // 验证 import 路径 (从 src/views/excel/upload-excel.vue 出发, 找 src/components/UploadExcel/index.vue)
  // 相对路径: ../../components/UploadExcel/index.vue
  assertTrue('import 路径含 components/UploadExcel',
    /from\s+['"][^'"]*components\/UploadExcel[^'"]*['"]/.test(file.source))

  rmSync(root, { recursive: true, force: true })
}

{
  // 场景 3: 已经 import 过了, 不重复加
  const root = mkdtempSync(join(tmpdir(), 'vmig-auto-'))
  mkdirSync(join(root, 'src', 'views', 'tab', 'components'), { recursive: true })
  writeFileSync(join(root, 'src', 'views', 'tab', 'components', 'TabPane.vue'), '')

  const src = `<template>
  <tab-pane />
</template>
<script setup>
import TabPane from './components/TabPane.vue'
</script>`
  const fromPath = join(root, 'src', 'views', 'tab', 'index.vue')
  writeFileSync(fromPath, src)

  const { default: plugin } = await import('../index.js') as any
  const file = {
    path: fromPath,
    relativePath: 'src/views/tab/index.vue',
    kind: 'vue',
    source: src,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx = {
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
  await plugin.transform(ctx)

  assertTrue('已 import 不重复加', !file.changed)

  rmSync(root, { recursive: true, force: true })
}

{
  // 场景 4: 用了 <el-button> 等已知全局, 不报错
  const src = `<template>
  <div><el-button>Go</el-button></div>
</template>
<script setup>
import { ref } from 'vue'
</script>`
  const root = mkdtempSync(join(tmpdir(), 'vmig-auto-'))
  const fromPath = join(root, 'test.vue')
  writeFileSync(fromPath, src)

  const { default: plugin } = await import('../index.js') as any
  const file = {
    path: fromPath,
    relativePath: 'test.vue',
    kind: 'vue',
    source: src,
    metadata: { features: [], dependencies: [], lang: 'js' },
    transforms: [],
    changed: false,
  }
  const ctx = {
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
  await plugin.transform(ctx)

  assertTrue('el-button 已知全局, 不加 import', !file.changed)
  assertTrue('el-button 已知全局, 不加 review', !(file._review || []).some((r: string) => r.includes('el-button')))

  rmSync(root, { recursive: true, force: true })
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
