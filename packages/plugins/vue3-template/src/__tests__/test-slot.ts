/**
 * 跑：npx tsx packages/plugins/vue3-template/src/__tests__/test-slot.ts
 */
import { rewriteSlots } from '../rules/slot-rewriting.js'

const cases: Array<{ name: string; input: string; expected: string }> = [
  {
    name: 'simple slot + slot-scope',
    input: `<div>
  <child-comp>
    <span slot="header">标题</span>
    <span slot-scope="props">{{ props.text }}</span>
  </child-comp>
</div>`,
    expected: `<div>
  <child-comp>
    <template #header>
      <span>标题</span>
    </template>
    <template #default="props">
      <span>{{ props.text }}</span>
    </template>
  </child-comp>
</div>`,
  },
  {
    name: 'slot + scope on same element',
    input: `<div>
  <my-list :items="items">
    <span slot="item" slot-scope="row">{{ row.id }}</span>
  </my-list>
</div>`,
    expected: `<div>
  <my-list :items="items">
    <template #item="row">
      <span>{{ row.id }}</span>
    </template>
  </my-list>
</div>`,
  },
  {
    name: 'self-closing slot',
    input: `<div>
  <my-icon>
    <i slot="prefix" />
  </my-icon>
</div>`,
    expected: `<div>
  <my-icon>
    <template #prefix>
      <i />
    </template>
  </my-icon>
</div>`,
  },
  {
    name: 'multi-line content',
    input: `<my-card>
  <div slot="header">
    <h1>Title</h1>
    <p>Subtitle</p>
  </div>
</my-card>`,
    expected: `<my-card>
  <template #header>
    <div>
      <h1>Title</h1>
      <p>Subtitle</p>
    </div>
  </template>
</my-card>`,
  },
  {
    name: '<template slot-scope=...> rewritten in place (NOT wrapped)',
    input: `<el-table-column type="expand">
  <template slot-scope="props">
    <el-form>
      <el-form-item label="A"><span>{{ props.row.name }}</span></el-form-item>
    </el-form>
  </template>
</el-table-column>`,
    expected: `<el-table-column type="expand">
  <template #default="props">
    <el-form>
      <el-form-item label="A"><span>{{ props.row.name }}</span></el-form-item>
    </el-form>
  </template>
</el-table-column>`,
  },
  {
    name: '<template slot="xxx" slot-scope=...> rewritten in place',
    input: `<my-list>
  <template slot="item" slot-scope="row">
    <span>{{ row.id }}</span>
  </template>
</my-list>`,
    expected: `<my-list>
  <template #item="row">
    <span>{{ row.id }}</span>
  </template>
</my-list>`,
  },
  {
    name: '<template slot="xxx"> rewritten in place (no scope)',
    input: `<my-comp>
  <template slot="header">
    <h1>Title</h1>
  </template>
</my-comp>`,
    expected: `<my-comp>
  <template #header>
    <h1>Title</h1>
  </template>
</my-comp>`,
  },
  {
    name: '<template v-for slot-scope=...> — keep v-for, rewrite slot-scope',
    input: `<my-list :items="items">
  <template v-for="(item, idx) in items" slot-scope="row">
    <span>{{ row.id }} - {{ item }}</span>
  </template>
</my-list>`,
    expected: `<my-list :items="items">
  <template v-for="(item, idx) in items" #default="row">
    <span>{{ row.id }} - {{ item }}</span>
  </template>
</my-list>`,
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  const result = rewriteSlots(c.input)
  const ok = result.out.trim() === c.expected.trim()
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
    console.log(result.out)
  }
}
console.log(`\n${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
