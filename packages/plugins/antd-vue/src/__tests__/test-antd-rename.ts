/**
 * @vue-migrate/plugin-antd-vue unit tests
 * iter-121: ant-design-vue 1.x (Vue 2) → 2.x (Vue 3) migration
 *
 * 测：
 *   - 4 个 template rename/review 场景: a-form-model rename, v-decorator review, a-modal @click, a-tree-select :replaceFields
 *   - 4 个 script AST 场景: $form.createForm, validateFields callback, $confirm/$info
 *   - 2 个 negative case: 无 antd 痕迹, 已 v2 useForm import
 */

import { parse } from '@babel/parser'
import { scanAllElementsLite, hasDecorator, hasClickWithoutOkCancel, hasReplaceFields } from '../utils/template-scanner.js'
import { renameFormModel } from '../rules/form-model.js'
import { reviewVDecorator } from '../rules/v-decorator.js'
import { reviewModalEvents } from '../rules/modal-events.js'
import { migrateAntdScript } from '../rules/antd-script.js'

let pass = 0
let fail = 0
const failures: string[] = []

function assertTrue(name: string, cond: boolean): void {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(name)
    console.log(`  ✗ ${name}`)
  }
}

function assertContains(name: string, items: string[], substr: string): void {
  const found = items.some(i => i.includes(substr))
  if (found) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    failures.push(`${name} (expected to contain "${substr}", got: ${JSON.stringify(items)})`)
    console.log(`  ✗ ${name} (expected to contain "${substr}")`)
  }
}

// ============ 1. <a-form-model> → <a-form> auto-rename ============
console.log('\n[antd-vue: <a-form-model> rename]')

{
  const tpl = `
<a-form-model :form="form" @submit.prevent="handleSubmit">
  <a-form-model-item label="Username">
    <a-input v-model="username" />
  </a-form-model-item>
  <a-form-model-item>
    <a-button>Submit</a-button>
  </a-form-model-item>
</a-form-model>
`
  const elements = scanAllElementsLite(tpl)
  const r = renameFormModel(tpl, elements)
  assertTrue('ANTD-1: changed', r.changed === true)
  assertTrue('ANTD-1: count is 2 (a-form-model + 2 nested a-form-model-item items)', r.count === 3)
  assertTrue('ANTD-1: a-form-model → a-form', r.out.includes('<a-form '))
  assertTrue('ANTD-1: a-form-model-item → a-form-item', r.out.includes('<a-form-item '))
  assertTrue('ANTD-1: 闭标签 /a-form-model 改 /a-form', r.out.includes('</a-form>'))
  assertTrue('ANTD-1: 没有 a-form-model 残留', !r.out.includes('a-form-model'))
}

// ============ 2. 没有 a-form-model → no change ============
console.log('\n[antd-vue: no a-form-model]')

{
  const tpl = `<a-form><a-form-item>Hi</a-form-item></a-form>`
  const elements = scanAllElementsLite(tpl)
  const r = renameFormModel(tpl, elements)
  assertTrue('ANTD-2: not changed', r.changed === false)
  assertTrue('ANTD-2: count 0', r.count === 0)
  assertTrue('ANTD-2: source unchanged', r.out === tpl)
}

// ============ 3. v-decorator 指令 review ============
console.log('\n[antd-vue: v-decorator review]')

{
  const tpl = `
<a-form :form="form">
  <a-form-item label="Username">
    <a-input v-decorator="['username', { rules: [{ required: true }] }]" />
  </a-form-item>
  <a-form-item label="Email">
    <a-input v-decorator="['email', { rules: [{ type: 'email' }] }]" />
  </a-form-item>
</a-form>
`
  const elements = scanAllElementsLite(tpl)
  const vDecoratorReviews = reviewVDecorator(elements)
  assertTrue('ANTD-3: 2 v-decorator reviews', vDecoratorReviews.length === 2)
  assertContains('ANTD-3: review mentions v-decorator', vDecoratorReviews, 'v-decorator')
  assertContains('ANTD-3: review mentions useForm', vDecoratorReviews, 'useForm')
}

// ============ 4. <a-modal @click="..."> 拆分 review ============
console.log('\n[antd-vue: a-modal @click review]')

{
  // 4a: 只有 @click, 没有 @ok / @cancel → 报
  const tpl1 = `<a-modal v-model="visible" @click="onClick">content</a-modal>`
  const e1 = scanAllElementsLite(tpl1)
  const r1 = reviewModalEvents(e1)
  assertTrue('ANTD-4a: 1 review (click only)', r1.length === 1)
  assertContains('ANTD-4a: mentions @ok/@cancel', r1, '@ok')

  // 4b: 已经有 @ok 和 @cancel → 不报
  const tpl2 = `<a-modal v-model="visible" @ok="onOk" @cancel="onCancel">x</a-modal>`
  const e2 = scanAllElementsLite(tpl2)
  const r2 = reviewModalEvents(e2)
  assertTrue('ANTD-4b: no reviews (already split)', r2.length === 0)

  // 4c: 没有 @click → 不报
  const tpl3 = `<a-modal v-model="visible">x</a-modal>`
  const e3 = scanAllElementsLite(tpl3)
  const r3 = reviewModalEvents(e3)
  assertTrue('ANTD-4c: no reviews (no @click)', r3.length === 0)
}

// ============ 5. <a-tree-select :replaceFields="..."> review ============
console.log('\n[antd-vue: a-tree-select :replaceFields review]')

{
  const tpl = `<a-tree-select :tree-data="treeData" :replace-fields="{ label: 'name' }" />`
  const elements = scanAllElementsLite(tpl)
  const el = elements[0]
  assertTrue('ANTD-5: detects :replace-fields (kebab-case)', hasReplaceFields(el))
}

// ============ 6. this.$form.createForm(this) script review ============
console.log('\n[antd-vue: this.$form.createForm review]')

{
  const src = `
import { Form } from 'ant-design-vue'
export default {
  data() {
    return {
      form: this.$form.createForm(this)
    }
  }
}
`
  const ast = parse(src, { sourceType: 'module' })
  const r = migrateAntdScript(ast)
  assertTrue('ANTD-6: detects 1 review', r.reviewItems.length === 1)
  assertContains('ANTD-6: review mentions createForm', r.reviewItems, 'createForm')
  assertContains('ANTD-6: review mentions useForm', r.reviewItems, 'useForm')
}

// ============ 7. form.validateFields((err, values) => ...) callback review ============
console.log('\n[antd-vue: form.validateFields callback review]')

{
  const src = `
import { Form } from 'ant-design-vue'
export default {
  methods: {
    submit() {
      this.form.validateFields((err, values) => {
        if (err) return
        console.log(values)
      })
    }
  }
}
`
  const ast = parse(src, { sourceType: 'module' })
  const r = migrateAntdScript(ast)
  assertTrue('ANTD-7: detects 1 review', r.reviewItems.length === 1)
  assertContains('ANTD-7: review mentions await', r.reviewItems, 'await')
}

// ============ 8. form.validateFields() (无 callback, await 风格) — 不报 ============
console.log('\n[antd-vue: form.validateFields await style]')

{
  const src = `
import { Form } from 'ant-design-vue'
export default {
  methods: {
    async submit() {
      try {
        const values = await this.form.validateFields()
        console.log(values)
      } catch (err) {
        // v2 already
      }
    }
  }
}
`
  const ast = parse(src, { sourceType: 'module' })
  const r = migrateAntdScript(ast)
  assertTrue('ANTD-8: no reviews (await style)', r.reviewItems.length === 0)
}

// ============ 9. this.$confirm / $info / $success / $error / $warning / $modal ============
console.log('\n[antd-vue: this.$confirm/$info etc. review]')

{
  const src = `
import { message } from 'ant-design-vue'
export default {
  methods: {
    onConfirm() {
      this.$confirm({ title: 'ok?', onOk: () => {} })
    },
    onInfo() {
      this.$info({ title: 'info' })
    },
    onSuccess() {
      this.$success({ title: 'success' })
    },
    onError() {
      this.$error({ title: 'error' })
    }
  }
}
`
  const ast = parse(src, { sourceType: 'module' })
  const r = migrateAntdScript(ast)
  assertTrue('ANTD-9: detects 4 reviews', r.reviewItems.length === 4)
  assertContains('ANTD-9: $confirm', r.reviewItems, '$confirm')
  assertContains('ANTD-9: $info', r.reviewItems, '$info')
  assertContains('ANTD-9: $success', r.reviewItems, '$success')
  assertContains('ANTD-9: $error', r.reviewItems, '$error')
}

// ============ 10. 没有 ant-design-vue import → 不动 ============
console.log('\n[antd-vue: no antd import = no-op]')

{
  const src = `
export default {
  methods: {
    onClick() { this.$confirm() }
  }
}
`
  const ast = parse(src, { sourceType: 'module' })
  const r = migrateAntdScript(ast)
  assertTrue('ANTD-10: no reviews (no antd import)', r.reviewItems.length === 0)
  assertTrue('ANTD-10: hasAntdImport=false', r.hasAntdImport === false)
}

// ============ Summary ============
console.log(`\ntests ${pass + fail} pass ${pass} fail ${fail}`)
if (fail > 0) {
  console.log('\nFailures:')
  for (const f of failures) console.log(`  - ${f.split('\n')[0]}`)
  process.exit(1)
}
