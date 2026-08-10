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
  {
    name: 'P1-2: slot + other attrs on same element (slot must be stripped)',
    input: `<el-dialog title="x" v-model="v">
  <div slot="footer" class="dialog-footer">
    <el-button>取 消</el-button>
    <el-button type="primary">确 定</el-button>
  </div>
</el-dialog>`,
    expected: `<el-dialog title="x" v-model="v">
  <template #footer>
    <div class="dialog-footer">
      <el-button>取 消</el-button>
      <el-button type="primary">确 定</el-button>
    </div>
  </template>
</el-dialog>`,
  },
  {
    name: 'P1-2: slot in middle, other attrs after — strip slot, keep rest',
    input: `<my-card>
  <div class="title" slot="header" id="h1">Hi</div>
</my-card>`,
    expected: `<my-card>
  <template #header>
    <div class="title" id="h1">Hi</div>
  </template>
</my-card>`,
  },
  // ============ iter-048a F1: 嵌套 slot wrap 修复 ============
  {
    name: 'F1: 外层 slot=dropdown 包了内层 slot=prepend 模板 (sticky.vue 真实场景)',
    input: `<el-dropdown trigger="click">
  <el-button>Link</el-button>
  <el-dropdown-menu slot="dropdown" class="no-padding" style="width:300px">
    <el-input v-model="url" placeholder="...">
      <template slot="prepend">
        Url
      </template>
    </el-input>
  </el-dropdown-menu>
</el-dropdown>`,
    expected: `<el-dropdown trigger="click">
  <el-button>Link</el-button>
  <template #dropdown>
    <el-dropdown-menu class="no-padding" style="width:300px">
      <el-input v-model="url" placeholder="...">
        <template #prepend>
          Url
        </template>
      </el-input>
    </el-dropdown-menu>
  </template>
</el-dropdown>`,
  },
  {
    name: 'F1: 3 层嵌套 — 祖父 slot=header 父 slot=footer 内 template slot=title',
    input: `<a>
  <b slot="header">
    <c slot="footer">
      <template slot="title">T</template>
      X
    </c>
  </b>
</a>`,
    expected: `<a>
  <template #header>
    <b>
      <template #footer>
        <c>
          <template #title>T</template>
          X
        </c>
      </template>
    </b>
  </template>
</a>`,
  },
  {
    name: 'F1: 内层 slot 与外层 slot 同行 — 同级不会嵌套,正常两次独立改',
    input: `<x>
  <y slot="a"><template slot="b">Z</template></y>
  <y slot="c">OK</y>
</x>`,
    // 内层 template slot 已被改写为 #b,外层 y slot 也被 wrap
    // (内层因 inline 形式 <y>...<template>Z</template>...</y> 不会被再缩进 — 现行 wrap 行为)
    expected: `<x>
  <template #a>
    <y><template #b>Z</template></y>
  </template>
  <template #c>
    <y>OK</y>
  </template>
</x>`,
  },
  {
    name: 'F1: 无 slot 改动场景 (regression — 不动)',
    input: `<div>
  <el-input v-model="x" />
</div>`,
    expected: `<div>
  <el-input v-model="x" />
</div>`,
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
