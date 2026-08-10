/**
 * @vue-migrate/plugin-vue3-directives unit tests
 * iter-045a: vnode.context / vnode.componentInstance / vnode.child.$emit → binding.instance
 *
 * 测核心场景：
 *   1. vnode.context → binding.instance
 *   2. vnode.componentInstance → binding.instance
 *   3. vnode.child.$emit → binding.instance.$emit
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'

const _genObj: any = (_generate as any)
const _gen = _genObj.default || _genObj
const generate = (ast: any, opts?: any): string => _gen(ast, opts).code

import { applyDirectiveVnodeBindingRewrite } from '../rules/directive-vnode-binding.js'

let pass = 0
let fail = 0
const failures: string[] = []

function createContext(input: string) {
  const ast = parse(input, { sourceType: 'module', allowReturnOutsideFunction: true })
  return {
    scriptAst: ast,
    source: input,
    changed: false,
    reviewItems: [],
    marks: [],
  }
}

function makeUtils(ctx: any) {
  return {
    markChanged: (msg?: string) => { ctx.changed = true; if (msg) ctx.marks.push(msg) },
    manualReview: (msg: string) => { ctx.reviewItems.push(msg) },
  }
}

function assertTransform(name: string, input: string, expected: string): void {
  const ctx = createContext(input)
  applyDirectiveVnodeBindingRewrite(ctx as any, makeUtils(ctx))
  const out = generate(ctx.scriptAst, { comments: true })
  if (out.trim() === expected.trim()) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     expected: ${JSON.stringify(expected)}`)
  }
}

function assertNoChange(name: string, input: string): void {
  const ctx = createContext(input)
  applyDirectiveVnodeBindingRewrite(ctx as any, makeUtils(ctx))
  const out = generate(ctx.scriptAst, { comments: true })
  if (!ctx.changed) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (changed unexpectedly)`)
    console.log(`  ✗ ${name} (changed unexpectedly)`)
  }
}

// ============ 1) vnode.context → binding.instance ============
console.log('\n[vnode.context]')

assertTransform(
  'beforeMount(el, binding, vnode) { vnode.context.foo() }',
  `const dir = {
  beforeMount(el, binding, vnode) {
    vnode.context.foo();
  }
};`,
  `const dir = {
  beforeMount(el, binding, vnode) {
    binding.instance.foo();
  }
};`,
)

assertTransform(
  'vnode.context.$emit("foo")',
  `const dir = {
  mounted(el, binding, vnode) {
    vnode.context.$emit('foo', 1);
  }
};`,
  `const dir = {
  mounted(el, binding, vnode) {
    binding.instance.$emit('foo', 1);
  }
};`,
)

// ============ 2) vnode.componentInstance → binding.instance ============
console.log('\n[vnode.componentInstance]')

assertTransform(
  'beforeMount 中 vnode.componentInstance.foo()',
  `const dir = {
  beforeMount(el, binding, vnode) {
    const x = vnode.componentInstance.foo();
  }
};`,
  `const dir = {
  beforeMount(el, binding, vnode) {
    const x = binding.instance.foo();
  }
};`,
)

// ============ 3) vnode.child.$emit → binding.instance.$emit ============
console.log('\n[vnode.child.$emit]')

assertTransform(
  'inserted 中 vnode.child.$emit("foo")',
  `const dir = {
  inserted(el, binding, vnode) {
    vnode.child.$emit('foo', 1);
  }
};`,
  `const dir = {
  inserted(el, binding, vnode) {
    binding.instance.$emit('foo', 1);
  }
};`,
)

// ============ 4) 不在 directive hook 里 → 不动 ============
console.log('\n[non-directive code]')

assertNoChange(
  '普通 method 用 vnode.context',
  `function foo(vnode) {
  return vnode.context.bar;
}`,
)

// ============ 5) 没有 vnode 参数 → 不动 ============
console.log('\n[no vnode param]')

assertNoChange(
  'method 只有 2 个参数',
  `const dir = {
  beforeMount(el, binding) {
    binding.foo();
  }
};`,
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
