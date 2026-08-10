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
      !/\bnew\s+VueRouter\s*\(/.test(source) &&
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

    // ─── Pass 0: 清理 Vue.use(Router) / Vue.use(VueRouter) ───
    // vue-router 4 不再走 Vue.use(plugin) 安装。Vue 2 的 router/index.js 几乎一定有
    // 一行 `Vue.use(Router)` 用来挂载全局 Router；如果留着不处理，Pass B/D 会把
    // `import Router from 'vue-router'` 删掉，剩下 `Vue.use(Router)` 就成了
    // 对未 import 变量 Router 的引用，模块加载直接 ReferenceError。
    //
    // 必须放在所有改 import 的 pass 之前, 这样还能用 path.scope.getBinding(name)
    // 准确判断 Router / VueRouter 在文件里是否真的被 import 过。
    //
    // 处理策略:
    //   - 参数是 Router/VueRouter 且已绑定(import 进来) → 删整行 (安全)
    //   - 参数是 Router/VueRouter 但未绑定 (typo / 别名引用) → 标 review, 不删
    //   - 参数是其他 name 且未绑定 → 标 review, 不删 (用户可能用了其他东西)
    //   - 参数是其他 name 且已绑定 → 不动 (是自定义插件, 不在 vue-router-v4 职责内)
    traverse(ctx.file.scriptAst, {
      ExpressionStatement(path: any) {
        const expr = path.node.expression
        if (!t.isCallExpression(expr)) return
        const callee = expr.callee
        if (
          !t.isMemberExpression(callee) ||
          callee.computed ||
          !t.isIdentifier(callee.object, { name: 'Vue' }) ||
          !t.isIdentifier(callee.property, { name: 'use' })
        ) {
          return
        }
        if (expr.arguments.length < 1) return
        const arg = expr.arguments[0]
        if (!t.isIdentifier(arg)) return

        const name = arg.name
        const binding = path.scope.getBinding(name)
        const isKnownRouterName = name === 'Router' || name === 'VueRouter'

        if (isKnownRouterName && binding) {
          // 已知是 vue-router 2/3 的 install 调用, 变量也确实在 scope 内 → 安全删
          path.remove()
          changed = true
          return
        }

        if (!binding) {
          // 未绑定的引用 — 不删整行 (用户可能用了其他东西), 标 review 让用户确认
          const hint = isKnownRouterName
            ? `vue-router 4 不再需要 Vue.use(plugin) 安装，请手动删除该行。`
            : `如果这是自定义插件，请改为对应的 createApp.use() 链；否则请手动删除该行。`
          reviewItems.push(
            `检测到 \`Vue.use(${name})\` 引用了未 import/未声明的变量 \`${name}\`。${hint}`,
          )
        }
        // 其他情况 (自定义 name 且已绑定) → 不动, 不是 vue-router-v4 关心的事
      },
    })

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
        // iter-035 扩展: 也支持 `import VueRouter from 'vue-router'` + `new VueRouter(...)`（Vue 2 默认 import 形式）
        const isUsedAsRouter =
          defaultSpec || // 之前以 Router/VueRouter 为名导入
          /\bnew\s+Router\s*\(/.test(source) || // 直接在文件里有 new Router
          /\bnew\s+VueRouter\s*\(/.test(source) || // iter-035: Vue 2 默认 import 形式
          // 检查 import specifier 的 imported name 是 Router
          namedSpecs.some((s: any) => t.isIdentifier(s.imported) && s.imported.name === 'Router')

        if (isUsedAsRouter) {
          // 重置 specifiers 为空，由后续按需添加
          path.node.specifiers = []
          needsCreateRouter = true
          // P1-3: needsCreateWebHashHistory / needsCreateWebHistory 在 Pass C 里
          //   根据实际 mode 精确设置 — 不在这里一刀切,避免 import 未使用的 factory
          changed = true
        }
      },
    })

    // ─── Pass C: 处理 new Router({...}) → createRouter({...}) ───
    // iter-035: 也处理 new VueRouter({...})（Vue 2 默认 import 形式）
    traverse(ctx.file.scriptAst, {
      NewExpression(path: any) {
        const calleeName = t.isIdentifier(path.node.callee) ? path.node.callee.name : null
        if (calleeName !== 'Router' && calleeName !== 'VueRouter') return
        const args = path.node.arguments
        if (args.length === 0) return
        const options = args[0]
        if (!t.isObjectExpression(options)) return

        // 提取 mode（默认 'hash'，除非显式 'abstract'）
        let mode: 'hash' | 'history' | 'abstract' = 'hash'
        let hasMode = false
        // P1-3: Vue Router 4 移除了 `strict` 配置项（默认行为已等价于 strict: true）。
        //   检出后丢弃，并 review 通知用户。
        let hasStrict = false
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
          // P1-3: 丢弃 `strict` 属性（Vue Router 4 已移除该选项）
          if (t.isIdentifier(key) && key.name === 'strict') {
            hasStrict = true
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

        // P1-3: 只 import 实际使用的 history factory（精确匹配，避免未用 import）
        if (mode === 'history') {
          needsCreateWebHistory = true
        } else {
          // 'hash' | 'abstract' 都用 createWebHashHistory（abstract 已废弃 → 兜底为 hash）
          needsCreateWebHashHistory = true
        }

        // 构造 createRouter({...})
        const newObj = t.objectExpression(keptProps)
        const createRouterCall = t.callExpression(t.identifier('createRouter'), [newObj])

        // iter-035: 检测箭头函数 wrapper `const x = () => new Router({...})`
        //   这种模式下直接 `path.replaceWith(createRouter({...}))` 会导致 `const x = () => createRouter({...})` 递归
        //   修复: 如果 parent 是 ArrowFunctionExpression 且 grandparent 是 VariableDeclarator,
        //         整个 VariableDeclarator 替换成 `const x = createRouter({...})`
        // babel traverse 的 path.parent 是 node,要用 parentPath 拿到 path
        const parentPath = path.parentPath
        const grandPath = parentPath?.parentPath
        const parent = parentPath?.node
        const grand = grandPath?.node
        if (
          parent &&
          t.isArrowFunctionExpression(parent) &&
          grand &&
          t.isVariableDeclarator(grand) &&
          t.isIdentifier(grand.id)
        ) {
          // 整个 VariableDeclarator 替换
          // iter-035: rename 避免跟后续 const 冲突
          //   原 const 可能是 'createRouter'(跟 import createRouter 冲突) 或 'router'(跟后续 const router 冲突)
          //   用不会冲突的内部名 `__routerInstance__`,让用户后续重命名
          //
          // iter-044a (Bug A1): 如果 wrapper 名是 'createRouter' (跟 import 撞名), 不能用
          //   `__routerInstance__` 中转 — 那样下游 `const router = createRouter()` 调用会变成
          //   对 import createRouter 的无参调用, routes undefined, app 启动即崩。
          //   修复: 整体展开 wrapper, 让 downstream `const router = createRouter()` 直接拿到
          //   createRouter({...options}) 的真实调用结果。
          //   - 把 `const createRouter = () => new Router({...})` 整条删掉
          //   - 把 `const router = createRouter()` 替换为 `const router = createRouter({...options})`
          const wrapperId = grand.id as t.Identifier
          if (wrapperId.name === 'createRouter') {
            // 找到 wrapper 声明 (grandPath 是 VariableDeclarator, 其 parent 是 VariableDeclaration)
            const wrapperDeclPath = grandPath?.parentPath
            if (wrapperDeclPath) {
              // 1. 删掉整个 `const createRouter = () => new Router({...})` 声明
              wrapperDeclPath.remove()
            }
            // 2. 找下游 `const router = createRouter()` 调用, 替换为 `const router = createRouter({...options})`
            //    - 限定在 Program 直接子节点里找 (避免误伤嵌套 const)
            //    - VariableDeclarator id 名为 'router' 且 init 为 createRouter() 无参调用
            const programNode = (ctx.file.scriptAst as any).program
            if (programNode && programNode.body) {
              for (const stmt of programNode.body) {
                if (
                  t.isVariableDeclaration(stmt) &&
                  stmt.declarations.length === 1
                ) {
                  const d = stmt.declarations[0]
                  if (
                    t.isVariableDeclarator(d) &&
                    t.isIdentifier(d.id, { name: 'router' }) &&
                    t.isCallExpression(d.init) &&
                    t.isIdentifier(d.init.callee, { name: 'createRouter' }) &&
                    d.init.arguments.length === 0
                  ) {
                    // 替换: const router = createRouter({...options})
                    d.init = createRouterCall
                    reviewItems.push(
                      '检测到 `const createRouter = () => new Router({...})` 模式 (跟 vue-router 4 的 createRouter 撞名)，已就地展开: 删除 wrapper 并把下游 `const router = createRouter()` 替换为 `const router = createRouter({...options})`。',
                    )
                    break
                  }
                }
              }
            }
            // 3. resetRouter 函数里也有 `createRouter()` 无参调用, Vue Router 4 没有 .matcher, 标 manual review
            //    扫描 file.source 找形如 `router.matcher = xxx.matcher` 的代码
            if (/router\.matcher\s*=/.test(ctx.file.source)) {
              reviewItems.push(
                '检测到 `resetRouter()` 函数使用了 Vue Router 3 的 `router.matcher = newRouter.matcher`。Vue Router 4 没有 `.matcher` 属性,需要手动改写 resetRouter (常见做法: removeRoute + addRoute 重建 routes,或保留路由实例不动)。原函数体未自动改写,运行时调用会报错。',
              )
            }
          } else {
            const newIdName = '__routerInstance__'
            const newId = t.identifier(newIdName)
            const newDecl = t.variableDeclarator(newId, createRouterCall)
            grandPath!.replaceWith(newDecl)
          }
        } else {
          path.replaceWith(createRouterCall)
        }
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
        if (hasStrict) {
          // P1-3: 通知用户 strict 字段已被移除
          reviewItems.push(
            'Vue Router 4 已移除 `strict` 配置项（行为上现在默认就是严格匹配尾部斜杠）。原 `strict: <expr>` 已自动删除，无需手动处理。',
          )
        }
      },
    })

    // ─── Pass D: 清理 import { Router } 形式的 import ───
    // iter-035: 也清理 `import VueRouter from 'vue-router'` default specifier
    traverse(ctx.file.scriptAst, {
      ImportDeclaration(path: any) {
        const node = path.node
        if (!t.isStringLiteral(node.source, { value: 'vue-router' }))
        return
        // 如果还有 named specifier 'Router'，删除
        // 如果还有 default specifier (VueRouter)，也删除（用 createRouter 替代）
        node.specifiers = node.specifiers.filter((s: any) => {
          if (t.isImportSpecifier(s) && t.isIdentifier(s.imported) && s.imported.name === 'Router') {
            return false
          }
          if (t.isImportDefaultSpecifier(s)) {
            return false
          }
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
    // 如果整个 import 都没 specifier 了，连整条 import 也删掉（避免留下无意义的 `import 'vue';` 副作用 import）
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
              // 如果整个 import 都没 specifier 了，整条删掉
              if (path.node.specifiers.length === 0) {
                path.remove()
              }
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
