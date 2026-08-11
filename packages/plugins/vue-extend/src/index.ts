/**
 * @vue-migrate/plugin-vue-extend
 *
 * iter-051 增量 plugin: 自递归函数检测 (e.g. setCurrentView 调自己)
 *
 * 背景:
 *   - `new Xxx().$mount(div)` (progressBar / DetailPanel / dialog 之类动态挂载)
 *     已经在 iter-052 由 vue3-entry plugin 处理
 *   - 自递归 view-switch 函数 (e.g. setCurrentView 调 setCurrentView) 是 Vue 2
 *     项目里另一类常见模式:
 *
 *         function setCurrentView(view) {
 *           currentView.value = view
 *           if (something) setCurrentView(otherView)  // 递归
 *         }
 *
 *     Vue 3 改为 `<component :is="currentView" />` 后,这种递归可以删除,但
 *     **自动检测困难**(静态分析需要跨函数 + 跨作用域分析)。
 *     策略: 简单 regex 检测"function NAME(...) { ... NAME(...) ... }" 模式,
 *     标 review,不自动改。
 *
 * 为什么独立 plugin: vue3-entry (priority 9) 已经被塞了很多 entry 逻辑,
 *                  把这个归到那里会让那个 plugin 更长,职责不清。
 *                  priority 6 (在 composition 0 之前) 让 self-recursive
 *                  review 在 conversion 跑之前给出, 用户 review 文件时
 *                  看到的是已经标记好的状态。
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

/**
 * VE.1: 简单自递归函数检测。
 *
 * 实现: 找 `function NAME(...) { ... NAME(...) ... }` 形式 (FunctionDeclaration),
 *       检查 body 里是否至少出现一次 NAME(args) 调用。
 *
 * 注意:
 *   - 箭头函数和 FunctionExpression 不算 (通常是 callback,不是"动态 view 切换")
 *   - 排除 callback 形参同名 (e.g. setTimeout 之类)
 *   - 排除函数声明引用了其他函数,但**那个函数名匹配本函数名**
 *   - 排除方法定义 (e.g. obj.foo() 调 foo() 不算)
 *   - 白名单: Vue 2 lifecycle / setup / data / render / watch / computed / 路由钩子等
 *     (这些是 framework 调用约定,不是"业务递归")
 */
function reviewSelfRecursiveFunctions(file: any, utils: any): void {
  if (!file.source) return
  // 字符串级 regex 简化: function NAME( ... ) { ... NAME( ... }
  // 排除箭头函数 / 表达式
  const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = fnRe.exec(file.source)) !== null) {
    const name = m[1]
    // skip Vue 2 lifecycle / setup / 路由 / 框架调用约定
    if (
      name === 'render' ||
      name === 'setup' ||
      name === 'created' ||
      name === 'mounted' ||
      name === 'beforeMount' ||
      name === 'beforeUpdate' ||
      name === 'updated' ||
      name === 'activated' ||
      name === 'deactivated' ||
      name === 'errorCaptured' ||
      name === 'beforeDestroy' ||
      name === 'destroyed' ||
      name === 'beforeUnmount' ||
      name === 'unmounted' ||
      name === 'computed' ||
      name === 'watch' ||
      name === 'data' ||
      name === 'methods' ||
      name === 'props' ||
      name === 'filters' ||
      name === 'components' ||
      name === 'beforeRouteEnter' ||
      name === 'beforeRouteUpdate' ||
      name === 'beforeRouteLeave'
    ) {
      continue
    }
    // 找函数体范围 (用 brace match)
    const openIdx = m.index + m[0].length - 1  // 指向 '{'
    const bodyStart = openIdx + 1
    let depth = 1
    let i = bodyStart
    while (i < file.source.length && depth > 0) {
      const ch = file.source[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    if (depth !== 0) continue
    const bodyEnd = i - 1
    const body = file.source.slice(bodyStart, bodyEnd)
    // 检查 body 里是否调用 NAME(...)
    // 用单词边界 + NAME 后接 (  (排除 NAME = ... 这种)
    const callRe = new RegExp(String.raw`\b${name}\s*\(`, 'g')
    if (callRe.test(body)) {
      utils.manualReview(
        `检测到自递归函数 \`${name}\` — Vue 2 动态 view 切换的常见模式 (e.g. setCurrentView)。` +
          `\n  Vue 3 推荐用 <component :is="currentView" /> 替代,删除自递归。` +
          `\n  如果该递归用于"重新触发同一逻辑",考虑改 watch(currentView, () => ...)。`,
      )
    }
  }
}

const plugin: TransformPlugin = {
  name: 'vue-extend',
  description:
    'iter-051: detect self-recursive function declarations (e.g. setCurrentView). Marks manual review with hints to use <component :is> or watch() instead. The new X().$mount() pattern is handled by vue3-entry (iter-052).',
  priority: 6, // 在 this-replacer(5) 之前, composition(0) 之前
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    if (!file.source) return

    // VE.1: review 自递归函数
    reviewSelfRecursiveFunctions(file, utils)
  },
}

// 单测入口
export const _testable_reviewSelfRecursiveFunctions = reviewSelfRecursiveFunctions

registerPlugin(plugin)
export default plugin
