#!/usr/bin/env node
/**
 * @vue-migrate/cli
 * 
 * 用法:
 *   vue-migrate transform <src>
 *   vue-migrate scan <src>
 */

import { Command } from 'commander'
import { runPipeline, scanProject, getPlugins, listPluginNames } from '@vue-migrate/core'
// 副作用：注册插件
import '@vue-migrate/plugin-vue2-compat'
import '@vue-migrate/plugin-vue3-entry'
import '@vue-migrate/plugin-vue3-template'
import '@vue-migrate/plugin-vue3-directives'
import '@vue-migrate/plugin-vue3-types'
import '@vue-migrate/plugin-elementui'
import '@vue-migrate/plugin-composition'
import '@vue-migrate/plugin-store-bridge'
import '@vue-migrate/plugin-vue-router-v4'
import '@vue-migrate/plugin-vuex-pinia'
import '@vue-migrate/plugin-vxe-table'
import '@vue-migrate/plugin-3rd-party-imports'
import '@vue-migrate/plugin-package-json'
import '@vue-migrate/plugin-import-cleaner'
import '@vue-migrate/plugin-vite-compat'
import '@vue-migrate/plugin-vite-scaffold'   // iter-049a P0 #1/#2/#3: vite.config.js + index.html + public/
import '@vue-migrate/plugin-resource-copier' // iter-049a P0 #6/#7/#8: 复制 waves.css + TodoList/index.scss + 47 svg
import '@vue-migrate/plugin-auto-import-components'  // iter-049a P1 #16-18 + #58-63: 自动 import 缺组件
import '@vue-migrate/plugin-v-model-emit-fixer'  // iter-049a P1 #15: emit('input') → update:modelValue
import '@vue-migrate/plugin-view-fix'  // iter-049a: 修 BUG-009/010/011/012/013/014/068/070
import '@vue-migrate/plugin-vite-scaffold'
import '@vue-migrate/plugin-resource-copier'
import '@vue-migrate/plugin-this-replacer'
import '@vue-migrate/plugin-vue-extend'  // iter-051 P1: new X().$mount() + setCurrentView 递归 review
import '@vue-migrate/plugin-jsx-render'  // iter-120: h() signature migration + JSX/TSX support
import '@vue-migrate/plugin-i18n-migrate'  // iter-121: vue-i18n v8 → v9
import '@vue-migrate/plugin-antd-vue'  // iter-121: ant-design-vue 1.x → 2.x
import '@vue-migrate/plugin-ts-decorator'  // iter-119: TS class-based components
import '@vue-migrate/plugin-amp-escape'  // iter-125: HTML 5 strict & → &amp; in .vue templates

const program = new Command()

program
  .name('vue-migrate')
  .description('Vue2 → Vue3 (and beyond) automated migration tool')
  .version('0.1.0')

program
  .command('transform')
  .description('Run the full transformation pipeline')
  .argument('<src>', 'Source directory to migrate')
  .option('-o, --out <dir>', 'Output directory (default: in-place)')
  .option('--dry-run', 'Preview without writing files', false)
  .option('--backup', 'Backup original files to .vue-migrate-backup/', false)
  .option('-p, --plugins <names...>', 'Specify which plugins to run (default: all)')
  .option('--only-changed', 'Only write files that were changed by plugins (skip unchanged files). Default: copy full directory structure to output dir.', false)
  .option('--ts', 'Enable TS fallback: when a <script> block has no lang="ts" but fails JS parse, try TS parse. Default: off (strict lang parsing).', false)
  .action(async (src: string, opts: any) => {
    await runPipeline({
      root: src,
      outDir: opts.out,
      dryRun: opts.dryRun,
      backup: opts.backup,
      plugins: opts.plugins,
      keepStructure: !opts.onlyChanged,  // --only-changed 时不保留
      fallbackToTs: !!opts.ts,  // iter-037: 默认 false, 加 --ts 才启用
    })
  })

program
  .command('scan')
  .description('Scan project and show detected Vue2 features')
  .argument('<src>', 'Source directory to scan')
  .action(async (src: string) => {
    const { registerPlugin, runPipeline } = await import('@vue-migrate/core')
    await import('@vue-migrate/plugin-vue2-compat')
    await runPipeline({
      root: src,
      dryRun: true,
      plugins: [], // 不跑任何插件
    })
  })

program
  .command('plugins')
  .description('List registered plugins')
  .action(() => {
    console.log('\n已注册插件:')
    for (const name of listPluginNames()) {
      console.log(`  - ${name}`)
    }
    console.log()
  })

// 默认行为：没传子命令时显示帮助 + 插件列表
const argv = process.argv.slice(2)
if (argv.length === 0 || argv[0]?.startsWith('-')) {
  console.log(program.helpInformation())
  console.log('\n已注册插件:')
  for (const name of listPluginNames()) {
    console.log(`  - ${name}`)
  }
  console.log()
  process.exit(0)
}

program.parse()
