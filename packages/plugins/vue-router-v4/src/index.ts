/**
 * @vue-migrate/plugin-vue-router-v4
 *
 * vue-router 2/3 → vue-router 4 转换
 *
 * 转换规则：
 *   R.1  import Router from 'vue-router' → import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
 *   R.2  Vue.use(Router) → 移除（vue-router 4 不再需要 install）
 *   R.3  new Router({...}) → createRouter({...})
 *   R.4  mode: 'hash' / 不指定 → history: createWebHashHistory()
 *   R.5  mode: 'history' → history: createWebHistory()
 *   R.6  require.ensure([deps], fn, chunkName)  →  () => import('spec') with chunk name comment
 *   R.7  this.$router / this.$route 在 .vue 文件里由 composition 插件处理
 *
 * 优先级：9（在 vue2-compat 之后）
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse

interface ModeInfo {
  /** 'hash' | 'history' | 'abstract' | null */
  mode: 'hash' | 'history' | 'abstract' | null
}

const plugin: TransformPlugin = {
  name: 'vue-router-v4',
  description:
    'Migrate vue-router 2/3 to vue-router 4: imports, require.ensure, new Router → createRouter, mode → history factory.',
  priority: 9, // after vue2-compat (10), same as vue3-entry

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    if (!ctx.file.scriptAst)
    return
    const source = ctx.file.source

    // 只处理含 vue-router 相关代码的文件
if (
      !/from\s+['"]vue-router['"]/.test(source) &&
      !/\bnew\s+Router\s*\(/.test(source) &&
      !/\brequire\.ensure\s*\(/.test(source)
    ) {
      return
    }

    let changed = false
    const reviewItems: string[] = []

    // 收集需要的 vue-router 名字
    let needsCreateRouter = false
    let needsCreateWebHashHistory = false
    let needsCreateWebHistory = false

    // ─── Pass A: 处理 require.ensure → () => import() ───
    traverse(ctx.file.scriptAst, {
      CallExpression(path: any) {
        const node = path.node
        // require.ensure(...) - callee 是 MemberExpression
        const callee = node.callee
        if (
          !t.isMemberExpression(callee) ||
          !t.isIdentifier(callee.object, { name: 'require' }) ||
          !t.isIdentifier(callee.property, { name: 'ensure' })
        ) {
          return
        }

        // 形式：require.ensure([], () => r(require('spec')), 'chunkName')
        // 提取 spec 和 chunkName
        if (node.arguments.length < 2) return
        const deps = node.arguments[0] // 第一个参数：依赖数组（忽略）
        const cb = node.arguments[1]    // 第二个参数：回调
        const chunkName = node.arguments[2]  // 第三个参数：chunk 名

        let specifier: string | null = null
        if (t.isFunction(cb) && !(cb as any).async) {
          // find require('xxx') call inside the callback
          traverse(cb, {
            CallExpression(p: any) {
              const inner = p.node
              if (
                t.isCallExpression(inner) &&
                t.isIdentifier(inner.callee, { name: 'require' }) &&
                inner.arguments.length === 1 &&
                t.isStringLiteral(inner.arguments[0])
              ) {
                specifier = inner.arguments[0].value
                p.stop()
              }
            },
            noScope: true,
          })
        }

        let chunkNameStr: string | null = null
        if (t.isStringLiteral(chunkName)) {
          chunkNameStr = chunkName.value
        }

        if (specifier) {
          // 替换为 () => import(/* webpackChunkName: "xxx" */ 'spec')
          const importCall = t.callExpression(t.import(), [t.stringLiteral(specifier)])
          if (chunkNameStr) {
            // 给 import() 调用附加 leadingComment
            importCall.leadingComments = [
              {
                type: 'CommentBlock',
                value: ` webpackChunkName: "${chunkNameStr}" `,
              } as any,
            ]
          }
          const newArrow = t.arrowFunctionExpression([], importCall)
          path.replaceWith(newArrow)
          changed = true
        } else {
          reviewItems.push(
            `require.ensure() 调用无法自动转 import()（未找到 r(require('...')) 模式）。请手动改用 import()。`,
          )
        }
      },
    })

    // ─── Pass B: 处理 import 改造 ───
    traverse(ctx.file.scriptAst, {
      ImportDeclaration(path: any) {
        const node = path.node
        if (!t.isStringLiteral(node.source)) return
        const src = node.source.value
        if (src !== 'vue-router') return

        // 当前 specifiers
const specifiers = node.specifiers

        // 检查是否有 `
        // 也支持 `import Router from 'vue-router'` 这种 default 形式
        // 也支持 `import { ... } from 'vue-router'` 这种 named 形式
        const defaultSpec = specifiers.find((s: any) => t.isImportDefaultSpecifier(s))
        const namedSpecs = specifiers.filter((s: any) => t.isImportSpecifier(s))

        // 检查是否需要：new Router 或 Vue.use(Router) 或 import Router from 'vue-router'
        const isUsedAsRouter =
          defaultSpec || // 之前以 Router 为名导入
          /\bnew\s+Router\s*\(/.test(source) || // 直接在文件里有 new Router
          // 检查 import specifier 的 imported name 是 Router
          namedSpecs.some((s: any) => t.isIdentifier(s.imported) && s.imported.name === 'Router')

        if (isUsedAsRouter) {
          // 重置 specifiers 为空，由后续按需添加
          path.node.specifiers = []
          needsCreateRouter = true
          needsCreateWebHashHistory = true
          needsCreateWebHistory = true
          changed = true
        }
      },
    })

    // ─── Pass C: 处理 new Router({...}) → createRouter({...}) ───
    traverse(ctx.file.scriptAst, {
      NewExpression(path: any) {
        if (!t.isIdentifier(path.node.callee, { name: 'Router' })) return
        const args = path.node.arguments
        if (args.length === 0) return
        const options = args[0]
        if (!t.isObjectExpression(options)) return

        // 提取 mode（默认 'hash'，除非显式 'abstract'）
        let mode: 'hash' | 'history' | 'abstract' = 'hash'
        let hasMode = false
        const keptProps: t.ObjectProperty[] = []
        for (const prop of options.properties) {
          if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) {
            keptProps.push(prop as any)
            continue
          }
          const key = (prop as any).key
          if (t.isIdentifier(key) && key.name === 'mode') {
            hasMode = true
            if (t.isStringLiteral((prop as any).value)) {
              const v = (prop as any).value.value
              if (v === 'hash' || v === 'history' || v === 'abstract') {
                mode = v
              }
            }
            // 不保留 mode（vue-router 4 用 history factory）
            continue
          }
          keptProps.push(prop as any)
        }

        // 添加 history 字段
const historyCall =
          mode === 'history'
            ? t.callExpression(t.identifier('createWebHistory'), [])
            : t.callExpression(t.identifier('createWebHashHistory'), [])

        const historyProp = t.objectProperty(t.identifier('history'), historyCall)
        keptProps.unshift(historyProp)

        // 构造 createRouter({...})
        const newObj = t.objectExpression(keptProps)
        const createRouterCall = t.callExpression(t.identifier('createRouter'), [newObj])
        path.replaceWith(createRouterCall)
        changed = true

        if (mode === 'abstract') {
          reviewItems.push(
            'Vue Router 3 的 mode: "abstract" 模式已被移除（仅服务端渲染测试用）。已默认改为 hash 模式，请确认是否符合预期。',
          )
        } else if (!hasMode) {
          // 没有显式 mode 时，默认是 hash
          reviewItems.push(
            '未指定 mode 的 new Router() 默认改为 createWebHashHistory()（vue-router 2/3 的默认值）。三种 mode 对应：hash→createWebHashHistory() (URL 带 #), history→createWebHistory() (需要服务端配合), abstract→createMemoryHistory() (Node/SSR 用, 无 URL)。如需 HTML5 history 模式，请改为 createWebHistory()。',
          )
        }
      },
    })

    // ─── Pass D: 清理 import { Router } 形式的 import ───
    traverse(ctx.file.scriptAst, {
      ImportDeclaration(path: any) {
        const node = path.node
        if (!t.isStringLiteral(node.source, { value: 'vue-router' }))
        return
        // 如果还有 named specifier 'Router'，删除
node.specifiers = node.specifiers.filter((s: any) => { if (t.isImportSpecifier(s) && t.isIdentifier(s.imported) && s.imported.name === 'Router') { return false }
return true
        })
      },
    })

    // ─── Pass E: 添加 vue-router 4 的 import ───
    if (needsCreateRouter || needsCreateWebHashHistory || needsCreateWebHistory) {
      const names: string[] = []
      if (needsCreateRouter) names.push('createRouter')
      if (needsCreateWebHashHistory) names.push('createWebHashHistory')
      if (needsCreateWebHistory) names.push('createWebHistory')
      if (needsCreateWebHashHistory) names.push('createWebHashHistory')
      if (needsCreateWebHistory) names.push('createWebHistory')
      if (needsCreateWebHistory) names.push('createWebHistory')

      // 找到现有的 vue-router import（或创建）
      const program = (ctx.file.scriptAst as any).program
      if (program && program.body) {
        let existing: any = null
        for (const stmt of program.body) {
          if (t.isImportDeclaration(stmt) && t.isStringLiteral(stmt.source, { value: 'vue-router' })) {
            existing = stmt
            break
          }
        }
        if (existing) {
          // 追加 specifier
for (const name of names) { const already = existing.specifiers.some(
              (s: any) => t.isImportSpecifier(s) && t.isIdentifier(s.imported, { name }),
            )
            if (!already) {
              existing.specifiers.push(t.importSpecifier(t.identifier(name), t.identifier(name)))
            }
          }
        } else {
          // 新建 import
          const decl = t.importDeclaration(
            names.map((n) => t.importSpecifier(t.identifier(n), t.identifier(n))),
            t.stringLiteral('vue-router'),
          )
          // 插入到 import 区（顶部）
          program.body.unshift(decl)
        }
        changed = true
      }
    }

    // ─── Pass F: 移除空 import 'vue-router' 声明（如果 specifier 都没了） ───
    traverse(ctx.file.scriptAst, {
      ImportDeclaration(path: any) {
        if (
          t.isStringLiteral(path.node.source, { value: 'vue-router' }) &&
          path.node.specifiers.length === 0
        ) {
          path.remove()
          changed = true
        }
      },
    })

    // ─── Pass G: 移除 import Vue（如果 Vue 在该文件中不再使用） ───
    // 简单方式：检查 import Vue from 'vue' 的 default specifier，若文件中没有 'Vue' identifier 引用则移除
    let vueIdentifierUsed = false
    traverse(ctx.file.scriptAst, {
      Identifier(path: any) {
        const parent = path.parent
        if (
          parent &&
          (parent.type === 'ImportSpecifier' ||
            parent.type === 'ImportDefaultSpecifier' ||
            parent.type === 'ImportNamespaceSpecifier')
        ) {
          return
        }
        if (path.node.name === 'Vue') {
          vueIdentifierUsed = true
        }
      },
    })
    if (!vueIdentifierUsed) {
      traverse(ctx.file.scriptAst, {
        ImportDeclaration(path: any) {
          if (!t.isStringLiteral(path.node.source, { value: 'vue' })) return
          // 检查是否有 default import 'Vue'
          const defaultIdx = path.node.specifiers.findIndex((s: any) => t.isImportDefaultSpecifier(s))
          if (defaultIdx < 0) return
          if (t.isImportDefaultSpecifier(path.node.specifiers[defaultIdx])) {
            const localName = (path.node.specifiers[defaultIdx] as any).local.name
            if (localName === 'Vue') {
              // 移除 default specifier
              path.node.specifiers.splice(defaultIdx, 1)
              changed = true
            }
          }
        },
      })
    }

    // 输出 review
for (const r of reviewItems) ctx.utils.manualReview(r)
if (changed) { ctx.utils.markChanged('vue-router 2/3 → 4') }
  },
}

registerPlugin(plugin)
export default plugin
