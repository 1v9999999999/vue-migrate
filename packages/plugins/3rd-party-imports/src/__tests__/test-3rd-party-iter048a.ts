/**
 * iter-048a F3 + F4 单测:
 *  - F3: vuedraggable v2 → v4 (default → named { draggable })
 *  - F4: CJS 库 xlsx/jszip (default → namespace), file-saver (default → named { saveAs })
 */
import { parse } from '@babel/parser'
import _generate from '@babel/generator'

const _genObj: any = (_generate as any)
const _gen = _genObj.default || _genObj
const generate = (ast: any, opts?: any): string => _gen(ast, opts).code

import { fixVuedraggableImports } from '../rules/vuedraggable.js'
import {
  fixCjsDefaultToNamed,
  type CjsDefaultToNamedRule,
} from '../rules/import-cjs-default-to-named.js'

let pass = 0
let fail = 0
const failures: string[] = []

interface TestContext {
  scriptAst: any
  source: string
  changed: boolean
  reviewItems: string[]
  marks: string[]
}

function createContext(input: string): TestContext {
  const ast = parse(input, { sourceType: 'module', allowReturnOutsideFunction: true })
  return {
    scriptAst: ast,
    source: input,
    changed: false,
    reviewItems: [],
    marks: [],
  }
}

function makeUtils(ctx: TestContext) {
  return {
    markChanged: (msg?: string) => { ctx.changed = true; if (msg) ctx.marks.push(msg) },
    manualReview: (msg: string) => { ctx.reviewItems.push(msg) },
  }
}

function runVuedraggable(input: string): string {
  const ctx = createContext(input)
  // 模拟 ctx.file.scriptAst + ctx.utils
  const fakeCtx: any = {
    file: { scriptAst: ctx.scriptAst },
    utils: makeUtils(ctx),
  }
  fixVuedraggableImports(fakeCtx)
  return generate(ctx.scriptAst, { comments: true })
}

function runCjs(input: string, rules: CjsDefaultToNamedRule[]): string {
  const ctx = createContext(input)
  const fakeCtx: any = {
    file: { scriptAst: ctx.scriptAst },
    utils: makeUtils(ctx),
  }
  fixCjsDefaultToNamed(fakeCtx, rules)
  return generate(ctx.scriptAst, { comments: true })
}

function assertTransform(
  runner: (input: string) => string,
  name: string,
  input: string,
  expected: string,
): void {
  const out = runner(input).trim()
  const exp = expected.trim()
  if (out === exp) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected: ${JSON.stringify(exp)}`)
    console.log(`  ✗ ${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected: ${JSON.stringify(exp)}`)
  }
}

const cjsRules: CjsDefaultToNamedRule[] = [
  { name: 'xlsx', type: 'namespace', reason: 'xlsx CJS' },
  { name: 'jszip', type: 'namespace', reason: 'jszip CJS' },
  { name: 'file-saver', type: 'named', namedImports: { default: 'saveAs' }, reason: 'file-saver' },
]

// ============ F3: vuedraggable ============
console.log('\n[F3: vuedraggable v2 → v4]')

assertTransform(
  runVuedraggable,
  'default draggable → named { draggable }',
  `import draggable from 'vuedraggable';`,
  `import { draggable } from 'vuedraggable';`,
)

assertTransform(
  runVuedraggable,
  '已 named 不动',
  `import { draggable } from 'vuedraggable';`,
  `import { draggable } from 'vuedraggable';`,
)

assertTransform(
  runVuedraggable,
  'namespace 不动',
  `import * as draggable from 'vuedraggable';`,
  `import * as draggable from 'vuedraggable';`,
)

assertTransform(
  runVuedraggable,
  'sub-path 不动',
  `import draggable from 'vuedraggable/lib/sortable';`,
  `import draggable from 'vuedraggable/lib/sortable';`,
)

// ============ F4: xlsx / jszip / file-saver ============
console.log('\n[F4: CJS default → namespace/named]')

assertTransform(
  (i) => runCjs(i, cjsRules),
  'xlsx default → namespace',
  `import XLSX from 'xlsx';`,
  `import * as XLSX from 'xlsx';`,
)

assertTransform(
  (i) => runCjs(i, cjsRules),
  'jszip default → namespace',
  `import JSZip from 'jszip';`,
  `import * as JSZip from 'jszip';`,
)

assertTransform(
  (i) => runCjs(i, cjsRules),
  'file-saver default → named { saveAs }',
  `import { saveAs } from 'file-saver';`,
  `import { saveAs } from 'file-saver';`,  // already named, no change
)

assertTransform(
  (i) => runCjs(i, cjsRules),
  'file-saver localName 同名 → 直接 named',
  `import saveAs from 'file-saver';`,
  `import { saveAs } from 'file-saver';`,
)

assertTransform(
  (i) => runCjs(i, cjsRules),
  'file-saver X default → named { saveAs as X }',
  `import X from 'file-saver';`,
  `import { saveAs as X } from 'file-saver';`,
)

assertTransform(
  (i) => runCjs(i, cjsRules),
  '未知 pkg 不动',
  `import Foo from 'unknown-pkg';`,
  `import Foo from 'unknown-pkg';`,
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
