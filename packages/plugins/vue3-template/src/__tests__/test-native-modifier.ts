/**
 * @vue-migrate/plugin-vue3-template unit tests
 * iter-045a: .native modifier removal
 */

import { removeNativeModifier } from '../rules/native-modifier.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertTransform(name: string, input: string, expected: string): void {
  const result = removeNativeModifier(input)
  if (result.out === expected) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(result.out)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(result.out)}\n     expected: ${JSON.stringify(expected)}`)
  }
}

function assertNoChange(name: string, input: string): void {
  const result = removeNativeModifier(input)
  if (!result.changed) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (changed unexpectedly)`)
    console.log(`  ✗ ${name} (changed unexpectedly)`)
  }
}

// ============ @event.native → @event ============
console.log('\n[@event.native → @event]')

assertTransform(
  '@click.native → @click',
  `<el-button @click.native="submit">Go</el-button>`,
  `<el-button @click="submit">Go</el-button>`,
)

assertTransform(
  '@keyup.native → @keyup',
  `<el-input @keyup.native="check" />`,
  `<el-input @keyup="check" />`,
)

// ============ @event.enter.native → @event.enter ============
console.log('\n[@event.enter.native → @event.enter]')

assertTransform(
  '@keyup.enter.native → @keyup.enter',
  `<el-input @keyup.enter.native="submit" />`,
  `<el-input @keyup.enter="submit" />`,
)

// ============ @event.native.modifier → @event.modifier ============
console.log('\n[@event.native.modifier → @event.modifier]')

assertTransform(
  '@click.native.prevent → @click.prevent',
  `<el-button @click.native.prevent="submit">Go</el-button>`,
  `<el-button @click.prevent="submit">Go</el-button>`,
)

assertTransform(
  '@keyup.native.stop → @keyup.stop',
  `<el-input @keyup.native.stop="foo" />`,
  `<el-input @keyup.stop="foo" />`,
)

// ============ v-on:event.native → v-on:event ============
console.log('\n[v-on:event.native → v-on:event]')

assertTransform(
  'v-on:click.native → v-on:click',
  `<el-button v-on:click.native="submit">Go</el-button>`,
  `<el-button v-on:click="submit">Go</el-button>`,
)

// ============ 多个一起 ============
console.log('\n[multiple together]')

assertTransform(
  '一个元素上多个 .native',
  `<el-button
  @keyup.native="checkCapslock"
  @keyup.enter.native="handleLogin"
  @click.native.prevent="submit"
  @blur="onBlur"
/>`,
  `<el-button
  @keyup="checkCapslock"
  @keyup.enter="handleLogin"
  @click.prevent="submit"
  @blur="onBlur"
/>`,
)

// ============ 没有 .native → 不动 ============
console.log('\n[no .native]')

assertNoChange(
  '没有 .native 的元素',
  `<el-button @click="submit">Go</el-button>`,
)

assertNoChange(
  '空模板',
  ``,
)

// ============ 总结 ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
