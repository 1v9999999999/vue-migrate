/**
 * 快速 sanity check —— 直接用 tsx 跑
 *   pnpm exec tsx packages/plugins/vue3-template/src/__tests__/test-scanner.ts
 */
import {
  parseAttrs,
  scanAllElements,
  scanTopLevelElements,
  findAttr,
  findDirective,
} from '../utils/template-scanner.js'

const cases: Array<{ name: string; template: string }> = [
  {
    name: 'simple slot attr',
    template: `<div>
  <child-comp>
    <span slot="header">标题</span>
    <span slot-scope="props">{{ props.text }}</span>
  </child-comp>
</div>`,
  },
  {
    name: 'self-closing',
    template: `<div>
  <my-comp>
    <i slot="icon" />
    <span slot-scope="row">{{ row.name }}</span>
  </my-comp>
</div>`,
  },
  {
    name: 'nested',
    template: `<table>
  <tr slot="row" v-for="item in items">
    <td slot="cell">{{ item.name }}</td>
  </tr>
</table>`,
  },
  {
    name: 'v-bind.sync',
    template: `<my-dialog v-bind.sync="dialog" :foo="bar" />`,
  },
  {
    name: 'v-bind.sync with event and chain',
    template: `<el-input v-bind.sync="form" @input="onInput" />`,
  },
  {
    name: 'inline-template',
    template: `<div>
  <child-comp inline-template>
    <p>{{ msg }}</p>
  </child-comp>
</div>`,
  },
  {
    name: 'comments',
    template: `<div>
  <!-- 这是注释 -->
  <span slot="header">x</span>
</div>`,
  },
]

for (const { name, template } of cases) {
  console.log(`\n=== ${name} ===`)
  console.log(template)
  const elements = scanAllElements(template)
  console.log(`  找到 ${elements.length} 个元素`)
  for (const el of elements) {
    const slot = findAttr(el, 'slot')
    const scope = findAttr(el, 'slot-scope')
    const inline = findAttr(el, 'inline-template')
    const sync = findDirective(el, 'bind', 'sync')
    if (slot || scope || inline || sync) {
      console.log(
        `    <${el.tagName}> slot=${slot?.value} scope=${scope?.value} inline=${!!inline} sync=${sync?.value}`,
      )
    }
  }
}
