/**
 * 规则：自定义指令生命周期迁移
 *
 * Vue2 → Vue3 指令 hook 重命名：
 *   bind           → beforeMount
 *   inserted       → mounted
 *   update         → updated
 *   componentUpdated → updated (与 update 合并)
 *   unbind         → unmounted
 *
 * 这条规则同时处理：
 *   1. 组件选项 `directives: { 'name': { bind, inserted, ... } }` —— AST
 *   2. 全局注册 `Vue.directive('name', { bind, ... })` —— AST
 *   3. 模板里 <MyComponent v-name="x"> —— template 中通常不会写出 hooks，但保留 hook 字面量作为防御
 *
 * 注意：Vue3 中同一个 directive 同一个 hook 不能在两个方法里同时存在；
 * 如果 Vue2 同时有 `update` 和 `componentUpdated`，需要合并两个函数体。
 * 这里采取保守策略：把第二个改名成 `updated_old_xxx` + 标记 manualReview。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

const HOOK_RENAME: Record<string, string> = {
  bind: 'beforeMount',
  inserted: 'mounted',
  update: 'updated',
  componentUpdated: 'updated',
  unbind: 'unmounted',
}

/** 指令 hook 对象字面量是否"看起来像"指令定义 */
function isDirectiveHookObject(node: t.Node | null | undefined): boolean {
  if (!node || !t.isObjectExpression(node)) return false
  return node.properties.some((p) => {
    if (t.isObjectProperty(p) && t.isIdentifier(p.key)) {
      return p.key.name in HOOK_RENAME
    }
    if (t.isObjectMethod(p) && t.isIdentifier(p.key)) {
      return p.key.name in HOOK_RENAME
    }
    return false
  })
}

/**
 * 处理单个对象字面量（指令定义）里的 hook 重命名。
 * 返回是否有改动，以及是否有冲突需要人工 review。
 */
function renameHooksInObject(obj: t.ObjectExpression, mark: (m: string) => void): { changed: boolean; conflict: boolean } {
  let changed = false
  let conflict = false
  const updatedKeys = new Set<string>()

  for (const prop of obj.properties) {
    let key: t.Identifier | null = null
    if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
      key = prop.key
    } else if (t.isObjectMethod(prop) && t.isIdentifier(prop.key)) {
      key = prop.key
    }
    if (!key) continue
    const oldName = key.name
    const newName = HOOK_RENAME[oldName]
    if (!newName) continue

    if (newName === 'updated' && updatedKeys.has('updated')) {
      // 冲突：已存在 updated，需要合并或保留其中一个
      // 简单策略：把这个改名成 `updated_legacy_<旧名>`
      key.name = `updated_legacy_${oldName}`
      conflict = true
      changed = true
      mark(`directive hook conflict: ${oldName} (renamed to ${key.name}, please merge manually)`)
    } else {
      key.name = newName
      updatedKeys.add(newName)
      changed = true
      mark(`directive hook: ${oldName} → ${newName}`)
    }
  }
  return { changed, conflict }
}

/** 规则主体：处理 script 端指令 hook 重命名 */
export function applyDirectiveHookRename(
  file: any,
  utils: any,
): void {
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  // 1) 组件选项里的 directives: { ... }
  traverse(ast, {
    ObjectProperty(path: any) {
      const node = path.node
      if (!t.isIdentifier(node.key, { name: 'directives' })) return
      if (!t.isObjectExpression(node.value)) return

      for (const directiveProp of node.value.properties) {
        // 两种写法：
        //   directives: { 'name': { bind, ... } }   —— ObjectProperty
        //   directives: { myDir: { ... } }         —— ObjectProperty shorthand
        let inner: t.ObjectExpression | null = null
        if (t.isObjectProperty(directiveProp) && t.isObjectExpression(directiveProp.value)) {
          inner = directiveProp.value
        }
        if (!inner) continue
        const r = renameHooksInObject(inner, utils.markChanged)
        if (r.changed) {
          utils.markChanged('directive hooks renamed')
        }
      }
    },
  })

  // 2) 全局注册 Vue.directive('name', { bind, ... })
  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      if (
        !t.isMemberExpression(node.callee) ||
        !t.isIdentifier(node.callee.object, { name: 'Vue' }) ||
        !t.isIdentifier(node.callee.property, { name: 'directive' })
      ) {
        return
      }
      // 第二个参数是 hook 对象
      if (node.arguments.length < 2) return
      const second = node.arguments[1]
      if (!t.isObjectExpression(second)) return
      const r = renameHooksInObject(second, utils.markChanged)
      if (r.changed) {
        utils.markChanged('Vue.directive() hooks renamed')
      }
    },
  })
}
