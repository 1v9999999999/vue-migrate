/**
 * @vue-migrate/plugin-elementui
 *
 * ElementUI 2.x (Vue 2) → Element Plus (Vue 3) 转换插件
 *
 * 实现的规则（详细见 docs/ElementUI_ElementPlus_Catalog.md）：
 *   E.1  import 'element-ui' → 'element-plus'
 *   E.2  import { Button, ... } from 'element-ui' → from 'element-plus'
 *   E.3  import CSS 路径调整
 *   E.5  size="medium" → "default"
 *   E.8  this.$message → ElMessage
 *   E.9  this.$msgbox → ElMessageBox
 *   E.10 this.$notify → ElNotification
 *   E.11 this.$alert/confirm/prompt → ElMessageBox.xxx
 *   E.12 this.$loading → ElLoading
 *   E.13 size="mini" → "small"
 *   E.16 <el-dialog :visible.sync> → v-model
 *   E.17 <el-drawer :visible.sync> → v-model
 *   E.25 <el-submenu> → <el-sub-menu>
 *
 *   标 review（不自动改）：
 *   E.6  el-icon-xxx class（需要用 icon 组件）
 *   E.27 icon="el-icon-xxx" prop（需要用 icon 组件）
 *   E.34 this.$refs.formRef.validate() 回调 → Promise
 *   E.36 el-upload before-upload 签名
 *   E.38 自定义主题（需重新配置）
 *
 * 关键实现：
 *   - import 路径转换：用 babel traverse 改 ImportDeclaration
 *   - 默认导入改名：ElementUI → ElementPlus（保留 Vue.use 调用能用）
 *   - this.$xxx → ElXxx：通过 babel traverse 改 MemberExpression 的 object
 *   - 自动加 import：扫到用到了哪些 API，自动 import
 *   - template 端：复用 vue3-template 的 scanner + sfc-source 工具
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'
import _traverse from '@babel/traverse'
import * as _t from '@babel/types'
import {
  collectElementUIImports,
  renameDefaultLocalName,
  type ElementUIContext,
} from './rules/import-path.js'
import { renameDefaultImport } from './rules/global-register.js'
import {
  collectUsedApis,
  replaceGlobalMethods,
  ensureElementPlusImports,
} from './rules/global-methods.js'
import { applyTemplateTransform } from './rules/template.js'
import { applyIconTransform } from './rules/icon.js'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

const plugin: TransformPlugin = {
  name: 'elementui',
  description:
    'Migrate ElementUI 2.x (Vue 2) to Element Plus (Vue 3): imports, size props, component renames, .sync → v-model, this.$message/$msgbox/$notify → ElMessage/ElMessageBox/ElNotification, icon class → el-icon',
  priority: 25, // 跑在 vue2-compat (10) 之后、vue3-template (9) 之前

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    // skip webpack/minified/bundled vendor JS (static/js/*.js, vendor*.js, *.min.js)
    const skipPatterns = /[\\/](static|dist|build|vendor)[\\/]|vendor\..*\.js$|\.min\.js$|node_modules/
    if (skipPatterns.test(ctx.file.path)) return
    if (ctx.file.source.length > 50000 && !ctx.file.path.endsWith('.vue')) {
      // large file (>50KB) and not .vue, almost certainly bundled
      return
    }

    // ========== 0. iter-044 B3: element-variables.scss 检测 ==========
    // Element UI 时代的 SCSS 变量覆盖文件 (常见路径: ./styles/element-variables.scss)
    // Element Plus 走 CSS variables,这文件大多无意义 — 但用户可能有自己的覆盖,
    // 标 review 提示用户处理,不自动删。
    if (ctx.file.scriptAst) {
      traverse(ctx.file.scriptAst, {
        ImportDeclaration(path: any) {
          const node = path.node
          if (!_t.isStringLiteral(node.source)) return
          const src = node.source.value
          // 匹配 element-variables / element-variable 之类命名（用户可能多个)
          if (/element[-_]variables?/i.test(src)) {
            // iter-116: 降级为 ctx.log (Element UI SCSS 变量 → Element Plus CSS variables 是已知迁移, 不进 review)
            //      Element Plus CSS variables: --el-color-primary, --el-color-success 等 (https://element-plus.org/en-US/guide/theming.html)
            //      实际改法: 把 element-variables.scss 里的 $--color-primary: #xxx → :root { --el-color-primary: #xxx }
            ctx.log?.(
              `[elementui] ${ctx.file.relativePath} 引用了 '${src}' — Element UI SCSS 变量覆盖文件。Element Plus 走 CSS variables (--el-color-primary 等), 此类文件大多不再需要。若含项目自定义变量, 改成 :root { --el-color-primary: #xxx } 形式。`,
            )
          }
        },
      })
    }

    // ========== 1. Script AST: import + this.$xxx replacement ==========
    if (ctx.file.scriptAst) {
      // collect and modify import paths
      const info: ElementUIContext = collectElementUIImports(ctx)

      // rename default import name ElementUI → ElementPlus
      if (info.defaultLocalName && info.defaultLocalName !== 'ElementPlus') {
        renameDefaultImport(ctx, info)
      }

      const usedApis = collectUsedApis(ctx)

      // 替换 this.$message → ElMessage 等
      if (usedApis.size > 0) {
        replaceGlobalMethods(ctx, usedApis)
      }

      // auto-add imports
      ensureElementPlusImports(ctx, usedApis)

      // iter-038-fix: We just mutated file.scriptAst (added ElMessage /
      // ElNotification imports). Composition (priority 0) runs AFTER us
      // (priority 25) and uses raw-source path that ignores scriptAst —
      // so without this sync, our new imports would be lost.
      // syncScriptAstToSource() re-generates the script block from the AST
      // and writes it back to file.source so composition picks it up.
      ctx.utils.syncScriptAstToSource()
    }

    // ========== 2. Template: tag rename / .sync / size ==========
    if (ctx.file.kind === 'vue') {
      applyTemplateTransform(ctx, 'ElementUI template → Element Plus')
      applyIconTransform(ctx, 'ElementUI icon → el-icon')
    }
  },
}

registerPlugin(plugin)
export default plugin
