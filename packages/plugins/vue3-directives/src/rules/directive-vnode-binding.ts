/**
 * 规则：Vue2 指令 vnode → Vue3 binding 转换
 *
 * Vue2 directive hook 签名: bind(el, binding, vnode) / inserted(el, binding, vnode)
 *   - vnode.context  ← 组件实例（vm）
 *   - vnode.child    ← 子组件实例（注意：不是 child 这个字段，是 vnode.componentInstance 或 vnode.children）
 *   - vnode.componentInstance  ← 子组件实例
 *   - vnode.elm     ← 实际 el
 *
 * Vue3 directive hook 签名: beforeMount(el, binding, vnode) / mounted(...)
 *   - binding.instance  ← 组件实例（等价 vnode.context）
 *   - vnode  ← VNode（结构跟 Vue2 不同，没有 componentInstance，没有 .context）
 *   - 要拿子组件用 vnode.component（如果存在）
 *
 * 因此 Vue2 → Vue3 转换：
 *   - vnode.context.xxx       → binding.instance.xxx
 *   - vnode.context.$emit(...) → binding.instance.$emit(...)
 *   - vnode.componentInstance  → binding.instance 或 vnode.component
 *   - vnode.child             → vnode.component（如果 vnode 是组件 vnode）
 *
 * 实现：
 *   跑在 directive hook rename 之后，扫描所有 directive hook 里的 vnode.xxx 引用。
 *   保守策略：只对 vnode.context 做改写，componentInstance/child 标 review。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse

/** 已知 Vue2 / Vue3 directive hook 名（都处理，因为 directive-hooks 会先重命名） */
const V3_DIRECTIVE_HOOKS = new Set([
  // Vue3 名字
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeUnmount',
  'unmounted',
  // Vue2 旧名（如果 directive-hooks 还没跑过，兼容一下）
  'bind',
  'inserted',
  'unbind',
  'componentUpdated',
])

/** 检测函数是否"看起来像"directive hook：参数列表 (el, binding, vnode) */
function isDirectiveHookLike(fn: t.Function): boolean {
  if (fn.params.length < 3) return false
  // 第 2 个参数 binding，第 3 个参数 vnode
  const second = fn.params[1]
  const third = fn.params[2]
  if (!t.isIdentifier(second) || !t.isIdentifier(third)) return false
  if (second.name !== 'binding' || third.name !== 'vnode') return false
  return true
}

export function applyDirectiveVnodeBindingRewrite(file: any, utils: any): void {
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  traverse(ast, {
    // 1) ObjectProperty / ObjectMethod: `bind(el, binding, vnode) { ... }`
    ObjectMethod(path: any) {
      const node = path.node
      if (!V3_DIRECTIVE_HOOKS.has(node.key.name)) return
      if (!isDirectiveHookLike(node as any)) return
      rewriteVnodeInBody(node.body as t.BlockStatement, utils)
    },
    ObjectProperty(path: any) {
      const node = path.node
      if (!t.isIdentifier(node.key)) return
      if (!V3_DIRECTIVE_HOOKS.has(node.key.name)) return
      // value 必须是函数
      if (!t.isFunction(node.value)) return
      if (!isDirectiveHookLike(node.value)) return
      rewriteVnodeInBody(node.value.body as t.BlockStatement, utils)
    },
  })
}

function rewriteVnodeInBody(body: t.BlockStatement, utils: any): void {
  let changed = false

  // 用 visit 方式遍历（不依赖 scope/parentPath），逐层 walk
  walkNode(body, (n) => {
    // vnode.context / vnode.componentInstance → binding.instance
    if (t.isMemberExpression(n)) {
      if (
        t.isIdentifier(n.object, { name: 'vnode' }) &&
        t.isIdentifier(n.property, { name: 'context' })
      ) {
        n.object = t.identifier('binding')
        n.property = t.identifier('instance')
        changed = true
        utils.markChanged('vnode.context → binding.instance')
        return
      }
      if (
        t.isIdentifier(n.object, { name: 'vnode' }) &&
        t.isIdentifier(n.property, { name: 'componentInstance' })
      ) {
        n.object = t.identifier('binding')
        n.property = t.identifier('instance')
        changed = true
        utils.markChanged('vnode.componentInstance → binding.instance')
        return
      }
    }
    // vnode.child.$emit(...) → binding.instance.$emit(...)
    if (t.isCallExpression(n)) {
      if (
        t.isMemberExpression(n.callee) &&
        t.isMemberExpression(n.callee.object) &&
        t.isIdentifier(n.callee.object.object, { name: 'vnode' }) &&
        t.isIdentifier(n.callee.object.property, { name: 'child' }) &&
        t.isIdentifier(n.callee.property, { name: '$emit' })
      ) {
        n.callee.object = t.memberExpression(
          t.identifier('binding'),
          t.identifier('instance'),
        )
        changed = true
        utils.markChanged('vnode.child.$emit → binding.instance.$emit')
      }
    }
  })

  if (changed) {
    // mark already done in inner
  }
}

/** DFS walk without needing scope — safe for nested blocks */
function walkNode(node: t.Node, visit: (n: t.Node) => void): void {
  visit(node)
  for (const key of t.VISITOR_KEYS[node.type] || []) {
    const child = (node as any)[key]
    if (Array.isArray(child)) {
      for (const c of child) {
        if (c && typeof c === 'object' && c.type) walkNode(c, visit)
      }
    } else if (child && typeof child === 'object' && child.type) {
      walkNode(child, visit)
    }
  }
}
