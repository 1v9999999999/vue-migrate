/**
 * 规则 E.8 - E.12: this.$message / $msgbox / $notify / $alert / $confirm / $loading
 *  → ElMessage / ElMessageBox / ElNotification / ElMessageBox.alert / etc.
 *
 * Vue2 中 ElementUI 把全局方法挂在 Vue.prototype 上，组件里通过 this.$xxx 调用。
 * Vue3 中 Element Plus 不再挂全局，需要 import 然后直接调用。
 *
 * 转换规则：
 *   this.$message('xxx')         → ElMessage('xxx')
 *   this.$message.success('xxx') → ElMessage.success('xxx')
 *   this.$msgbox.xxx             → ElMessageBox.xxx
 *   this.$notify({...})          → ElNotification({...})
 *   this.$alert('xxx', 'title')  → ElMessageBox.alert('xxx', 'title')
 *   this.$confirm('xxx', 'title')→ ElMessageBox.confirm('xxx', 'title')
 *   this.$prompt(...)            → ElMessageBox.prompt(...)
 *   this.$loading(...)           → ElLoading(...)
 *
 * 同时收集所有用到的 API，自动添加 import。
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse

/** ElementUI 全局方法 → Element Plus 具名导出映射 */
const GLOBAL_METHODS: Record<string, string> = {
  '$message': 'ElMessage',
  '$msgbox': 'ElMessageBox',
  '$notify': 'ElNotification',
  '$alert': 'ElMessageBox',
  '$confirm': 'ElMessageBox',
  '$prompt': 'ElMessageBox',
  '$loading': 'ElLoading',  // Element Plus 改成 ElLoading.service（特殊处理）
}

/** alert/confirm/prompt 的子方法名（用于 this.$alert = this.$msgbox.alert） */
const SUB_METHODS: Record<string, string> = {
  '$alert': 'alert',
  '$confirm': 'confirm',
  '$prompt': 'prompt',
}

/** ElMessageBox.alert/confirm/prompt 的固定前缀 */
const BOX_PREFIX: Record<string, string> = {
  '$alert': 'alert',
  '$confirm': 'confirm',
  '$prompt': 'prompt',
}

/** ElNotification 链式调用支持的 type 集合（Element Plus 用 type 字段） */
const NOTIFY_TYPES = new Set(['success', 'error', 'warning', 'info'])

/** 收集到的需要 import 的 API（避免重复） */
export function collectUsedApis(ctx: TransformContext): Set<string> {
  const used = new Set<string>()

  if (!ctx.file.scriptAst) return used

  traverse(ctx.file.scriptAst, {
    MemberExpression(path: any) {
      const node = path.node
      // this.$xxx
      if (
        t.isThisExpression(node.object) &&
        t.isIdentifier(node.property) &&
        GLOBAL_METHODS[node.property.name]
      ) {
        const method = node.property.name
        const target = GLOBAL_METHODS[method]
        used.add(target)
        // 如果是 $alert/$confirm/$prompt，需要 ElMessageBox
        if (method in BOX_PREFIX) {
          used.add('ElMessageBox')
        }
        if (method === '$loading') {
          used.add('ElLoading')
        }
      }
    },
  })

  return used
}

/** 把 this.$xxx 替换成 ElXxx，自动添加 import */
export function replaceGlobalMethods(
  ctx: TransformContext,
  usedApis: Set<string>,
): void {
  if (!ctx.file.scriptAst) return

  traverse(ctx.file.scriptAst, {
    CallExpression(path: any) {
      // 处理 ElNotification.error/success/warning/info(...) 形式
      // composition (priority 0) 先跑，把 this.$notify.error → ElNotification.error
      // 这里把 ElNotification.error(obj) → ElNotification({ type: 'error', ...obj })
      const node = path.node
      if (
        !t.isMemberExpression(node.callee) ||
        !t.isIdentifier(node.callee.object) ||
        node.callee.object.name !== 'ElNotification' ||
        !t.isIdentifier(node.callee.property) ||
        !NOTIFY_TYPES.has(node.callee.property.name)
      ) {
        return
      }
      const sub = node.callee.property.name
      const args = node.arguments
      // 构造 ElNotification({ type: 'error', ...args })
      const props: any[] = [
        t.objectProperty(t.identifier('type'), t.stringLiteral(sub)),
      ]
      if (args.length > 0) {
        if (args.length === 1 && t.isObjectExpression(args[0])) {
          // ElNotification.error({title, message, offset}) → ElNotification({ type: 'error', title, message, offset })
          const objArgs = args[0] as any
          for (const p of objArgs.properties) {
            if (
              t.isObjectProperty(p) &&
              t.isIdentifier(p.key) &&
              p.key.name !== 'type'
            ) {
              props.push(p)
            }
          }
        } else {
          // ElNotification.error('msg', {opts}) → ElNotification({ type: 'error', message: 'msg', ...opts })
          props.push(
            t.objectProperty(t.identifier('message'), args[0] as any),
          )
          if (args.length >= 2 && t.isObjectExpression(args[1])) {
            const objArgs = args[1] as any
            for (const p of objArgs.properties) {
              props.push(p)
            }
          }
        }
      }
      const newCall = t.callExpression(t.identifier('ElNotification'), [
        t.objectExpression(props),
      ])
      path.replaceWith(newCall)
      ctx.utils.markChanged(`ElNotification.${sub}(...) → ElNotification({ type: '${sub}', ... })`)
    },
    MemberExpression(path: any) {
      const node = path.node
      const parentPath = path.parentPath
      if (
        !t.isThisExpression(node.object) ||
        !t.isIdentifier(node.property) ||
        !GLOBAL_METHODS[node.property.name]
      ) {
        return
      }

      const method = node.property.name
      const target = GLOBAL_METHODS[method]

      // this.$alert / $confirm / $prompt 特殊处理：
      // Vue2: this.$alert('msg', 'title', opts)
      // Vue3: ElMessageBox.alert('msg', 'title', opts)
      if (method in BOX_PREFIX) {
        const sub = BOX_PREFIX[method]
        // 把 this 替换成 ElMessageBox，property 改成 .alert/.confirm/.prompt
        node.object = t.identifier('ElMessageBox')
        node.property = t.identifier(sub)
        // computed: false（默认就行）
        ctx.utils.markChanged(`this.${method} → ElMessageBox.${sub}`)
        return
      }

      // this.$loading 特殊处理：this.$loading(opts) → ElLoading.service(opts)
      if (method === '$loading') {
        // 把 this.$loading 替换成 ElLoading.service
        // 即 this.$loading 节点替换成 MemberExpression { object: ElLoading, property: service }
        const memberExpr = t.memberExpression(
          t.identifier('ElLoading'),
          t.identifier('service'),
        )
        path.replaceWith(memberExpr)
        ctx.utils.markChanged('this.$loading → ElLoading.service')
        return
      }

      // this.$notify.xxx 特殊处理：
      // Vue2: this.$notify.success('msg') / .error('msg') / .warning('msg') / .info('msg')
      // Vue3: ElNotification({ type: 'success' | 'error' | 'warning' | 'info', message: 'msg' })
      // Element Plus 的 ElNotification 是单一函数调用，没有 .success/.error 等链式方法
      if (method === '$notify') {
        // path 是 this.$notify，parent 必须是 this.$notify.xxx
        // (我们用 parentPath 拿到 parent 节点的对象形式)
        const parentNode = path.parent
        if (
          t.isMemberExpression(parentNode) &&
          parentNode.object === node &&
          t.isIdentifier(parentNode.property) &&
          NOTIFY_TYPES.has(parentNode.property.name)
        ) {
          const sub = parentNode.property.name
          // grandparent 必须是 CallExpression (this.$notify.error(msg))
          const grandPath = parentPath?.parentPath
          const grandNode = grandPath?.node
          if (
            grandPath &&
            t.isCallExpression(grandNode) &&
            grandNode.callee === parentNode
          ) {
            const args = grandNode.arguments
            // 构造 ElNotification({ type: 'error', message: arg0, ...arg1 })
            const props: any[] = [
              t.objectProperty(t.identifier('type'), t.stringLiteral(sub)),
            ]
            if (args.length > 0) {
              if (args.length === 1 && t.isObjectExpression(args[0])) {
                // this.$notify.error({...}) → ElNotification({ type: 'error', ...props })
                const objArgs = args[0] as any
                for (const p of objArgs.properties) {
                  if (
                    t.isObjectProperty(p) &&
                    t.isIdentifier(p.key) &&
                    p.key.name !== 'type'
                  ) {
                    props.push(p)
                  }
                }
              } else {
                // this.$notify.error('msg', {duration: 3000}) → ElNotification({ type: 'error', message: 'msg', duration: 3000 })
                props.push(
                  t.objectProperty(t.identifier('message'), args[0] as any),
                )
                if (args.length >= 2 && t.isObjectExpression(args[1])) {
                  const objArgs = args[1] as any
                  for (const p of objArgs.properties) {
                    props.push(p)
                  }
                }
              }
            }
            // 替换成 ElNotification({...})
            const newCall = t.callExpression(t.identifier('ElNotification'), [
              t.objectExpression(props),
            ])
            grandPath.replaceWith(newCall)
            ctx.utils.markChanged(`this.$notify.${sub}(...) → ElNotification({ type: '${sub}', ... })`)
            return
          }
        }
        // 其他情况 (this.$notify({...}) 或其他) → 简单替换为 ElNotification
      }

      // this.$message / $msgbox / $notify 普通替换
      // Vue2: this.$message.xxx('msg') 或 this.$message('msg')
      // Vue3: ElMessage.xxx('msg') 或 ElMessage('msg')
      // 把整个 this.$message 节点替换成 Identifier(target)
      // 链式情况下：外层 this.$message.success 会变成 ElMessage.success ✅
      // 直接调用情况下：this.$message(...) 会变成 ElMessage(...) ✅
      path.replaceWith(t.identifier(target))
      ctx.utils.markChanged(`this.${method} → ${target}`)
    },
  })
}

/** 添加 ElMessage / ElMessageBox 等 import */
export function ensureElementPlusImports(
  ctx: TransformContext,
  apis: Set<string>,
): void {
  if (apis.size === 0) return
  if (!ctx.file.scriptAst) return
  if (!t.isFile(ctx.file.scriptAst)) return

  // 收集所有 element-plus import (可能有多个 — Vue2 常把 default + named 拆成两条)
  const elementPlusImports: t.ImportDeclaration[] = []
  for (const stmt of ctx.file.scriptAst.program.body) {
    if (t.isImportDeclaration(stmt) && t.isStringLiteral(stmt.source) && stmt.source.value === 'element-plus') {
      elementPlusImports.push(stmt)
    }
  }

  // 取第一个作为主 import; 其它合并进来然后删掉
  const primary = elementPlusImports[0]
  const duplicates = elementPlusImports.slice(1)

  // 只统计 primary 里已有的 (用于去重)
  const primaryNames = new Set<string>()
  if (primary) {
    for (const spec of primary.specifiers) {
      if (t.isImportSpecifier(spec)) {
        primaryNames.add((spec.imported as t.Identifier).name)
        primaryNames.add(spec.local.name)
      } else if (t.isImportDefaultSpecifier(spec)) {
        primaryNames.add('default')
      } else if (t.isImportNamespaceSpecifier(spec)) {
        primaryNames.add('*')
      }
    }
  }

  if (primary) {
    // 把 duplicate 里的 specifier 全部搬到 primary (避免重复声明)
    for (const dup of duplicates) {
      for (const spec of dup.specifiers) {
        if (t.isImportSpecifier(spec)) {
          const local = spec.local.name
          const imported = (spec.imported as t.Identifier).name
          // 跳过 primary 里已存在的 (避免重复声明)
          if (primaryNames.has(imported) || primaryNames.has(local)) continue
          primary.specifiers.push(spec)
          primaryNames.add(imported)
          primaryNames.add(local)
        } else if (t.isImportDefaultSpecifier(spec)) {
          if (primaryNames.has('default')) continue
          primary.specifiers.push(spec)
          primaryNames.add('default')
        } else if (t.isImportNamespaceSpecifier(spec)) {
          if (primaryNames.has('*')) continue
          primary.specifiers.push(spec)
          primaryNames.add('*')
        }
      }
      // 删掉重复 import
      const idx = ctx.file.scriptAst.program.body.indexOf(dup)
      if (idx >= 0) ctx.file.scriptAst.program.body.splice(idx, 1)
    }
    // 追加新 API (用 primaryNames 在 merge 之后的快照去重)
    for (const name of apis) {
      if (primaryNames.has(name)) continue
      primary.specifiers.push(
        t.importSpecifier(t.identifier(name), t.identifier(name)),
      )
      primaryNames.add(name)
    }
  } else {
    const toAddList = [...apis].filter((n) => !primaryNames.has(n))
    const newImport = t.importDeclaration(
      toAddList.map((n) => t.importSpecifier(t.identifier(n), t.identifier(n))),
      t.stringLiteral('element-plus'),
    )
    // 插入到所有 import 之后
    const bodyArr = ctx.file.scriptAst.program.body as any[]
    let lastImportIdx = -1
    for (let i = bodyArr.length - 1; i >= 0; i--) {
      if (t.isImportDeclaration(bodyArr[i])) { lastImportIdx = i; break }
    }
    if (lastImportIdx >= 0) {
      ctx.file.scriptAst.program.body.splice(lastImportIdx + 1, 0, newImport)
    } else {
      ctx.file.scriptAst.program.body.unshift(newImport)
    }
    if (toAddList.length > 0) {
      ctx.utils.markChanged(`added element-plus imports: ${toAddList.join(', ')}`)
    }
  }
  if (duplicates.length > 0) {
    ctx.utils.markChanged(`merged ${duplicates.length} duplicate element-plus import(s)`)
  }
}
