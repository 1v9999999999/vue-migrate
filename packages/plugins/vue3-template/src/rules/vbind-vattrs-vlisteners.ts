/**
 * 规则 2.13: 标记 v-bind="$attrs" / v-on="$listeners" / ::v-deep 为 review
 *
 * Vue2 → Vue3 行为变化：
 *   - $listeners 已移除，Vue3 中事件继承走 attrs（fallthrough attributes）
 *   - $attrs 现在包含 attrs 和 listeners（合并）
 *   - `v-bind="$attrs"` 在 Vue3 仍有效，但配合 `v-on="$attrs"` 这种重复使用是 Vue2 时代的 bug
 *   - 子组件应该显式声明 props/emits，剩余 attrs 用 inheritAttrs: false + v-bind="$attrs" 显式转发
 *   - ::v-deep 已被废弃（Vue 3.4 → 警告，Vue 3.5+ → 移除），用 :deep() 替代
 *
 * 实现：
 *   扫描所有 `v-bind="$attrs"` / `v-on="$listeners"` / `::v-deep` / `>>>` / `/deep/`，
 *   标 review（不删除）— 因为自动改写风险较大（要正确处理选择器上下文）。
 */

import {
  scanAllElements,
  type ElementMatch,
  type ParsedAttr,
} from '../utils/template-scanner.js'
import { applyEdits, type TextEdit } from '../utils/template-editor.js'

export interface VAttrResult {
  out: string
  changed: boolean
  changes: string[]
  reviewItems: string[]
}

export function reviewVAttrsVListeners(template: string): VAttrResult {
  const all = scanAllElements(template)
  const reviews: string[] = []
  const changes: string[] = []
  const edits: TextEdit[] = []
  const editDescs: string[] = []

  for (const el of all) {
    for (const a of el.attrs) {
      // v-bind="$attrs"  (also matches `:="$attrs"` short form)
      if (
        a.isDirective &&
        a.name === 'bind' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$attrs'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-bind="$attrs" 在 Vue3 中仍可用，但子组件建议显式声明 props，并把 inheritAttrs 设为 false 来禁用自动继承。`,
        )
        changes.push(
          `<${el.tagName} v-bind="$attrs"> marked for review (Vue3 inheritAttrs API)`,
        )
        continue
      }
      // v-on="$listeners"  (also matches @="$listeners")
      if (
        a.isDirective &&
        a.name === 'on' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$listeners'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-on="$listeners" 已废弃（Vue3 移除 $listeners）。改为显式 emit 事件，或用 v-on="someListenerObj"。`,
        )
        changes.push(
          `<${el.tagName} v-on="$listeners"> marked for review (Vue3 removed $listeners)`,
        )
        continue
      }
      // v-on="$attrs"  - 典型 Vue2 错用（应该是 v-bind）
      if (
        a.isDirective &&
        a.name === 'on' &&
        typeof a.value === 'string' &&
        a.value.trim() === '$attrs'
      ) {
        reviews.push(
          `<${el.tagName}> 上的 v-on="$attrs" 看起来是 bug —— 应该用 v-bind="$attrs"。`,
        )
        changes.push(
          `<${el.tagName} v-on="$attrs"> is likely a bug — should be v-bind="$attrs"`,
        )
      }
    }
  }

  // ============ iter-048a F2: ::v-deep / /deep/ / >>> 标 review + 替换为 :deep() ============
  // 这些是 CSS 深度选择器,Vue 2 写法。在 <style scoped> 里 Vue 2 支持 ::v-deep / /deep/ / >>> 三种。
  // Vue 3 重命名为 :deep() / :slotted() / :global() (按使用场景)。但 :deep() 内部不能再出现 ::伪元素
  // 嵌套 (e.g. `::v-deep ::v-deep xxx`) 需要人 review,这里保守处理:
  //   - 单层 ::v-deep foo { ... }     → :deep(foo) { ... }
  //   - 嵌套 ::v-deep .bar ::v-deep x → 标 review 提示手动调整
  //   - `/deep/` 和 `>>>` 等价处理
  // 注:这是 <style> 块里的 CSS,不是 <template>。但 vue3-template 也吃这个 string
  //    (rule applyTemplateFilterRewrite 也是全 template 字符串),
  //    所以 <style scoped> 不会走到这里 (parser 把 <style> 剥掉了)。这里我们处理的是
  //    任何位置 (虽然实际只会出现在 <style>),先保证不会破坏 template。
  const cssDeepEdits = reviewAndRewriteVDeep(template)
  edits.push(...cssDeepEdits.edits)
  editDescs.push(...cssDeepEdits.descs)
  reviews.push(...cssDeepEdits.reviews)

  if (changes.length === 0 && edits.length === 0 && reviews.length === 0) {
    return { out: template, changed: false, changes, reviewItems: [] }
  }
  return {
    out: edits.length > 0 ? applyEdits(template, edits) : template,
    changed: edits.length > 0 || changes.length > 0,
    changes: [...changes, ...editDescs],
    reviewItems: reviews,
  }
}

/**
 * 在 source 里找 ::v-deep / /deep/ / >>> 并处理。
 *
 * 简化策略:只处理"简单"情况 — 选择器里只有 ::v-deep 一次 + 一个标识符。
 *   e.g. ::v-deep .foo     → :deep(.foo)
 *        ::v-deep .foo .bar  → :deep(.foo .bar)
 *        ::v-deep(.foo)    → :deep(.foo)  (已经 Vue 3 写法,跳过)
 * 其它 (选择器里有多个 ::v-deep, 或者 ::v-deep 紧跟 ::v-deep 等) 标 review。
 *
 * 警告:<style> 块里的伪选择器需要在编译时识别。这里我们用文本扫描,
 *       会破坏 <template> 里的 ::v-deep 字面量 (极少) — 选择性 + 防御:
 *       只匹配"::v-deep" 后面是空白 + 标识符,或者直接是 CSS 上下文。
 *       在 <template> 里的 ::v-deep 不会在选择器位置(模板里只是字面文本),
 *       所以一般不会误伤。
 */
function reviewAndRewriteVDeep(source: string): {
  edits: TextEdit[]
  descs: string[]
  reviews: string[]
} {
  const edits: TextEdit[] = []
  const descs: string[] = []
  const reviews: string[] = []

  // 模式 1: ::v-deep 后跟一个简单选择器 (单层)
  // 匹配 ::v-deep\s+(.+)  到行末或 { 或 ;
  // 注意:selector 后的 trailing whitespace 也消耗掉,保持原缩进/格式
  // 防御嵌套:用 lookahead 检查 selector 块之后到下一个 { 之间还有没有 deep 选择器
  const re = /(::v-deep|\/deep\/|>>>)\s+([^\n{};]+?)(\s*)(?=\{|;|$|\n)/g
  let m: RegExpExecArray | null
  let lastIndex = 0
  while ((m = re.exec(source)) !== null) {
    // 防止死循环
    if (m.index < lastIndex) break
    lastIndex = m.index + m[0].length

    const fullMatch = m[0]
    const deepKeyword = m[1]
    const selector = m[2]
    const trailing = m[3]

    // 防御嵌套: 检查 selector 本身里有没有 ::v-deep / /deep/ / >>>
    if (/(::v-deep|\/deep\/|>>>)/.test(selector)) {
      reviews.push(
        `嵌套深度选择器 (源偏移 ${m.index}) 含多个 ::v-deep,无法自动重写,需手动改写为 Vue 3 的 :deep() 链。`,
      )
      // 跳过这一处,不替换
      continue
    }

    // 检查是否是 Vue 3 风格 (已经在 :deep() 里) — 应该不会命中,但防御
    if (selector.trim().startsWith('(')) {
      continue
    }

    // 替换: ::v-deep <selector> → :deep(<selector>)
    edits.push({
      start: m.index,
      end: m.index + fullMatch.length,
      replacement: `:deep(${selector})${trailing}`,
    })
    descs.push(
      `${deepKeyword} ${selector.trim()} → :deep(${selector.trim()}) (Vue 3 scoped style)`,
    )
  }

  return { edits, descs, reviews }
}
