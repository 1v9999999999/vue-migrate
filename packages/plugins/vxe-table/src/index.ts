/**
 * @vue-migrate/plugin-vxe-table
 *
 * vxe-table 3 (Vue 2) → vxe-table 4 (Vue 3) 转换插件
 *
 * 自动改：
 *   VT.1  'vxe-table/lib/index.css' → 'vxe-table/lib/style.css'
 *   VT.2  <vxe-table-column> → <vxe-column> (template)
 *
 * 兼容性说明：
 *   - 主包 'vxe-table' 同名，import 路径不变
 *   - VXETable 这个默认导入名 v4 仍能跑（不强制改名为 VxeUITable）
 *   - 大量 config prop（sort-config, column-config 等）v4 兼容 v3 命名
 *     不自动改；如需改用 v4 新名由用户自行处理
 *
 * Priority: 8（在 vue3-template 9 之后跑，这样 template 规则先扫）
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import { collectVxeTableImports } from './rules/import-path.js'
import { renameVxeTableColumn } from './rules/template.js'
import { replaceTemplateContent } from '../../vue3-template/src/utils/sfc-source.js'

const plugin: TransformPlugin = {
  name: 'vxe-table',
  description:
    'Migrate vxe-table 3 (Vue 2) to vxe-table 4 (Vue 3): CSS import path, <vxe-table-column> → <vxe-column>.',
  priority: 8,
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    // Script side: import paths
    if (ctx.file.scriptAst) {
      collectVxeTableImports(ctx)
    }

    // Template side: <vxe-table-column> → <vxe-column>
    if (ctx.file.kind === 'vue') {
      const template: string | null = ctx.file.sfc?.template?.content ?? null
      if (template !== null) {
        const result = renameVxeTableColumn(template)
        if (result.changed) {
          const replaced = replaceTemplateContent(
            ctx.file,
            result.out,
            'vxe-table3 → vxe-table4 (column rename)',
          )
          if (replaced.changed) {
            ctx.utils.markChanged('vxe-table column rename')
          }
        }
      }
    }
  },
}

registerPlugin(plugin)
export default plugin
