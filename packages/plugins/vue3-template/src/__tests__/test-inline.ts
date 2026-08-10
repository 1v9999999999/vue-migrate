import { removeInlineTemplate } from '../rules/inline-template.js'

const cases: Array<{ name: string; input: string; expected: string }> = [
  {
    name: 'inline-template only',
    input: `<div>
  <child-comp inline-template>
    <p>{{ msg }}</p>
  </child-comp>
</div>`,
    expected: `<div>
  <child-comp>
    <p>{{ msg }}</p>
  </child-comp>
</div>`,
  },
  {
    name: 'inline-template with other attrs',
    input: `<div>
  <child-comp inline-template class="x" />
</div>`,
    expected: `<div>
  <child-comp class="x" />
</div>`,
  },
]

let pass = 0
let fail = 0
for (const c of cases) {
  const r = removeInlineTemplate(c.input)
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
  }
}
console.log(`\n${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
