/**
 * vxe-table 插件单元测试
 *
 * 跑：& "packages\cli\node_modules\.bin\tsx.cmd" "packages\plugins\vxe-table\src\__tests__\test-vxe-table.ts"
 *
 * 覆盖：
 *   1. template.ts — <vxe-table-column> → <vxe-column>
 *   2. import-path.ts — CSS 路径 'vxe-table/lib/index.css' → 'vxe-table/lib/style.css'
 */
import { parse } from '@babel/parser'
import _generate from '@babel/generator'
import { renameVxeTableColumn } from '../rules/template.js'
import { collectVxeTableImports } from '../rules/import-path.js'
import type { TransformContext, FileNode, ProjectContext } from '@vue-migrate/core'

const generate = (_generate as any).default || _generate

// ────────────────────────────────────────────────────────────
// 1. template.ts: <vxe-table-column> → <vxe-column>
// ────────────────────────────────────────────────────────────

interface TemplateCase {
  name: string
  input: string
  expected: string
  shouldChange: boolean
}

const templateCases: TemplateCase[] = [
  {
    name: 'simple vxe-table-column → vxe-column',
    input: '<vxe-table-column field="name" title="Name"></vxe-table-column>',
    expected: '<vxe-column field="name" title="Name"></vxe-column>',
    shouldChange: true,
  },
  {
    name: 'self-closing vxe-table-column',
    input: '<vxe-table-column field="age" />',
    expected: '<vxe-column field="age" />',
    shouldChange: true,
  },
  {
    name: 'multiple matches in one template',
    input: `<vxe-table :data="rows">
  <vxe-table-column field="id" title="ID" />
  <vxe-table-column field="name" title="Name" />
  <vxe-table-column field="email" title="Email" />
</vxe-table>`,
    expected: `<vxe-table :data="rows">
  <vxe-column field="id" title="ID" />
  <vxe-column field="name" title="Name" />
  <vxe-column field="email" title="Email" />
</vxe-table>`,
    shouldChange: true,
  },
  {
    name: 'vxe-table (no -column) is untouched',
    input: '<vxe-table :data="rows"></vxe-table>',
    expected: '<vxe-table :data="rows"></vxe-table>',
    shouldChange: false,
  },
  {
    name: 'el-table-column (different lib) is untouched',
    input: '<el-table-column prop="name" label="Name"></el-table-column>',
    expected: '<el-table-column prop="name" label="Name"></el-table-column>',
    shouldChange: false,
  },
  {
    name: 'a-table-column (ant-design-vue) is untouched',
    input: '<a-table-column dataIndex="name" title="Name" />',
    expected: '<a-table-column dataIndex="name" title="Name" />',
    shouldChange: false,
  },
  {
    name: 'mixed: vxe-table-column and el-table-column',
    input: `<div>
  <vxe-table-column field="x" />
  <el-table-column prop="y" />
</div>`,
    expected: `<div>
  <vxe-column field="x" />
  <el-table-column prop="y" />
</div>`,
    shouldChange: true,
  },
  {
    name: 'empty template returns empty',
    input: '',
    expected: '',
    shouldChange: false,
  },
]

// ────────────────────────────────────────────────────────────
// 2. import-path.ts: CSS 路径
// ────────────────────────────────────────────────────────────

interface ImportCase {
  name: string
  /** 完整 script 源码 */
  script: string
  /** 期望的改写后源码（只对 CSS import 做对比；其他节点不变） */
  expected: string
  /** 期望 hasCss */
  expectHasCss: boolean
  /** 期望 hasMainImport */
  expectHasMain: boolean
}

function buildCtxFromScript(script: string): { ctx: TransformContext; file: FileNode } {
  const ast = parse(script, { sourceType: 'module', plugins: ['typescript'] })
  const file: FileNode = {
    path: 'test.ts',
    relativePath: 'test.ts',
    kind: 'ts',
    source: script,
    scriptAst: ast,
    transforms: [],
    sfc: undefined as any,
    useRawSource: false,
    metadata: {} as any,
    changed: false,
  }
  const project: ProjectContext = {
    root: '/tmp/test',
    samples: [],
    stats: { manualReviewRequired: 0, byFile: {} } as any,
    renames: new Map(),
  } as any
  const ctx: TransformContext = {
    file,
    project,
    utils: {
      markChanged(msg?: string) {
        ;(ctx as any).__changed = true
        ;(ctx as any).__lastMessage = msg || ''
      },
      manualReview(_reason: string) {},
      reparse() {},
    } as any,
    log: (_msg: string) => {},
  } as any
  ;(ctx as any).__changed = false
  ;(ctx as any).__lastMessage = ''
  return { ctx, file }
}

const importCases: ImportCase[] = [
  {
    name: "vxe-table/lib/index.css → vxe-table/lib/style.css",
    script: `import 'vxe-table/lib/index.css'`,
    expected: `import 'vxe-table/lib/style.css';`,
    expectHasCss: true,
    expectHasMain: false,
  },
  {
    name: "main 'vxe-table' import is NOT touched (同名包)",
    script: `import VXETable from 'vxe-table'\nVue.use(VXETable)`,
    expected: `import VXETable from 'vxe-table';\nVue.use(VXETable);`,
    expectHasCss: false,
    expectHasMain: true,
  },
  {
    name: 'main + css both present',
    script: `import VXETable from 'vxe-table'\nimport 'vxe-table/lib/index.css'\nVue.use(VXETable)`,
    expected: `import VXETable from 'vxe-table';\nimport 'vxe-table/lib/style.css';\nVue.use(VXETable);`,
    expectHasCss: true,
    expectHasMain: true,
  },
  {
    name: 'unrelated CSS is untouched',
    script: `import 'element-plus/lib/index.css'`,
    expected: `import 'element-plus/lib/index.css';`,
    expectHasCss: false,
    expectHasMain: false,
  },
  {
    name: 'no vxe-table imports at all',
    script: `import Foo from 'bar'\nconsole.log(Foo)`,
    expected: `import Foo from 'bar';\nconsole.log(Foo);`,
    expectHasCss: false,
    expectHasMain: false,
  },
]

// ────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────

let pass = 0
let fail = 0

function expect(name: string, cond: boolean, detail = ''): void {
  if (cond) {
    pass++
    console.log(`✅ ${name}`)
  } else {
    fail++
    console.log(`❌ ${name}`)
    if (detail) console.log(detail)
  }
}

console.log('─── 1. template.ts (renameVxeTableColumn) ───')
for (const c of templateCases) {
  const result = renameVxeTableColumn(c.input)
  expect(
    c.name,
    result.out.trim() === c.expected.trim() && result.changed === c.shouldChange,
    `expected changed=${c.shouldChange}, got changed=${result.changed}\n` +
      `  input    : ${c.input}\n` +
      `  expected : ${c.expected}\n` +
      `  got      : ${result.out}`,
  )
}

console.log('\n─── 2. import-path.ts (collectVxeTableImports) ───')
for (const c of importCases) {
  const { ctx, file } = buildCtxFromScript(c.script)
  const info = collectVxeTableImports(ctx)
  // 重新生成 code（因为我们 mutate 了 AST 的 source.value）
  const out = generate(file.scriptAst as any, { retainLines: false }).code
  // babel generator 输出双引号；test 期望写单引号 — 统一规范化后比较
  const norm = (s: string) => s.replace(/'/g, '"').replace(/\s+/g, ' ').trim()
  expect(
    c.name,
    norm(out) === norm(c.expected) &&
      info.hasCss === c.expectHasCss &&
      info.hasMainImport === c.expectHasMain,
    `expected hasCss=${c.expectHasCss}, hasMain=${c.expectHasMain}; got hasCss=${info.hasCss}, hasMain=${info.hasMainImport}\n` +
      `  expected : ${c.expected}\n` +
      `  got      : ${out}`,
  )
}

console.log(`\n${pass}/${pass + fail} 通过`)
console.log(`tests ${pass + fail} pass ${pass} fail ${fail}`)
process.exit(fail === 0 ? 0 : 1)
