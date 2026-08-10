import { rewriteVbindSync } from '../rules/vbind-sync.js'

const cases: Array<{ name: string; input: string; expected: string }> = [
  {
    name: 'simple identifier',
    input: `<my-dialog v-bind.sync="dialog" />`,
    expected: `<my-dialog v-model:dialog="dialog" />`,
  },
  {
    name: 'object literal',
    input: `<el-input v-bind.sync="{ value, label }" />`,
    expected: `<el-input v-model:value="value" v-model:label="label" />`,
  },
  {
    name: 'mixed with other attrs',
    input: `<el-input v-bind.sync="form" @input="onInput" placeholder="x" />`,
    expected: `<el-input v-model:form="form" @input="onInput" placeholder="x" />`,
  },
  {
    name: 'complex expression',
    input: `<el-input v-bind.sync="form.data" />`,
    expected: `<el-input v-bind.sync="form.data" />`, // unchanged (review only)
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  const r = rewriteVbindSync(c.input)
  const ok = r.out.trim() === c.expected.trim()
  if (ok) {
    pass++
    console.log(`✅ ${c.name}`)
  } else {
    fail++
    console.log(`❌ ${c.name}`)
    console.log('--- input ---')
    console.log(c.input)
    console.log('--- expected ---')
    console.log(c.expected)
    console.log('--- got ---')
    console.log(r.out)
    console.log('--- reviewItems ---')
    console.log(r.reviewItems)
  }
}
console.log(`\n${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
