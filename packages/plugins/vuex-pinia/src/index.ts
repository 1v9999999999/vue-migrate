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
  inferStoreNameFromPath,
  storeIdToExportName,
  setMainStoreExportName,
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
// iter-041: 同时记录下这些 VariableDeclaration 的 path, 后面转换完后删除它们 (避免死代码)
    const stateMutationGetterActionPaths: any[] = []
    traverse(ctx.file.scriptAst, {
      VariableDeclaration(path: any) {
        const decl = path.node.declarations[0]
        if (!t.isIdentifier(decl.id) || !t.isObjectExpression(decl.init))
        return
        const name = decl.id.name
        if (name === 'state') {
          stateSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
          stateMutationGetterActionPaths.push({ name, path })
        } else if (name === 'getters') {
          gettersSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
          stateMutationGetterActionPaths.push({ name, path })
        } else if (name === 'mutations') {
          mutationsSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
          stateMutationGetterActionPaths.push({ name, path })
        } else if (name === 'actions') {
          actionsSource = ctx.file.source.substring(decl.init.start ?? 0, decl.init.end ?? 0)
          stateMutationGetterActionPaths.push({ name, path })
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

    let hasModules = false  // iter-034 #15b: modules 模式标志

    if (vuexStoreCall) {
      const options = vuexStoreCall.arguments[0] as t.ObjectExpression

      // iter-034 #15b: 检测 modules 模式 — `new Vuex.Store({modules, getters})`
      // 复杂转换需要逐个模块生成 defineStore,自动改风险大,先标 review
      const modulesProp = options.properties.find(
        (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'modules' }),
      )
      const hasInlineState = options.properties.some(
        (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'state' }),
      )
      if (process.env.DBG_VUEX) console.error(`[DBG_VUEX] ${ctx.file.path}: modulesProp=${!!modulesProp}, hasInlineState=${hasInlineState}`)
      if (modulesProp && !hasInlineState) {
        // 收集 module 名字
        const modNode = (modulesProp as any).value
        const moduleNames: string[] = []
        const moduleMap: Record<string, string> = {}  // name → import path
        if (t.isObjectExpression(modNode)) {
          for (const p of modNode.properties) {
            if (t.isObjectProperty(p) && t.isIdentifier(p.key)) {
              const name = (p.key as t.Identifier).name
              moduleNames.push(name)
              // iter-042e: 找 module 的 import 路径 (扫同文件 import)
              let importPath: string | null = null
              if (t.isIdentifier((p as any).value)) {
                const localName = ((p as any).value as t.Identifier).name
                importPath = findImportPath(ctx.file, localName) || localName
              }
              moduleMap[name] = importPath || name
            }
          }
        }
        // iter-042e: 给具体迁移模板 (含每个 module 的 import 路径)
        const moduleTemplate = moduleNames.map((n) => {
          const p = moduleMap[n]
          return `  // ${n} 模块 → ${p}
  // 1) 把 ${p} 的内容拆成: state() / getters / actions
  // 2) 创建 store/${n}.ts:
  //      import { defineStore } from 'pinia'
  //      export const use${n.charAt(0).toUpperCase() + n.slice(1)}Store = defineStore('${n}', {
  //        state: () => ({ /* ${p} 的 state */ }),
  //        getters: { /* ${p} 的 getters */ },
  //        actions: { /* ${p} 的 actions (含原 mutations 改名) */ },
  //      })`
        }).join('\n')
        // iter-043: modules 值是 identifier 形式 (e.g. `modules: modulesConst`) — 名字未知,
        // 但仍然是 modules 模式, 跳过自动转换. 之前的代码会 fall through 试图把 `modules`
        // 当 state 转换, 结果 codegen 输出 `import { ... }` 在 function body 里, 触发
        // "import/export may only appear at the top level" 错误.
        const moduleHint = moduleNames.length > 0
          ? `modules: {${moduleNames.join(', ')}, ...}`
          : `modules: <非字面量 — 你的 modules 是用 const modules = ... 或类似动态方式构造的>`
        reviewItems.push(
          `[#15b vuex modules] 检测到 new Vuex.Store({${moduleHint}, getters}) — modules 模式。Pinia 没有 modules 概念,需手动迁移每个 module:\n${moduleTemplate || '(module 名字未知, 需要打开 ./store/modules/ 目录看每个 module.js 的 default export 名字)'}\n\n原 getters/mutations 合并到对应 store。Vue 组件里的 this.$store.state.<modName>.yyy 改成 useXxxStore().yyy, dispatch 改成 store.action()。`,
        )
        // iter-034 #15b: 把 vuexStoreCall 置 null 跳过整个 if 块剩余部分(自动转换会误把 modules 当 state)
        vuexStoreCall = null
        hasModules = true
      }

      // iter-043: modules 模式 → 跳过整个 if 块剩余部分, 不做自动转换.
      // 之前是设 vuexStoreCall = null 但 continue, 结果下面的 inline 提取 + 构造
      // exportDecl + replaceWith 仍会跑, 试图把 `new Vuex.Store({modules, ...})` 
      // 转成 `export const useStoreStore = defineStore('store', {})`, 然后 codegen 把它
      // 包成 IIFE (function() { export ... }()) 输出 "import/export may only appear 
      // at the top level" 错. 修复: early return.
      if (hasModules) {
        // 别忘了: import Vue from 'vue' / import Vuex from 'vuex' 也清掉 (vue3-entry 会做)
        // 这里只 push review, 不删 import (避免误删用户后续可能用到的引用)
        return
      }

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

      // P0-B: 生成 Pinia store id + export 名字
      // 优先级:
      //  1. `new Vuex.Store({namespace: 'app'})` → 'app' (用户显式给的业务命名)
      //  2. 共享 `inferStoreNameFromPath(filePath)` (file path → store id)
      //  3. 'app' (回退, 比 'store' 更有业务语义)
      //
      // 'store' 名字太通用, 直接 fallback 到 'app', 避免组件 import `useStoreStore`
      // 但项目里只有一个 store 时用户还得手动改名。
      let storeName: string | null = null

      // Priority 1: namespace from `new Vuex.Store({namespace: 'xxx'})`
      // (非标准 Vuex 写法, 但某些项目用, 兼容一下)
      const namespaceProp = options.properties.find(
        (p: any) =>
          t.isObjectProperty(p) &&
          ((t.isIdentifier(p.key) && p.key.name === 'namespace') ||
            (t.isStringLiteral(p.key) && p.key.value === 'namespace')),
      )
      if (namespaceProp && t.isObjectProperty(namespaceProp) && t.isStringLiteral(namespaceProp.value)) {
        const ns = namespaceProp.value.value.trim()
        if (ns) storeName = ns
      }

      // Priority 2: shared `inferStoreNameFromPath`
      if (!storeName) {
        storeName = inferStoreNameFromPath(ctx.file.path)
      }

      // Priority 3: 'app' fallback (比 'store' 更业务语义)
      if (!storeName || storeName === 'store') {
        storeName = 'app'
      }

      const exportName = storeIdToExportName(storeName)

      // P0-B: 告诉 composition 插件项目的 main store export 名字
      // 后续 composition 在组件里 import 同一名字, 避免 "useLoginStore is undefined"
      setMainStoreExportName(ctx, exportName)
      if (ctx.project.storeNames && !ctx.project.storeNames.mainId) {
        ctx.project.storeNames.mainId = storeName
        ctx.project.storeNames.mainFilePath = ctx.file.path
      }

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

      // iter-041: 删除原顶层 const state / mutations / actions / getters 声明
      // 已经被合并进 defineStore 内, 留着会跟新的 const 重复定义 (Identifier 'state' has already been declared)
      for (const { path } of stateMutationGetterActionPaths) {
        try {
          // 也删除后面的分号: 用 path.parentPath.remove + manual
          if (path?.remove) path.remove()
        } catch { /* ignore */ }
      }
      // 提示 store 名: 如果 storeName 是 'store' (推断不出具体业务名), 标 review 让用户改
      if (storeName === 'store') {
        reviewItems.push(
          `Pinia store id 推断为 "store" (太通用, 建议改成具体业务名, 例如 "useAdminStore")。` +
          `\n  → 改 export const useStoreStore = defineStore("store", ...) 的两处: 第一个字符串 ("store") 和 export 名字 (useStoreStore)。`,
        )
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
      //
      // 注意：vuex-pinia 跑在 composition 之前，**不知道** composition 后续
      // 会不会把 `...mapState(['x'])` 重写成 `let x`（free var）。所以我们
      // 不在 vuex-pinia 阶段就标这个 review，而是先标 "候补"，由 composition
      // 在最后阶段用 `ctx.utils.manualReview(...)` 的合并去重 / 静默掉。
      // 简单做法：直接不标，import-cleaner 会清掉 import，composition
      // 会标 "free variable" review —— 用户看到的提示就是同一个意图。
    }

    // 处理 import Vuex from 'vuex'（改为 pinia 的 defineStore）
    // 与 import { mapState, ... } from 'vuex'（删掉，mapXxx 已被 composition 转写）
    traverse(ctx.file.scriptAst, {
      ImportDeclaration(path: any) {
        if (!t.isStringLiteral(path.node.source, { value: 'vuex' }))
        return
        // 检查是否是 named import (e.g. `import { mapState } from 'vuex'`)
        const hasNamedSpec = path.node.specifiers.some(
          (s: any) => t.isImportSpecifier(s),
        )
        if (hasNamedSpec) {
          // mapXxx 已被 composition 重写为 free variables；
          // 这个 import 没人用了，import-cleaner 会清。
          // 这里只标 marked，留给 import-cleaner 真正删。
          // 不重写 source，避免顺序依赖。
          return
        }
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
/**
 * iter-042e: 扫 AST 找 import { localName } from '...' 的路径
 */
function findImportPath(file: any, localName: string): string | null {
  const ast = file.scriptAst
  if (!ast || !t.isFile(ast)) return null
  let found: string | null = null
  traverse(ast, {
    ImportDeclaration(path: any) {
      for (const spec of path.node.specifiers) {
        // import localName from '...'
        if (t.isImportDefaultSpecifier(spec) && t.isIdentifier(spec.local, { name: localName })) {
          found = (path.node.source as any).value
          return
        }
        // import { localName as xxx } from '...' — 也匹配 xxx
        if (t.isImportSpecifier(spec) && t.isIdentifier(spec.local, { name: localName })) {
          // imported 是原始名字, 我们 match local (即 alias)
          found = (path.node.source as any).value
          return
        }
      }
    },
  })
  return found
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
