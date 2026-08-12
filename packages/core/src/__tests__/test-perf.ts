/**
 * test-perf.ts
 *
 * iter-122b: 性能 benchmark — 验证 5K 行 .vue 文件在 < 5s 内完成转换。
 *
 * 跑法:
 *   tsx packages/core/src/__tests__/test-perf.ts
 *
 * 输出:
 *   pass N (N 个 sub-test 全部通过)
 *   fail 0
 */
import { performance } from 'node:perf_hooks'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs'

import { runPipeline } from '../orchestrator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// iter-122b: TMP_DIR 不能含 __tests__, 否则 orchestrator 会把所有文件当 test file 跳过
const TMP_DIR = join(__dirname, '..', '..', '..', '_dbg', 'stress', 'perf-tmp')

/** 生成指定行数的 Vue 组件 — 类似真实业务组件 (template + script + style). */
function makeLargeVueFile(targetLines: number, seed = 0): string {
  const lines: string[] = []
  // <template>
  lines.push('<template>')
  lines.push('  <div class="container">')
  for (let i = 0; i < 30; i++) {
    lines.push(`    <div v-for="item in items${i}" :key="item.id" @click="handle${i}(item)">`)
    lines.push(`      <span :class="{ active: item.active }">{{ item.name }} - {{ item.value }}</span>`)
    lines.push(`      <el-button type="primary" :icon="icon${i}" @click="onClick${i}">Button ${i}</el-button>`)
    lines.push(`      <el-input v-model="item.value${i}" placeholder="Enter ${i}" />`)
    lines.push(`    </div>`)
  }
  for (let i = 0; i < 10; i++) lines.push(`      <p>{{ msg${i} }}</p>`)
  lines.push('  </div>')
  lines.push('</template>')
  lines.push('')
  // <script>
  lines.push('<script>')
  lines.push("import { ref, reactive, computed, onMounted, watch } from 'vue'")
  lines.push("import { ElButton, ElInput } from 'element-plus'")
  lines.push('')
  lines.push('export default {')
  lines.push('  name: \'StressTestComponent\',')
  lines.push('  data() {')
  lines.push('    return {')
  for (let i = 0; i < 30; i++) {
    lines.push(`      items${i}: [],`)
    lines.push(`      msg${i}: 'message ${i}',`)
    lines.push(`      value${i}: ${i},`)
    lines.push(`      active${i}: false,`)
  }
  lines.push('    }')
  lines.push('  },')
  lines.push('  props: {')
  for (let i = 0; i < 20; i++) {
    lines.push(`    prop${i}: { type: [String, Number], default: ${i % 2 === 0 ? '\'default\'' : i} },`)
  }
  lines.push('  },')
  lines.push('  computed: {')
  for (let i = 0; i < 20; i++) {
    lines.push(`    computed${i}() { return this.value${i} * 2 + this.prop${i} },`)
  }
  lines.push('  },')
  lines.push('  watch: {')
  for (let i = 0; i < 10; i++) {
    lines.push(`    value${i}(val) { this.handle${i}({ id: val, name: 'watched', value: val }) },`)
  }
  lines.push('  },')
  lines.push('  methods: {')
  for (let i = 0; i < 30; i++) {
    lines.push(`    handle${i}(item) { this.value${i} = item.value; this.active${i} = !this.active${i} },`)
  }
  lines.push('    handleSubmit() { this.validate0() && this.handle0({ id: 0, name: \'submit\', value: 1 }) },')
  lines.push('  },')
  lines.push('  mounted() {')
  for (let i = 0; i < 30; i++) {
    lines.push(`    this.handle${i}({ id: ${i}, name: 'init-${i}', value: ${i} })`)
  }
  lines.push('  },')
  lines.push('  beforeDestroy() {')
  for (let i = 0; i < 30; i++) {
    lines.push(`    this.handle${i}({ id: ${i}, name: 'destroy-${i}', value: ${i} })`)
  }
  lines.push('  }')
  lines.push('}')
  lines.push('</script>')
  lines.push('')
  // <style>
  lines.push('<style scoped>')
  lines.push('.container { padding: 16px; }')
  for (let i = 0; i < 20; i++) {
    lines.push(`.item-${i} { color: red; }`)
  }
  lines.push('</style>')
  // pad 到 target
  const result = lines.join('\n')
  if (lines.length < targetLines) {
    const extra: string[] = []
    for (let i = lines.length; i < targetLines; i++) {
      extra.push(`    .pad-${i} { padding: ${i % 16}px; }`)
    }
    return result.replace('</style>', extra.join('\n') + '\n</style>')
  }
  return result
}

interface SubTest {
  name: string
  file: string
  expectedMaxMs: number
}

async function main(): Promise<void> {
  // 准备临时目录 — 每次跑都重新生成, 避免脏数据
  mkdirSync(TMP_DIR, { recursive: true })

  const tests: SubTest[] = [
    { name: '1K Vue file < 2s', file: 'large-1k.vue', expectedMaxMs: 2000 },
    { name: '5K Vue file < 5s', file: 'large-5k.vue', expectedMaxMs: 5000 },
    { name: '10K Vue file < 10s', file: 'large-10k.vue', expectedMaxMs: 10000 },
    // iter-122b 关键 benchmark: 3 个大文件(1K+5K+10K)一起 < 8s
    { name: 'all 3 large files < 8s', file: 'ALL', expectedMaxMs: 8000 },
  ]

  // 注册所有 plugins (仿照 cli/index.ts)
  // 用相对路径直接 import plugin 源, 避免 @vue-migrate/* 包名在 monorepo 没装
  const PLUGIN_IMPORTS = [
    '../../../plugins/vue2-compat/src/index.ts',
    '../../../plugins/vue3-entry/src/index.ts',
    '../../../plugins/vue3-template/src/index.ts',
    '../../../plugins/vue3-directives/src/index.ts',
    '../../../plugins/vue3-types/src/index.ts',
    '../../../plugins/elementui/src/index.ts',
    '../../../plugins/composition/src/index.ts',
    '../../../plugins/store-bridge/src/index.ts',
    '../../../plugins/vue-router-v4/src/index.ts',
    '../../../plugins/vuex-pinia/src/index.ts',
    '../../../plugins/vxe-table/src/index.ts',
    '../../../plugins/3rd-party-imports/src/index.ts',
    '../../../plugins/package-json/src/index.ts',
    '../../../plugins/import-cleaner/src/index.ts',
    '../../../plugins/vite-compat/src/index.ts',
    '../../../plugins/vite-scaffold/src/index.ts',
    '../../../plugins/resource-copier/src/index.ts',
    '../../../plugins/auto-import-components/src/index.ts',
    '../../../plugins/v-model-emit-fixer/src/index.ts',
    '../../../plugins/view-fix/src/index.ts',
    '../../../plugins/this-replacer/src/index.ts',
    '../../../plugins/vue-extend/src/index.ts',
    '../../../plugins/jsx-render/src/index.ts',
    '../../../plugins/i18n-migrate/src/index.ts',
    '../../../plugins/antd-vue/src/index.ts',
    '../../../plugins/ts-decorator/src/index.ts',
  ]
  for (const p of PLUGIN_IMPORTS) {
    await import(/* @vite-ignore */ p)
  }

  let pass = 0
  let fail = 0
  for (const t of tests) {
    // iter-122b: 每个 test 用独立的 TMP_DIR, 避免上轮 output 被下轮 scanner 当 source 误处理
    const tmpDir = join(TMP_DIR, 'run-' + t.file.replace('.vue', '').replace('.', '-'))
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    mkdirSync(tmpDir, { recursive: true })
    const outDir = join(tmpDir, 'out')

    // 生成 source 文件
    if (t.file !== 'ALL') {
      const targetLines = parseInt(t.file.match(/large-(\d+)k/)?.[1] || '1') * 1000
      const code = makeLargeVueFile(targetLines)
      const filePath = join(tmpDir, t.file)
      writeFileSync(filePath, code, 'utf-8')
    } else {
      // ALL: 一次性生成 1K + 5K + 10K
      for (const sub of ['large-1k.vue', 'large-5k.vue', 'large-10k.vue']) {
        const targetLines = parseInt(sub.match(/large-(\d+)k/)?.[1] || '1') * 1000
        const code = makeLargeVueFile(targetLines)
        const filePath = join(tmpDir, sub)
        writeFileSync(filePath, code, 'utf-8')
      }
    }

    const start = performance.now()
    try {
      const ctx = await runPipeline({
        root: tmpDir,
        outDir,
        dryRun: false,
        keepStructure: false,
      })
      const elapsed = performance.now() - start
      const errors = ctx.stats.errors
      const review = ctx.stats.manualReviewRequired
      const ok = elapsed <= t.expectedMaxMs && errors === 0
      const status = ok ? '✓' : '✗'
      console.log(
        `  ${status} ${t.name.padEnd(28)} ${elapsed.toFixed(0).padStart(5)}ms (errors=${errors}, review=${review}, target <= ${t.expectedMaxMs}ms)`,
      )
      if (ok) pass++; else fail++
    } catch (e: any) {
      console.log(`  ✗ ${t.name.padEnd(28)} FAILED: ${e.message}`)
      fail++
    }
  }

  console.log(`\n  pass ${pass}`)
  console.log(`  fail ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
