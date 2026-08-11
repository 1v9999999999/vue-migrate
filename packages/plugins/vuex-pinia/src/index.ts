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
    // iter-044a (Bug A2): 模块文件 (src/store/modules/*.js) 也走 vuex 转换
    //   模式: const state = {...}; const mutations = {...}; const actions = {...};
    //         export default { namespaced: true, state, mutations, actions }
    //   即使没有 `import 'vuex'` 也要转成 pinia store,否则下游就一直是原 vuex 状态
    const isModuleFile = isVuexModuleFile(ctx.file.path)

    // iter-044a (Bug A2): module 文件独立处理
    if (isModuleFile) {
      const r = transformVuexModuleFile(ctx)
      if (r === 'changed') {
        // 确保 `defineStore` 已被 import (从 'pinia')
        ensureDefineStoreImport(ctx)
        // iter-048: 同步 scriptAst → file.source (避免后续 store-bridge 走 raw-source
        //   路径时, 把 useXxxStore / 删除 const state 等已改的 ast 节点原样写回输出).
        //   - .vue 走 syncScriptAstToSource (.sfc.script 替换)
        //   - .js/.ts 整文件 generate 替换
        if (ctx.file.kind === 'vue') {
          try { ctx.utils.syncScriptAstToSource() } catch (e: any) { /* fallback: codegen 仍能走 ast */ }
        } else {
          try {
            const generated = generate(ctx.file.scriptAst as any, {
              retainLines: false, comments: true, compact: false, jsescOption: { minimal: true },
            }).code
            ctx.file.source = generated
            ;(ctx.file as any).useRawSource = true
          } catch (e: any) { /* fallback: codegen 走 ast */ }
        }
        return
      }
      // 不是标准 vuex module 模式 (没有 state/mutations/actions + export default)
      // 走原有逻辑 (可能只是名字撞了), 直接返回
      return
    }

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
        // iter-044a (Bug A2): modules 模式自动转 pinia aggregator (不再标 review)
        //   策略:
        //     1. 收集 module 名字 (从 `modules: {app, user, ...}` 静态字面量 OR require.context 推断)
        //     2. 对每个 module 在 project.files 里找对应源文件, 直接改它的 file.source
        //     3. 把 index.js 整个重写: import 每个 store + createPinia() + 重新 export
        //     4. 同步移除 `Vue.use(Vuex)` 和 `require.context` 相关死代码
        //   注意: 每个 module 文件会被独立 transform 一次, 走 `transformVuexModuleFile` 路径;
        //         我们这里只负责 (1) 收集名字 和 (2) 重写 index.js
        const modNode = (modulesProp as any).value
        const moduleNames: string[] = []
        const moduleMap: Record<string, string> = {}  // name → import path
        if (t.isObjectExpression(modNode)) {
          for (const p of modNode.properties) {
            if (t.isObjectProperty(p) && t.isIdentifier(p.key)) {
              const name = (p.key as t.Identifier).name
              moduleNames.push(name)
              let importPath: string | null = null
              if (t.isIdentifier((p as any).value)) {
                const localName = ((p as any).value as t.Identifier).name
                importPath = findImportPath(ctx.file, localName) || localName
              }
              moduleMap[name] = importPath || name
            }
          }
        } else if (t.isIdentifier(modNode)) {
          // modules 值是 identifier 形式 (e.g. `modules: modulesConst`):
          //   modulesConst 是 `require.context('./modules', true, /\.js$/).keys().reduce(...)` 的结果
          //   我们没法静态分析, 但可以扫描 project.files 找 store/modules/*.js 文件
          const inferredNames = inferModulesFromProjectFiles(ctx)
          for (const n of inferredNames) {
            moduleNames.push(n)
            moduleMap[n] = `./modules/${n}`
          }
        }

        // 应用 modules 模式 pinia aggregator
        const ok = rewriteIndexAsPiniaAggregator(ctx, moduleNames, moduleMap)
        if (ok) {
          // 重写成功, 标记 changed, 跳过剩余的 vuexStoreCall 转换 (会冲突)
          vuexStoreCall = null
          hasModules = true
          changed = true
          reviewItems.push(
            `[#15b vuex modules → pinia] 检测到 new Vuex.Store({modules, getters}) — 已自动转 pinia:\n` +
            `  • 每个 store/modules/*.js 已被转为 export const useXxxStore = defineStore('xxx', {...})\n` +
            `  • index.js 现在 createPinia() 并 export, 供 main.js 里 app.use(pinia) 使用\n` +
            `  • 组件里的 this.$store.state.<modName>.yyy 改成 useXxxStore().yyy (useXxxStore 由各 module 文件 export)\n` +
            `  • dispatch('${moduleNames[0] || 'xxx'}/action', ...) 改成 useXxxStore().action(...)\n` +
            `  • main.js 里需要 ` + '`app.use(pinia)`' + ` 后才能在 setup 里 useXxxStore()`,
          )
        } else {
          // 重写失败 (例如 moduleNames 为空), 走旧的 review-only 路径
          // iter-043 兼容: modules 值是 identifier 但 project.files 里也找不到 module 文件
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
          const moduleHint = moduleNames.length > 0
            ? `modules: {${moduleNames.join(', ')}, ...}`
            : `modules: <非字面量 — 你的 modules 是用 const modules = ... 或类似动态方式构造的>`
          reviewItems.push(
            `[#15b vuex modules] 检测到 new Vuex.Store({${moduleHint}, getters}) — modules 模式。Pinia 没有 modules 概念,需手动迁移每个 module:\n${moduleTemplate || '(module 名字未知, 需要打开 ./store/modules/ 目录看每个 module.js 的 default export 名字)'}\n\n原 getters/mutations 合并到对应 store。Vue 组件里的 this.$store.state.<modName>.yyy 改成 useXxxStore().yyy, dispatch 改成 store.action()。`,
          )
          vuexStoreCall = null
          hasModules = true
        }
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

/**
 * iter-044a (Bug A2): 从 project.files 推断 modules 名字
 *   - 扫 `store/modules/*.js` 形式的所有源文件, 取 basename (去 .js/.ts) 作为 module 名
 *   - 用于: index.js 里 `modules: modulesConst` (require.context 模式) — 我们没法静态分析 modulesConst,
 *     但可以扫 project 看 store/modules/ 目录下有哪些文件, 这就是 require.context 会加载的文件
 */
function inferModulesFromProjectFiles(ctx: TransformContext): string[] {
  const norm = (ctx.file.path || '').replace(/\\/g, '/')
  // 取 index.js 所在的 store 目录
  const m = norm.match(/^(.*\/store)\/index\.(js|ts)$/)
  if (!m) return []
  const storeDir = m[1]
  const names: string[] = []
  for (const [fpath] of ctx.project.files) {
    const f = fpath.replace(/\\/g, '/')
    if (!f.startsWith(storeDir + '/modules/')) continue
    const rest = f.slice(storeDir.length + '/modules/'.length)
    // 只要直接子文件 (不要嵌套目录)
    if (rest.includes('/')) continue
    const base = rest.replace(/\.(js|ts)$/, '')
    if (base && base !== 'index') names.push(base)
  }
  return names
}

/**
 * iter-044a (Bug A2): 重写 index.js 为 pinia aggregator
 *
 * 输入 (已有 ctx.file.scriptAst):
 *   import Vue from 'vue'
 *   import Vuex from 'vuex'
 *   import getters from './getters'
 *   Vue.use(Vuex)
 *   const modulesFiles = require.context('./modules', true, /\.js$/)
 *   const modules = modulesFiles.keys().reduce(...)
 *   const store = new Vuex.Store({ modules, getters })
 *   export default store
 *
 * 输出 (整个 file.source 重写):
 *   import { createPinia } from 'pinia'
 *   // 静态 import 每个 module 的 store (它们已各自转成 useXxxStore)
 *   import { useAppStore } from './modules/app'
 *   import { useUserStore } from './modules/user'
 *   ...
 *   const pinia = createPinia()
 *   // 注: main.js 需要 `app.use(pinia)`, 否则 useXxxStore() 会抛 "no active pinia" 错
 *   // 透出 getters 兼容老代码 (用 Composition 风格的 computeds 模拟)
 *   import getters from './getters'
 *   // ... getters 是个对象, 每个函数形如 (state) => state.app.x
 *   // Pinia 没有全局 state, 我们提供一个聚合的 useStore 兜底
 *   export { useAppStore, useUserStore, ... }
 *   export const piniaInstance = pinia
 *   export default pinia
 *
 * 返回 true 表示重写成功, false 表示失败 (例如 moduleNames 为空)
 */
function rewriteIndexAsPiniaAggregator(
  ctx: TransformContext,
  moduleNames: string[],
  moduleMap: Record<string, string>,
): boolean {
  if (moduleNames.length === 0) return false

  // 1. 把每个 module 文件的 file.source 也标记为已转换 (确保它们会被 codegen 写出去)
  //    通过 ctx.utils.markChanged 触发 codegen 即可
  for (const modName of moduleNames) {
    const importPath = moduleMap[modName] || `./modules/${modName}`
    // 把 './modules/xxx' 形式转换成绝对路径 (相对项目根)
    // 这里直接用 ctx.project.files 找
    let moduleFilePath: string | null = null
    const normCurrent = (ctx.file.path || '').replace(/\\/g, '/')
    const normImport = importPath.replace(/^\.\//, '').replace(/^\.\.\//, '')
    for (const [fpath] of ctx.project.files) {
      const fn = fpath.replace(/\\/g, '/')
      if (fn === normCurrent) continue
      if (fn.endsWith('/' + normImport + '.js') || fn.endsWith('/' + normImport + '.ts')) {
        moduleFilePath = fpath
        break
      }
    }
    if (moduleFilePath) {
      const mf = ctx.project.files.get(moduleFilePath)
      if (mf) {
        // 触发 module file 自己的 transform 走 vuex module 路径
        // 简单做法: 直接 mark changed + 调用 transformVuexModuleFile
        // 但这里 transform 已经被 orchestrator 控制, 我们改 file.scriptAst 即可
        // 实际: 每个 module 文件在自己被 transform 时, 会走 `isVuexModuleFile` 分支
        // 这里只需要保证: 不会因为我们这里直接改 file.source 而覆盖了 module 的转换
        mf.changed = true
      }
    }
  }

  // 2. 重写 file.source — 用 generate AST 走 codegen 更安全, 但这里直接拼字符串更可控
  //    注意: 我们直接覆盖 file.source, 跳过 file.scriptAst 改写, 这样后续 codegen 写出去的就是
  //    我们的新内容。file.scriptAst 可以保留原状 (没用了, codegen 用 file.source)
  const importLines: string[] = []
  for (const modName of moduleNames) {
    const exportName = storeIdToExportName(modName)
    importLines.push(`import { ${exportName} } from './modules/${modName}'`)
  }
  importLines.unshift(`import { createPinia } from 'pinia'`)

  // 透出 getters.js: 原 getters 是 (state) => state.app.x 形式 — Pinia 里没有全局 state,
  // 没法直接复用. 我们 import 进来, 让用户手动迁移 (或保留作为 compatibility shim)
  // 注意: 检测 index.js 源文件有没有 import './getters'
  const hasGettersImport = /from\s+['"]\.\/getters['"]/.test(ctx.file.source) ||
                            /from\s+['"]\.\/getters\.js['"]/.test(ctx.file.source)
  const gettersLine = hasGettersImport
    ? `\n// 原 vuex getters (已 import, 但 Pinia 无全局 state 概念, 需手动迁移到具体 store 或保留为 compat shim)\n//   getters.js 里的 (state) => state.app.x 形式无法在 Pinia 中直接复用, 因为 Pinia 没有 root state\n//   建议: 移到对应 store 的 getters 字段 (e.g. useAppStore 加 getter x() { return this.x }), 或继续用 getters 函数但参数改成具体 store\nimport * as vuexGetters from './getters'\n`
    : ''

  const exportNames = moduleNames.map((n) => storeIdToExportName(n))

  const newContent = `${importLines.join('\n')}
${gettersLine}
const pinia = createPinia()

// 透出每个 store (useXxxStore 是 setup-sugar-friendly 入口)
${exportNames.map((n) => `export { ${n} }`).join('\n')}

// 主 pinia instance: 在 main.js 里 app.use(piniaInstance) 后, 组件内 useXxxStore() 才能用
export const piniaInstance = pinia
export default pinia
`

  // 直接覆盖 file.source
  ctx.file.source = newContent
  // 标记 useRawSource, codegen 会用 file.source 而不是 file.scriptAst
  ;(ctx.file as any).useRawSource = true
  // 标记文件已改动 — codegen 只写 file.changed === true 的文件
  ctx.file.changed = true
  // 调用 markChanged (供 orchestrator 统计 + review log)
  ctx.utils.markChanged('vuex modules mode → pinia aggregator')
  return true
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

  // mutation 第一个参数通常是 state。Vuex 的 `mutations: { FOO: (state) => {...} }` 单参形式
  //   (state 是唯一的参数, 表示 store state) 也常见 (e.g. TOGGLE_SIDEBAR: state => { state.sidebar.opened = ... })
  //   需要移除; 多参形式 (state, payload) 也移除第一个。
  //   罕见: `SET_X: (state) => { ... }` 实际是 payload (但命名为 state) — 这是 bad naming, 罕见,
  //         优先按 vuex 约定移除 `state` 名参数, 由用户后续修复。
  // 启发式: params[0] 名为 'state' → 移除 (不论总共几个)
  if (params.length >= 1) {
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
  //   - 1 个参数: {commit} → []
  //   - 2+ 个参数: {commit}, payload → [payload]
  if (params.length >= 1) {
    const first = params[0]
    if (t.isObjectPattern(first)) {
      // 移除 destructure 参数 (保留后面的真实 payload 参数)
      params = params.slice(1)
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

/**
 * iter-044a (Bug A2): 判断一个文件是不是 vuex module 文件
 *   - 路径形如 `src/store/modules/<name>.js` 或 `src/store/modules/<name>.ts`
 *   - 这类文件一般长这样:
 *       const state = {...}
 *       const mutations = {...}
 *       const actions = {...}
 *       export default { namespaced: true, state, mutations, actions }
 *   - 它们在 index.js 里通过 `modules: { app, user, ... }` 引用
 *   - 我们的策略: 把每个 module 文件单独转成 pinia store (`useXxxStore = defineStore(...)`),
 *     index.js 里的 `new Vuex.Store({ modules, getters })` 改成 pinia aggregator (import + 提供给 app)
 */
function isVuexModuleFile(filePath: string): boolean {
  if (!filePath) return false
  // 用反斜杠或正斜杠都兼容
  const norm = filePath.replace(/\\/g, '/')
  return /\/store\/modules\/[^\/]+\.(js|ts)$/.test(norm)
}

/**
 * iter-044a (Bug A2): 把 vuex module 文件转成 pinia store
 *
 * 输入 (AST 已 parse 好):
 *   const state = {...}
 *   const mutations = {...}
 *   const actions = {...}
 *   export default { namespaced: true, state, mutations, actions }
 *
 * 输出:
 *   import { defineStore } from 'pinia'
 *   export const useXxxStore = defineStore('xxx', {
 *     state: () => ({...}),
 *     actions: {
 *       // 原 mutations 改名, this.xxx = payload
 *       // 原 actions 去 destructure, commit('x', payload) → this.x(payload)
 *     }
 *   })
 *
 * 同时移除: `Vue.use(Vuex)`, `import Vuex from 'vuex'` (本文件里的), `import Vue from 'vue'` (如果只是 Vue.use)
 *
 * 返回:
 *   - 0: 改动了 (调用方 markChanged)
 *   - 1: 检测到 vuex module 模式, 改完了
 *   - 2: 不是 vuex module 模式, 没动
 */
function transformVuexModuleFile(ctx: TransformContext): 'changed' | 'not-module' {
  if (!ctx.file.scriptAst) return 'not-module'
  const file = ctx.file
  const source = file.source

  // 检测关键 signal: 有 `export default { ... }` 且里面引用了 `state`, `mutations`, `actions`
  // 用 traverse 拿真实的 babel path (不是裸 node), 否则后面 path.remove()/replaceWith() 没法用
  let exportDefaultObj: any = null
  let exportDefaultBabelPath: any = null
  let exportDefaultNode: any = null
  traverse(file.scriptAst, {
    ExportDefaultDeclaration(path: any) {
      const stmt = path.node
      if (!t.isObjectExpression(stmt.declaration)) return
      const obj = stmt.declaration
      const hasState = obj.properties.some(
        (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'state' }) && t.isIdentifier(p.value),
      )
      const hasMutations = obj.properties.some(
        (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'mutations' }) && t.isIdentifier(p.value),
      )
      const hasActions = obj.properties.some(
        (p: any) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'actions' }) && t.isIdentifier(p.value),
      )
      if (hasState && (hasMutations || hasActions)) {
        exportDefaultObj = obj
        exportDefaultBabelPath = path
        exportDefaultNode = stmt
      }
    },
  })
  if (!exportDefaultObj) return 'not-module'

  // 取出 state / mutations / actions 标识符名
  const idents: { state?: string; mutations?: string; actions?: string; getters?: string } = {}
  for (const p of exportDefaultObj.properties) {
    if (!t.isObjectProperty(p) || !t.isIdentifier(p.key) || !t.isIdentifier(p.value)) continue
    const key = p.key.name
    if (key === 'state' || key === 'mutations' || key === 'actions' || key === 'getters') {
      idents[key] = p.value.name
    }
  }
  if (!idents.state) return 'not-module'

  // 在 program 里找 const state = {...} / mutations = {...} / actions = {...}
  // 用 traverse 拿 babel path
  const stateDecls: Record<string, { path: any; init: any }> = {}
  traverse(file.scriptAst, {
    VariableDeclaration(path: any) {
      const stmt = path.node
      for (const d of stmt.declarations) {
        if (!t.isVariableDeclarator(d) || !t.isIdentifier(d.id) || !t.isObjectExpression(d.init)) continue
        const name = d.id.name
        if (name === idents.state) {
          stateDecls.state = { path, init: d.init }
        } else if (idents.mutations && name === idents.mutations) {
          stateDecls.mutations = { path, init: d.init }
        } else if (idents.actions && name === idents.actions) {
          stateDecls.actions = { path, init: d.init }
        } else if (idents.getters && name === idents.getters) {
          stateDecls.getters = { path, init: d.init }
        }
      }
    },
  })
  if (!stateDecls.state) return 'not-module'

  // 推断 store id: 优先用文件名 (e.g. app.js → 'app', errorLog.js → 'errorLog')
  const storeName = inferStoreNameFromPath(file.path) || idents.state || 'app'
  const exportName = storeIdToExportName(storeName)

  // 构造 state: () => ({...})
  const stateFunc = t.arrowFunctionExpression([], stateDecls.state.init)
  const stateProp = t.objectProperty(t.identifier('state'), stateFunc)
  const props: t.ObjectProperty[] = [stateProp]

  // 构造 actions: { ...mutations 改名, ...actions 去 destructure + 翻译 commit }
  const actionsProps: t.ObjectProperty[] = []
  const reviewItems: string[] = []
  if (stateDecls.mutations) {
    for (const m of stateDecls.mutations.init.properties) {
      if (t.isObjectProperty(m) || t.isObjectMethod(m)) {
        const converted = convertMutationToAction(m as any)
        if (converted) actionsProps.push(converted)
      }
    }
  }
  if (stateDecls.actions) {
    for (const a of stateDecls.actions.init.properties) {
      if (t.isObjectProperty(a) || t.isObjectMethod(a)) {
        const dynamicCommits: string[] = []
        const converted = convertVuexAction(a, dynamicCommits)
        if (converted) actionsProps.push(converted)
        for (const expr of dynamicCommits) {
          reviewItems.push(
            `[${storeName}] dynamic commit(\`${expr}\`, ...) - mutation 名是表达式而非字符串字面量，需手动迁移到 Pinia。`,
          )
        }
      }
    }
  }
  if (actionsProps.length > 0) {
    props.push(t.objectProperty(t.identifier('actions'), t.objectExpression(actionsProps)))
  }

  // 构造 defineStore('storeName', { state, actions })
  const defineStoreCall = t.callExpression(
    t.identifier('defineStore'),
    [t.stringLiteral(storeName), t.objectExpression(props)],
  )
  const exportDecl = t.exportNamedDeclaration(
    t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(exportName), defineStoreCall),
    ]),
    [],
  )

  // 删除原 const state / mutations / actions / getters 声明 (用 babel path)
  for (const k of Object.keys(stateDecls)) {
    const d = stateDecls[k]
    if (d?.path && typeof d.path.remove === 'function') {
      try { d.path.remove() } catch { /* ignore */ }
    }
  }

  // 删除原 export default {...} → 替换为 export const useXxxStore = defineStore(...)
  try {
    if (exportDefaultBabelPath && typeof exportDefaultBabelPath.replaceWith === 'function') {
      exportDefaultBabelPath.replaceWith(exportDecl)
    } else if (exportDefaultNode) {
      // 兜底: 直接 mutate parent.body
      const parent = exportDefaultNode && (exportDefaultNode as any).__parent
      // 这个分支一般不会到, traverse 给我们的是 babel path
    }
  } catch { /* ignore */ }

  // 处理 import: 移除 import Vuex / Vue (Vue.use(Vuex) 也在文件里需要删)
  // vue3-entry 会做更彻底的清理,这里只把 vuex import 改/删
  traverse(file.scriptAst, {
    ImportDeclaration(path: any) {
      if (!t.isStringLiteral(path.node.source, { value: 'vuex' })) return
      const hasNamedSpec = path.node.specifiers.some(
        (s: any) => t.isImportSpecifier(s),
      )
      if (hasNamedSpec) {
        // mapState 等, 留 import-cleaner 删
        return
      }
      // default import 'vuex' → 改为 import { defineStore } from 'pinia'
      path.node.source = t.stringLiteral('pinia')
      path.node.specifiers = [
        t.importSpecifier(t.identifier('defineStore'), t.identifier('defineStore')),
      ]
    },
    ExpressionStatement(path: any) {
      // 删 Vue.use(Vuex)
      const expr = path.node.expression
      if (
        t.isCallExpression(expr) &&
        t.isMemberExpression(expr.callee) &&
        t.isIdentifier(expr.callee.object, { name: 'Vue' }) &&
        t.isIdentifier(expr.callee.property, { name: 'use' }) &&
        expr.arguments.length === 1 &&
        t.isIdentifier(expr.arguments[0], { name: 'Vuex' })
      ) {
        try { path.remove() } catch { /* ignore */ }
      }
    },
  })

  // 记录 review
  for (const r of reviewItems) ctx.utils.manualReview(r)
  ctx.utils.manualReview(
    `[${storeName}] vuex module 已转 pinia store (export const ${exportName} = defineStore('${storeName}', ...))。` +
    `\n  • 原 mutations 已合并进 actions (this.xxx = payload 形式)` +
    `\n  • 原 actions 已去掉 {commit, state} destructure, commit('x', payload) → this.x(payload)` +
    `\n  • 组件里的 this.$store.state.${storeName}.yyy 改成 ${exportName}().yyy` +
    `\n  • dispatch('${storeName}/action', payload) 改成 ${exportName}().action(payload)`,
  )

  ctx.utils.markChanged(`vuex module → pinia store (${storeName})`)
  return 'changed'
}

/**
 * iter-044a (Bug A2): 确保 `import { defineStore } from 'pinia'` 存在
 *   - 优先复用已有的 `from 'pinia'` import (named import 加 defineStore)
 *   - 否则在 import 区顶部插入新的 import
 *   - 文件里没有 import 区时, 创建一个
 */
function ensureDefineStoreImport(ctx: TransformContext): void {
  if (!ctx.file.scriptAst) return
  const ast = ctx.file.scriptAst
  const program = (ast as any).program
  if (!program || !program.body) return

  // 1. 检查是否已经有 `import { defineStore } from 'pinia'`
  let hasDefineStore = false
  let piniaImportPath: any = null
  for (const stmt of program.body) {
    if (!t.isImportDeclaration(stmt)) continue
    if (!t.isStringLiteral(stmt.source, { value: 'pinia' })) continue
    for (const spec of stmt.specifiers) {
      if (t.isImportSpecifier(spec) && t.isIdentifier(spec.local, { name: 'defineStore' })) {
        hasDefineStore = true
        break
      }
    }
    piniaImportPath = stmt
  }
  if (hasDefineStore) return

  // 2. 已有 'pinia' import 但没 defineStore, 加进去
  if (piniaImportPath) {
    piniaImportPath.specifiers.push(
      t.importSpecifier(t.identifier('defineStore'), t.identifier('defineStore')),
    )
    return
  }

  // 3. 没有 'pinia' import — 找到第一个 import declaration, 在它之前插入
  const newImport = t.importDeclaration(
    [t.importSpecifier(t.identifier('defineStore'), t.identifier('defineStore'))],
    t.stringLiteral('pinia'),
  )
  let insertIdx = 0
  for (let i = 0; i < program.body.length; i++) {
    if (t.isImportDeclaration(program.body[i])) {
      insertIdx = i
      break
    }
  }
  if (insertIdx === 0 && program.body.length > 0 && !t.isImportDeclaration(program.body[0])) {
    // 完全没有 import 区, 插到最前面
    program.body.unshift(newImport)
  } else {
    // 在第一个 import 之前插入
    program.body.splice(insertIdx, 0, newImport)
  }
}

registerPlugin(plugin)
export default plugin
