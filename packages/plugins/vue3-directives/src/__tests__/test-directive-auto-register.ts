/**
 * iter-048a F6 单测: directive auto-register in main.js
 */
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { autoRegisterDirectivesInMain } from '../rules/directive-auto-register.js'

let pass = 0
let fail = 0
const failures: string[] = []

async function setupFixture(
  mainContent: string,
  directives: Array<{ dirName: string; name: string }>,
): Promise<{ root: string; mainPath: string; directiveFiles: string[] }> {
  const root = mkdtempSync(join(tmpdir(), 'vmig-f6-'))
  const srcDir = join(root, 'src')
  mkdirSync(srcDir, { recursive: true })
  const directiveDir = join(srcDir, 'directive')
  mkdirSync(directiveDir, { recursive: true })
  const mainPath = join(srcDir, 'main.js')
  writeFileSync(mainPath, mainContent, 'utf-8')

  const directiveFiles: string[] = []
  for (const d of directives) {
    const dDir = join(directiveDir, d.dirName)
    mkdirSync(dDir, { recursive: true })
    const idxPath = join(dDir, 'index.js')
    const content = `import ${d.dirName} from './${d.dirName}'
const install = function (app) {
  app.directive('${d.name}', ${d.dirName})
}
${d.dirName}.install = install
export default ${d.dirName}
`
    writeFileSync(idxPath, content, 'utf-8')
    directiveFiles.push(idxPath)
  }
  return { root, mainPath, directiveFiles }
}

function assertResult(name: string, actual: any, predicate: (r: any) => boolean, expected: string): void {
  if (predicate(actual)) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     expected: ${expected}\n     actual:   ${JSON.stringify(actual)}`)
    console.log(`  ✗ ${name}\n     expected: ${expected}\n     actual:   ${JSON.stringify(actual)}`)
  }
}

const SIMPLE_MAIN = `import { createApp } from 'vue'
import App from './App'
import router from './router'
import store from './store'

const app = createApp(App)
app.use(router).use(store).mount('#app')
`

// ============ F6: 单 directive 注入 ============
console.log('\n[F6: directive auto-register]')

{
  const { root, mainPath, directiveFiles } = await setupFixture(SIMPLE_MAIN, [
    { dirName: 'waves', name: 'waves' },
    { dirName: 'permission', name: 'permission' },
  ])

  const r = await autoRegisterDirectivesInMain(mainPath, directiveFiles)
  assertResult('注入两个 directive', r, x => x.modified && x.injected.length === 2, 'modified=true, injected=2')
  assertResult('main.js 包含 Waves import', r, x => x.content.includes("import Waves from './directive/waves'"), 'import Waves')
  assertResult('main.js 包含 Permission import', r, x => x.content.includes("import Permission from './directive/permission'"), 'import Permission')
  assertResult('main.js 包含 .use(Waves)', r, x => /\.use\(Waves\)/.test(x.content), '.use(Waves)')
  assertResult('main.js 包含 .use(Permission)', r, x => /\.use\(Permission\)/.test(x.content), '.use(Permission)')

  rmSync(root, { recursive: true, force: true })
}

// ============ F6: 已经 import 但没用 ============
console.log('\n[F6: 已 import 但缺 .use()]')

{
  const mainWithImport = `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'

const app = createApp(App)
app.mount('#app')
`
  const { root, mainPath, directiveFiles } = await setupFixture(mainWithImport, [
    { dirName: 'waves', name: 'waves' },
  ])

  const r = await autoRegisterDirectivesInMain(mainPath, directiveFiles)
  assertResult('已 import 时不重复 import', r, x => x.modified, 'modified=true')
  assertResult('注入 .use(Waves)', r, x => /\.use\(Waves\)/.test(x.content), '.use(Waves)')
  assertResult('import 只出现一次', r, x => (x.content.match(/import Waves from/g) || []).length === 1, '1 import')

  rmSync(root, { recursive: true, force: true })
}

// ============ F6: 已 import + 已 .use 不动 ============
console.log('\n[F6: 已 import + .use 不动]')

{
  const mainWithAll = `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'

const app = createApp(App)
app.use(Waves).mount('#app')
`
  const { root, mainPath, directiveFiles } = await setupFixture(mainWithAll, [
    { dirName: 'waves', name: 'waves' },
  ])

  const r = await autoRegisterDirectivesInMain(mainPath, directiveFiles)
  assertResult('已完整注册时不修改', r, x => !x.modified, 'modified=false')

  rmSync(root, { recursive: true, force: true })
}

// ============ F6: 嵌套目录名转 PascalCase ============
console.log('\n[F6: PascalCase]')

{
  const { root, mainPath, directiveFiles } = await setupFixture(SIMPLE_MAIN, [
    { dirName: 'el-drag-dialog', name: 'el-drag-dialog' },
  ])

  const r = await autoRegisterDirectivesInMain(mainPath, directiveFiles)
  assertResult('el-drag-dialog → ElDragDialog', r, x => x.content.includes('import ElDragDialog from'), 'ElDragDialog import')

  rmSync(root, { recursive: true, force: true })
}

// ============ F6: 没有 createApp chain ============
console.log('\n[F6: 单 .mount 形式]')

{
  const mainNoChain = `import { createApp } from 'vue'
import App from './App'
createApp(App).mount('#app')
`
  const { root, mainPath, directiveFiles } = await setupFixture(mainNoChain, [
    { dirName: 'clipboard', name: 'Clipboard' },
  ])

  const r = await autoRegisterDirectivesInMain(mainPath, directiveFiles)
  assertResult('无 chain 时注入 .use()', r, x => x.modified && /use\(Clipboard\)/.test(x.content), '注入 .use')

  rmSync(root, { recursive: true, force: true })
}

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
