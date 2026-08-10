/**
 * iter-048a F6 单测: directive-auto-register-plugin
 *  测 priority 5 + main.js AST 注入
 */
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'

const _traverseObj: any = (_traverse as any)
const traverse = (_traverseObj.default || _traverseObj) as typeof _traverse
const _generateObj: any = (_generate as any)
const _gen = _generateObj.default || _generateObj
const generate = (ast: any, opts?: any): string => _gen(ast, opts).code

import { injectDirectivesIntoMainAst, collectDirectivesFromProject } from '../directive-auto-register-plugin-helpers.js'

let pass = 0
let fail = 0
const failures: string[] = []

function runInject(
  mainSrc: string,
  directives: Array<{ name: string; dirName: string; importPath: string }>,
): { out: string; injected: number } {
  const ast = parse(mainSrc, { sourceType: 'module', allowReturnOutsideFunction: true })
  // Build a fake file + project
  const file: any = {
    scriptAst: ast,
    source: mainSrc,
    path: 'src/main.js',
    relativePath: 'src/main.js',
    metadata: {},
    transforms: [],
    changed: false,
    kind: 'js',
  }
  const project: any = {
    files: new Map([
      ['src/main.js', file],
    ]),
  }
  // add directive files to project
  for (const d of directives) {
    project.files.set(`src/directive/${d.dirName}/index.js`, {
      scriptAst: null,
      source: `const install = function (app) { app.directive('${d.name}', {}) }; export default { install }`,
      path: `src/directive/${d.dirName}/index.js`,
      relativePath: `src/directive/${d.dirName}/index.js`,
      metadata: {},
      transforms: [],
      changed: false,
      kind: 'js',
    })
  }
  const injected = injectDirectivesIntoMainAst(file, directives, project)
  return { out: generate(ast, { comments: true }), injected }
}

function assertInjected(name: string, mainSrc: string, directives: Array<{ name: string; dirName: string; importPath: string }>, expected: string, expectedCount: number): void {
  const r = runInject(mainSrc, directives)
  // normalize: strip trailing semicolons, normalize quotes, collapse whitespace
  const norm = (s: string) => s
    .replace(/;\s*$/gm, '')
    .replace(/"/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (norm(r.out) === norm(expected) && r.injected === expectedCount) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(mainSrc)}\n     actual:   ${JSON.stringify(r.out)}\n     expected: ${JSON.stringify(expected)}\n     count:    actual=${r.injected} expected=${expectedCount}`)
    console.log(`  ✗ ${name}\n     got: ${JSON.stringify(r.out)}`)
  }
}

// ============ F6: 在 createApp chain 注入 .use() ============
console.log('\n[F6: directive auto-register AST inject]')

assertInjected(
  'Sticky 注入 import + .use(Sticky) 到 createApp chain',
  `import { createApp } from 'vue'
import App from './App'
createApp(App).use(router).mount('#app')`,
  [{ name: 'sticky', dirName: 'sticky', importPath: './directive/sticky' }],
  `import { createApp } from 'vue'
import App from './App'
import Sticky from './directive/sticky'
createApp(App).use(router).use(Sticky).mount('#app')`,
  2, // 1 import + 1 .use
)

assertInjected(
  '5 个 directive 全部注入',
  `import { createApp } from 'vue'
import App from './App'
createApp(App).use(router).use(store).mount('#app')`,
  [
    { name: 'waves', dirName: 'waves', importPath: './directive/waves' },
    { name: 'permission', dirName: 'permission', importPath: './directive/permission' },
    { name: 'clipboard', dirName: 'clipboard', importPath: './directive/clipboard' },
    { name: 'el-drag-dialog', dirName: 'el-drag-dialog', importPath: './directive/el-drag-dialog' },
    { name: 'el-height-adaptive-table', dirName: 'el-table', importPath: './directive/el-table' },
  ],
  `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'
import Permission from './directive/permission'
import Clipboard from './directive/clipboard'
import ElDragDialog from './directive/el-drag-dialog'
import ElTable from './directive/el-table'
createApp(App).use(router).use(store).use(Waves).use(Permission).use(Clipboard).use(ElDragDialog).use(ElTable).mount('#app')`,
  10, // 5 import + 5 .use
)

assertInjected(
  '已 import 不重复 import',
  `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'
createApp(App).use(router).use(Waves).mount('#app')`,
  [{ name: 'waves', dirName: 'waves', importPath: './directive/waves' }],
  `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'
createApp(App).use(router).use(Waves).mount('#app')`,
  0, // 没新加 (import 和 .use 都已存在)
)

assertInjected(
  '缺 .use() 时只加 .use()',
  `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'
createApp(App).use(router).mount('#app')`,
  [{ name: 'waves', dirName: 'waves', importPath: './directive/waves' }],
  `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'
createApp(App).use(router).use(Waves).mount('#app')`,
  1, // 只加 .use
)

assertInjected(
  '无 .mount 时不注入 .use() (没 mount 链)',
  `import { createApp } from 'vue'
import App from './App'
createApp(App)`,
  [{ name: 'waves', dirName: 'waves', importPath: './directive/waves' }],
  `import { createApp } from 'vue'
import App from './App'
import Waves from './directive/waves'
createApp(App)`,
  1, // import 加了 1 个, .use() 没加
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
