/**
 * @vue-migrate/plugin-vue3-directives unit tests
 * iter-045a: install(Vue) → install(app) rewrite + window.Vue guard cleanup
 *
 * 测 5 类核心场景：
 *   1. const install = function(Vue) { Vue.directive(...) }
 *   2. xxx.install = Vue => { Vue.directive(...) }
 *   3. if (window.Vue) { Vue.use(install) } 守卫删除
 *   4. if (window.Vue) { window.xxx = xxx; Vue.use(install) } 守卫+mutation 删除
 *   5. 顶层独立的 Vue.use(install) 调用删除
 */

import { parse } from '@babel/parser'
import _generate from '@babel/generator'

// ESM-safe generator wrapper
const _genObj: any = (_generate as any)
const _gen = _genObj.default || _genObj
const generate = (ast: any, opts?: any): string => _gen(ast, opts).code

import { applyDirectiveInstallRewrite } from '../rules/directive-install-rewrite.js'

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

function assertTransform(name: string, input: string, expected: string): void {
  const ctx = createContext(input)
  applyDirectiveInstallRewrite(ctx as any, makeUtils(ctx))
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

function assertReview(name: string, input: string, expectedReviewSubstring: string): void {
  const ctx = createContext(input)
  applyDirectiveInstallRewrite(ctx as any, makeUtils(ctx))
  const out = generate(ctx.scriptAst, { comments: true })
  if (ctx.changed && ctx.reviewItems.some(r => r.includes(expectedReviewSubstring))) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(out)}\n     reviewItems: ${JSON.stringify(ctx.reviewItems)}`)
    console.log(`  ✗ ${name}\n     expected review containing: ${expectedReviewSubstring}`)
  }
}

function assertNoChange(name: string, input: string): void {
  const ctx = createContext(input)
  applyDirectiveInstallRewrite(ctx as any, makeUtils(ctx))
  const out = generate(ctx.scriptAst, { comments: true })
  if (!ctx.changed) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (changed unexpectedly)\n     input:  ${JSON.stringify(input)}\n     actual: ${JSON.stringify(out)}`)
    console.log(`  ✗ ${name} (changed unexpectedly)`)
  }
}

// ============ 1) const install = function(Vue) { ... } ============
console.log('\n[const install = function(Vue)]')

assertTransform(
  'const install = function(Vue) { Vue.directive("foo", def) }',
  `const install = function(Vue) {
  Vue.directive('foo', def);
};
export default install;`,
  `const install = function (app) {
  app.directive('foo', def);
};
export default install;`,
)

assertTransform(
  'const install = Vue => { Vue.directive("foo", def) }',
  `const install = Vue => {
  Vue.directive('foo', def);
};
export default install;`,
  `const install = app => {
  app.directive('foo', def);
};
export default install;`,
)

assertTransform(
  '混合 Vue.directive + Vue.component',
  `const install = function(Vue) {
  Vue.directive('foo', fooDef);
  Vue.component('Bar', BarComp);
};`,
  `const install = function (app) {
  app.directive('foo', fooDef);
  app.component('Bar', BarComp);
};`,
)

// ============ 2) xxx.install = Vue => { ... } ============
console.log('\n[xxx.install = Vue => {...}]')

assertTransform(
  'sticky.install = Vue => { Vue.directive("sticky", { mounted: ... }) }',
  `const vueSticky = {};
let listenAction;
vueSticky.install = Vue => {
  Vue.directive('sticky', {
    mounted(el, binding) { foo(); }
  });
};`,
  `const vueSticky = {};
let listenAction;
vueSticky.install = app => {
  app.directive('sticky', {
    mounted(el, binding) {
      foo();
    }
  });
};`,
)

// ============ 3) if (window.Vue) { Vue.use(install) } ============
console.log('\n[window.Vue guard]')

assertTransform(
  'if (window.Vue) { Vue.use(install) } 整段删',
  `const install = function(Vue) { Vue.directive('foo', def); };
if (window.Vue) {
  Vue.use(install);
}
export default { install };`,
  `const install = function (app) {
  app.directive('foo', def);
};
export default {
  install
};`,
)

assertTransform(
  'if (window.Vue) { window.clipboard = Clipboard; Vue.use(install) } 整段删+review',
  `import Clipboard from './clipboard';
const install = function(Vue) { Vue.directive('clipboard', Clipboard); };
if (window.Vue) {
  window.clipboard = Clipboard;
  Vue.use(install);
}
Clipboard.install = install;
export default Clipboard;`,
  `import Clipboard from './clipboard';
const install = function (app) {
  app.directive('clipboard', Clipboard);
};
Clipboard.install = install;
export default Clipboard;`,
)

// ============ 4) 顶层独立的 Vue.use(install) ============
console.log('\n[standalone Vue.use]')

assertTransform(
  '顶层 Vue.use(install) 删（已有 export default install）',
  `const install = function(Vue) { Vue.directive('foo', def); };
Vue.use(install);
export default { install };`,
  `const install = function (app) {
  app.directive('foo', def);
};
export default {
  install
};`,
)

// ============ 5) 无 Vue 引用 → 不动 ============
console.log('\n[non-Vue code]')

assertNoChange(
  '普通 install 函数（无 Vue 引用）',
  `const install = function(options) {
  console.log('init', options);
};`,
)

assertNoChange(
  '没有 window.Vue 守卫',
  `if (window.foo) {
  bar();
}`,
)

assertNoChange(
  '没有 install 也没有 window.Vue',
  `const x = 1;
const y = 2;`,
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
