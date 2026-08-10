/**
 * 规则：filters 选项移除
 *
 * Vue2 组件选项里的 `filters: { foo(v) { ... }, bar(v, n) { ... } }` 在 Vue3 中被移除。
 * 模板里的 `{{ x | foo | bar(n) }}` 改成直接调用 `{{ bar(foo(x), n) }}` —— 这条由
 * `template-filters` 规则处理。
 *
 * 这里只做识别 + 警告；不自动重写 filters 选项，因为：
 *   - filter 函数和 template AST 强绑定（template-filter 规则在另一个文件）
 *   - 用户可能希望保留这些函数作为 utils（需要提取到 module scope）
 *   - 自动重命名引用点风险大
 *
 * 同时：扫描文件里有没有 `filters: { ... }` 选项，如果有，标记 manualReview，
 *       并在文件顶部加注释提示。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse

export function applyFiltersOptionWarning(file: any, utils: any): void {
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  traverse(ast, {
    ObjectProperty(path: any) {
      const node = path.node
      if (!t.isIdentifier(node.key, { name: 'filters' })) return
      if (!t.isObjectExpression(node.value)) return

      // 任意组件选项里出现 filters 都提示
      // 不严格区分 export default / defineComponent / Vue.extend，因为模板端
      // 的 filter 链已经被 template-filters 规则重写，这里只是提醒用户把
      // 这些函数提取到 module scope。
      utils.manualReview(
        'Vue2 `filters` option found — Vue3 removes it. Functions need to be extracted to module scope and called directly in template (already handled by template-filter rule if their names match).',
      )
      utils.markChanged('filters option detected (warning only)')
    },
  })
}
