/**
 * @vue-migrate/plugin-vuex-pinia
 *
 * Vuex 3 → Pinia 转换
 *
 * 转换规则：
 *   P.1  import Vuex from 'vuex' → import { defineStore } from 'pinia'
 *   P.2  new Vuex.Store({state, getters, mutations, actions}) → export const useXxxStore = defineStore(...)
 *   P.3  state: { ... } → state: () => ({ ... })
 *   P.4  mutations 合并到 actions（Pinia 没有独立的 mutations）
 *   P.5  mutation(state, payload) → action(payload) { this.xxx = payload }
 *   P.6  commit('xxx', payload) → this.xxx(payload)
 *   P.7  actions: { foo({commit}) { ... } } → actions: { foo() { ... } }（移除 destructure）
 *
 * 优先级：9（与 vue-router-v4 / vue3-entry 一致）
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
// @ts-ignore
import _generate from '@babel/generator'
import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse
// @ts-ignore
const generate = (_generate as any).default || _generate

const plugin: TransformPlugin = {
  name: 'vuex-pinia',
  description: 'Migrate Vuex 3 Store to Pinia store: defineStore, state as function, merge mutations into actions.',
  priority: 9,

  fileKinds: ['js', 'ts', 'vue'],

  transform(ctx: TransformContext) {
    if (!ctx.file.scriptAst)
    return
    const source = ctx.file.source
    if (
      !/from\s+['"]vuex['"]/.test(source) &&
      !/\bnew\s+Vuex\.Store\s*\(/.test(source)
    ) {
      return
    }

    let changed = false
    const reviewItems: string[] = []

    // 收集 state / getters / mutations / actions 的源文本
let stateSource: string | null = null
    let gettersSource: string | null = null
    let mutationsSource: string | null = null
    let actionsSource: string | null = null

// collect const state / getters / mutations / actions = {...} declarations (for new Vuex.Store)
    traverse(ctx.file.scriptAst, {
      VariableDeclaration(path: any) {
        const decl = path.node.declarations[0]
        if (!t.isIdentifier(decl.id) || !t.isObjectExpression(decl.init))
        return
        const name = decl.id.name
        if (name === 'state') {
          stateSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
        } else if (name === 'getters') {
          gettersSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
        } else if (name === 'mutations') {
          mutationsSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
        } else if (name === 'actions') {
          actionsSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
        }
      },
    })

// find new Vuex.Store({...}) call
    let vuexStoreCall: any = null
    traverse(ctx.file.scriptAst, {
      NewExpression(path: any) {
        const node = path.node
        if (
          !t.isMemberExpression(node.callee) ||
          !t.isIdentifier(node.callee.object, { name: 'Vuex' }) ||
          !t.isIdentifier(node.callee.property, { name: 'Store' })
        ) {
          return
        }
        if (node.arguments.length === 1 && t.isObjectExpression(node.arguments[0])) {
          vuexStoreCall = node
        }
      },
    })

    if (vuexStoreCall) {
      const options = vuexStoreCall.arguments[0] as t.ObjectExpression

      // 从 options 提取 inline state/getters/mutations/actions
      // 优先用 inline 形式，否则用上面的
let inlineState: t.ObjectExpression | null = null
      let inlineGetters: t.ObjectExpression | null = null
      let inlineMutations: t.ObjectExpression | null = null
      let inlineActions: t.ObjectExpression | null = null
      for (const prop of options.properties) {
        if (!t.isObjectProperty(prop)) continue
        if (!t.isIdentifier(prop.key)) continue
        const key = (prop as any).key.name
        if (key === 'state' && t.isObjectExpression(prop.value)) inlineState = prop.value
        else if (key === 'getters' && t.isObjectExpression(prop.value)) inlineGetters = prop.value
        else if (key === 'mutations' && t.isObjectExpression(prop.value)) inlineMutations = prop.value
        else if (key === 'actions' && t.isObjectExpression(prop.value)) inlineActions = prop.value
      }

      const stateObj = inlineState || (stateSource ? parseObjectLiteral(stateSource) : null)
      const gettersObj = inlineGetters || (gettersSource ? parseObjectLiteral(gettersSource) : null)
      const mutationsObj = inlineMutations || (mutationsSource ? parseObjectLiteral(mutationsSource) : null)
      const actionsObj = inlineActions || (actionsSource ? parseObjectLiteral(actionsSource) : null)
      if (process.env.DEBUG_VUEX_PINIA) {
        const stateLen: number = (stateSource as any)?.length ?? 0
        const mutationsLen: number = (mutationsSource as any)?.length ?? 0
        const actionsLen: number = (actionsSource as any)?.length ?? 0
        console.log(`[vuex-pinia] stateSource len: ${stateLen}, parsed: ${!!stateObj}`)
        console.log(`[vuex-pinia] mutationsSource len: ${mutationsLen}, parsed: ${!!mutationsObj}`)
        console.log(`[vuex-pinia] actionsSource len: ${actionsLen}, parsed: ${!!actionsObj}`)
        console.log(`[vuex-pinia] inlineState: ${!!inlineState}, inlineMutations: ${!!inlineMutations}, inlineActions: ${!!inlineActions}`)
      }

      // 生成 Pinia store
      // 提取 export default 后的名字
      const storeName = inferStoreNameFromPath(ctx.file.path) || 'store'
      const exportName = 'use' + capitalize(storeName) + 'Store'

      // 构造属性
const props: t.ObjectProperty[] = []

      // state: () => ({...})
if (stateObj) { const stateFunc = t.arrowFunctionExpression(
          [],
          stateObj,
        )
        const stateProp = t.objectProperty(t.identifier('state'), stateFunc)
        props.push(stateProp)
      }

      // actions: { ...mutations合并进来, ...actions }
const actionsProps: t.ObjectProperty[] = []
      if (mutationsObj) {
        for (const m of mutationsObj.properties) {
          if (t.isObjectProperty(m) || t.isObjectMethod(m)) {
            // 转换 mutation(state, payload) → action(payload) { this.xxx = payload }
            const converted = convertMutationToAction(m as any)
            if (converted) actionsProps.push(converted)
          }
        }
      }
      if (actionsObj) {
        for (const a of actionsObj.properties) {
          if (t.isObjectProperty(a) || t.isObjectMethod(a)) {
            // 转换 action({commit, state}) → action()
            const dynamicCommits: string[] = []
            const converted = convertVuexAction(a, dynamicCommits)
            if (converted) actionsProps.push(converted)
            // 对动态 commit 名（不是字符串字面量）加 review note
for (const expr of dynamicCommits) {
              reviewItems.push(
                `dynamic commit(\`${expr}\`, ...) - mutation 名是表达式而非字符串字面量，需手动迁移到 Pinia 的 this.\`<expr>\` 或重构为 switch-case。`,
              )
            }
          }
        }
      }
      if (actionsProps.length > 0) {
        props.push(
          t.objectProperty(
            t.identifier('actions'),
            t.objectExpression(actionsProps),
          ),
        )
      }

      // getters: { foo: (state) => state.x }
      if (gettersObj) {
        const gettersProps: t.ObjectProperty[] = []
        for (const g of gettersObj.properties) {
          if (t.isObjectProperty(g) || t.isObjectMethod(g)) {
            const converted = convertVuexGetter(g)
            if (converted) gettersProps.push(converted)
          }
        }
        if (gettersProps.length > 0) {
          props.push(
            t.objectProperty(
              t.identifier('getters'),
              t.objectExpression(gettersProps),
            ),
          )
        }
      }

      // 构造 export const useStore = defineStore('store', {...})
      const defineStoreCall = t.callExpression(
        t.identifier('defineStore'),
        [t.stringLiteral(storeName), t.objectExpression(props)]
      )
      const exportDecl = t.exportNamedDeclaration(
        t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(exportName), defineStoreCall),
        ]),
        [],
      )

      // 替换 new Vuex.Store({...}) 为 export const useStore = defineStore(...)
      // 同时标记 export default 整行替换
      const vuexPath = findNewVuexStorePath(ctx.file.scriptAst)
      if (vuexPath) {
        // 找到 `new Vuex.Store(...)` 的 statement path
        const stmtPath = vuexPath.findParent((p: any) => p.isExpressionStatement() || p.isExportDefaultDeclaration())
        if (stmtPath) {
          stmtPath.replaceWith(exportDecl)
        } else {
          vuexPath.replaceWith(exportDecl)
        }
        changed = true
      }

      // 同时如果有 `export default xxx`，需要替换
      // 简化：删除 export default 整行（用户在 main.js 里 import 默认值会需要改）
      // 这里只标 review
      reviewItems.push(
        `Vuex Store 已转 Pinia。组件中的 \`this.$store\` 由 composition 插件处理；用 \`useXxxStore()\` (Xxx 是你的 store 名字) 替代 \`this.$store\`。注意 Pinia 没有 mutations — 把原 Vuex mutations 改成 actions (或直接修改 state)。`,
      )
    } else {
      // 仅有 import Vuex from 'vuex' 但没 new Vuex.Store — 标 review
      // 只在 file 实际用了 mapState/mapActions/mapMutations/mapGetters 时才加
      // （单纯 `import Vuex from 'vuex'` 但没用到的话，转换后代码仍可工作）
      let usedVuexHelpers = false
      traverse(ctx.file.scriptAst, {
        CallExpression(path: any) {
          const node = path.node
          if (
            t.isIdentifier(node.callee) &&
            /^(mapState|mapGetters|mapMutations|mapActions)$/.test(node.callee.name)
          ) {
            usedVuexHelpers = true
          } else if (
            t.isMemberExpression(node.callee) &&
            t.isIdentifier(node.callee.object) &&
            /^map(State|Getters|Mutations|Actions)$/.test(node.callee.object.name)
          ) {
            usedVuexHelpers = true
          }
        },
      })
      if (usedVuexHelpers) {
        reviewItems.push(
          '检测到 import Vuex + mapState/mapActions 等 helpers（但未找到 new Vuex.Store）。请手动迁移到 Pinia（推荐 defineStore + actions）。',
        )
      }
    }

    // 处理 import Vuex from 'vuex'（改为 pinia 的 defineStore）
    traverse(ctx.file.scriptAst, {
      ImportDeclaration(path: any) {
        if (!t.isStringLiteral(path.node.source, { value: 'vuex' }))
        return
        // 改为 import { defineStore } from 'pinia'
        path.node.source = t.stringLiteral('pinia')
        // 清空 specifiers
        path.node.specifiers = [
          t.importSpecifier(t.identifier('defineStore'), t.identifier('defineStore')),
        ]
        changed = true
      },
    })

    // Vue.use(Vuex) 移除（已由 vue3-entry 处理，但兜底再做一次）
    traverse(ctx.file.scriptAst, {
      ExpressionStatement(path: any) {
        const expr = path.node.expression
        if (
          t.isCallExpression(expr) &&
          t.isMemberExpression(expr.callee) &&
          t.isIdentifier(expr.callee.object, { name: 'Vue' }) &&
          t.isIdentifier(expr.callee.property, { name: 'use' }) &&
          expr.arguments.length === 1 &&
          t.isIdentifier(expr.arguments[0], { name: 'Vuex' })
        ) {
          path.remove()
          changed = true
        }
      },
    })

    for (const r of reviewItems) ctx.utils.manualReview(r)
    if (changed) ctx.utils.markChanged('vuex 3 → pinia')
  },
}

/**
 * 从 file path 推断 store 名：store/index.js → 'store'
 * store/modules/user.js → 'user'
 */
function inferStoreNameFromPath(filePath: string): string | null {
  if (!filePath)
  return null
  const parts = filePath.replace(/\\/g, '/').split('/')
  const base = parts[parts.length - 1].replace(/\.(js|ts|vue)$/, '')
  // 如果是 index，取上一级目录名
  if (base === 'index') {
    const parent = parts[parts.length - 2]
    if (parent && parent !== 'src' && parent !== 'lib' && parent !== 'dist') {
      return parent
    }
    return 'store'
  }
  return base
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function findNewVuexStorePath(ast: any): any {
  let found: any = null
  traverse(ast, {
    NewExpression(path: any) {
      const node = path.node
      if (
        t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object, { name: 'Vuex' }) &&
        t.isIdentifier(node.callee.property, { name: 'Store' })
      ) {
        found = path
      }
    },
  })
  return found
}

/**
 * 解析一段对象字面量源码为 ObjectExpression
 */
function parseObjectLiteral(source: string): t.ObjectExpression | null {
  try {
    // 替换 JSX 标签等
    const ast = _parse(`(${source})`, { sourceType: 'module' })
    const stmt = ast.program.body[0]
    if (t.isExpressionStatement(stmt) && t.isObjectExpression(stmt.expression)) {
      return stmt.expression
    }
    if (process.env.DEBUG_VUEX_PINIA) console.log(`[vuex-pinia] parseObjectLiteral: not ObjectExpression, got ${(stmt as any)?.expression?.type ?? stmt?.type}`)
    return null
  } catch (e: any) {
    if (process.env.DEBUG_VUEX_PINIA) console.log(`[vuex-pinia] parseObjectLiteral error: ${e.message?.substring(0, 200)}, source len: ${source.length}, first 50 chars: ${source.substring(0, 50)}`)
    return null
  }
}

// 在文件顶部加 _parse 别名
import { parse as _parse } from '@babel/parser'

/**
 * mutation(state, payload) { state.x = payload }
 * → action(payload) { this.x = payload }
 */
function convertMutationToAction(m: any): t.ObjectProperty | null {
  let key: t.Identifier | null = null
  let params: t.Function['params'] = []
  let body: t.BlockStatement | null = null
  let isAsync = false

  if (t.isObjectMethod(m)) {
    key = m.key as t.Identifier
    params = [...m.params]
    body = m.body
    isAsync = m.async
  } else if (t.isObjectProperty(m)) {
    if (!t.isIdentifier(m.key))
    return null
    key = m.key
    if (t.isFunctionExpression(m.value) || t.isArrowFunctionExpression(m.value)) {
      params = [...m.value.params]
      body = t.isBlockStatement(m.value.body)
        ? m.value.body
        : t.blockStatement([t.returnStatement(m.value.body)])
    }
  }
  if (!key || !body)
  return null

  // mutation 第一个参数通常是 state（如果只有一个参数，那个是 payload 不是 state）
  // 简单判断：如果 params[0] 名为 state，则移除；否则保留
  // 但有些 mutation 只有一个参数（payload），那时不应该移除
  // 启发式：如果 params.length >= 2 且 params[0].name === 'state'，则移除第一个
  if (params.length >= 2) {
    const first = params[0]
    if (t.isIdentifier(first) && first.name === 'state') {
      params = params.slice(1)
    }
  }

  // 替换 body 中 state.xxx = yyy → this.xxx = yyy
  replaceStateRefsInBody(body, 'this')

  // 构造方法（用 objectProperty + functionExpression 避免 objectMethod 的 key.computed 坑）
  const fn = t.functionExpression(null, params as any, body, false, isAsync)
  return t.objectProperty(key, fn, false) as any
}

/**
 * action({commit, state}) { commit('saveX', payload) ... }
 * → action() { this.saveX(payload) ... }
 */
function convertVuexAction(
  a: any,
  dynamicCommits?: string[],
): t.ObjectProperty | null {
  let key: t.Identifier | null = null
  let params: t.Function['params'] = []
  let body: t.BlockStatement | null = null
  let isAsync = false

  if (t.isObjectMethod(a)) {
    key = a.key as t.Identifier
    params = [...a.params]
    body = a.body
    isAsync = a.async
  } else if (t.isObjectProperty(a)) {
    if (!t.isIdentifier(a.key))
    return null
    key = a.key
    if (t.isFunctionExpression(a.value) || t.isArrowFunctionExpression(a.value)) {
      params = [...a.value.params]
      body = t.isBlockStatement(a.value.body)
        ? a.value.body
        : t.blockStatement([t.returnStatement(a.value.body)])
    }
  }
  if (!key || !body)
  return null

  // 第一个参数如果是 destructure 形式 {commit, state, dispatch, rootState}，移除
  if (params.length === 1) {
    const first = params[0]
    if (t.isObjectPattern(first)) {
      // 移除 destructure 参数
      params = []
    }
  }

  // 替换 body 中 commit('xxx', payload) → this.xxx(payload)
  replaceCommitCallsInBody(body, dynamicCommits)

  return t.objectProperty(key, t.functionExpression(null, params as any, body, false, isAsync), false) as any
}

/**
 * getter: (state) => state.x 或 getter(state) { return state.x }
 * → (state) => state.x（保持不变，Pinia 也用这种形式）
 */
function convertVuexGetter(g: any): t.ObjectProperty | null {
  if (t.isObjectMethod(g)) {
    // getter(state) { return state.x } → getter: (state) => state.x
    if (g.params.length === 1 && t.isIdentifier(g.params[0])) {
      const stateParam = g.params[0]
      const body = g.body
      // 简单：如果 body 只有一个 return statement
      if (body.body.length === 1 && t.isReturnStatement(body.body[0]) && body.body[0].argument) {
        return t.objectProperty(
          g.key as t.Identifier,
          t.arrowFunctionExpression([stateParam], body.body[0].argument),
        )
      }
    }
    // 否则保留为 method
return null } else if (t.isObjectProperty(g)) { if (t.isArrowFunctionExpression(g.value) || t.isFunctionExpression(g.value)) {
      // 已经是函数形式
return t.objectProperty(g.key, g.value) } }
return null }

/**
 * 在 body 中替换 state.xxx → this.xxx
 */
function replaceStateRefsInBody(body: t.BlockStatement, target: string) {
  traverse(body, {
    MemberExpression(path: any) {
      const node = path.node
      if (
        t.isIdentifier(node.object, { name: 'state' }) &&
        !node.computed
      ) {
        path.replaceWith(
          t.memberExpression(t.identifier(target), node.property as any, node.computed),
        )
      }
    },
    noScope: true,
  })
}

/**
 * 在 body 中替换 commit('xxx', payload) → this.xxx(payload)
 */
function replaceCommitCallsInBody(
  body: t.BlockStatement,
  dynamicCommits?: string[],
): void {
  traverse(body, {
    CallExpression(path: any) {
      const node = path.node
      // commit('xxx', payload) - callee 是 commit identifier
      if (
        t.isIdentifier(node.callee, { name: 'commit' }) &&
        node.arguments.length >= 1 &&
        t.isStringLiteral(node.arguments[0])
      ) {
        const name = node.arguments[0].value
        const newArgs = node.arguments.slice(1)
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('this'), t.identifier(name), false),
            newArgs,
          ),
        )
      } else if (
        t.isIdentifier(node.callee, { name: 'commit' }) &&
        node.arguments.length >= 1 &&
        !t.isStringLiteral(node.arguments[0]) &&
        dynamicCommits
      ) {
        // Dynamic commit: e.g. commit('save' + name, payload)
        // Can't statically resolve, add a marker so caller can emit review note
        dynamicCommits.push(generate(node.arguments[0]).code)
      }
    },
    noScope: true,
  })
}

registerPlugin(plugin)
export default plugin
