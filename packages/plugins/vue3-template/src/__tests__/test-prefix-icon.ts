/**
 * @vue-migrate/plugin-vue3-template unit tests
 * iter-045a: prefix-icon="el-icon-xxx" → <template #prefix><el-icon><Xxx /></el-icon></template>
 */

import { convertPrefixIconToSlot } from '../rules/prefix-icon-to-slot.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertTransform(name: string, input: string, expected: string, expectedIcons?: string[]): void {
  const result = convertPrefixIconToSlot(input)
  if (result.out === expected) {
    if (expectedIcons) {
      const gotIcons = Array.from(result.iconImports).sort()
      const wantIcons = [...expectedIcons].sort()
      if (JSON.stringify(gotIcons) !== JSON.stringify(wantIcons)) {
        fail++
        failures.push(`${name} (iconImports mismatch: got ${JSON.stringify(gotIcons)}, want ${JSON.stringify(wantIcons)})`)
        console.log(`  ✗ ${name} (iconImports mismatch)`)
        return
      }
    }
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(result.out)}\n     expected: ${JSON.stringify(expected)}`)
    console.log(`  ✗ ${name}\n     input:    ${JSON.stringify(input)}\n     actual:   ${JSON.stringify(result.out)}\n     expected: ${JSON.stringify(expected)}`)
  }
}

function assertNoChange(name: string, input: string): void {
  const result = convertPrefixIconToSlot(input)
  if (!result.changed) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (changed unexpectedly):\n  actual: ${JSON.stringify(result.out)}`)
    console.log(`  ✗ ${name} (changed unexpectedly)`)
  }
}

// ============ self-closing el-input ============
console.log('\n[el-input self-closing]')

assertTransform(
  'el-input self-closing + prefix-icon="el-icon-document"',
  `<div>
  <el-input v-model="filename" prefix-icon="el-icon-document" placeholder="Enter" />
</div>`,
  `<div>
  <el-input v-model="filename" placeholder="Enter" >
    <template #prefix>
      <el-icon><Document /></el-icon>
    </template>
  </el-input>
</div>`,
  ['Document'],
)

assertTransform(
  'el-input self-closing + prefix-icon="el-icon-search"',
  `<el-input v-model="q" prefix-icon="el-icon-search" />`,
  `<el-input v-model="q" >
  <template #prefix>
    <el-icon><Search /></el-icon>
  </template>
</el-input>`,
  ['Search'],
)

// ============ el-input with children ============
console.log('\n[el-input with children]')

assertTransform(
  'el-input 有 children 时也转 prefix-icon',
  `<el-input v-model="q" prefix-icon="el-icon-search">
  <template #append>
    <el-button>Go</el-button>
  </template>
</el-input>`,
  `<el-input v-model="q">
  <template #prefix>
    <el-icon><Search /></el-icon>
  </template>
  <template #append>
    <el-button>Go</el-button>
  </template>
</el-input>`,
  ['Search'],
)

// ============ 其他 el- 组件 ============
console.log('\n[other el- components]')

assertTransform(
  'el-select + prefix-icon',
  `<el-select v-model="v" prefix-icon="el-icon-arrow-down" />`,
  `<el-select v-model="v" >
  <template #prefix>
    <el-icon><ArrowDown /></el-icon>
  </template>
</el-select>`,
  ['ArrowDown'],
)

// ============ 不支持的标签 ============
console.log('\n[unsupported tags]')

assertNoChange(
  'el-button（不支持）',
  `<el-button prefix-icon="el-icon-search">Go</el-button>`,
)

// ============ 没有 prefix-icon ============
console.log('\n[no prefix-icon]')

assertNoChange(
  'el-input 没有 prefix-icon',
  `<el-input v-model="q" />`,
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
