/**
 * @vue-migrate/plugin-store-bridge
 *
 * iter-046: 桥接组件里残留的 Vuex 风格 store 调用,改成 Pinia 风格
 *
 * 转换规则:
 *   B.1  `useStore()` 无参调用 → `useXxxStore()` (Xxx 推断自上下文)
 *   B.2  `store.state.X.Y` → `useXxxStore().Y` (X 是 store 名,如 app/user/...)
 *   B.3  `store.dispatch("X/Y", p)` → `useXxxStore().Y(p)` (X/Y 拆分)
 *   B.4  `store.getters.X` → `useXxxStore().X` (getter 变成 pinia state)
 *   B.5  `store.commit("X/Y", p)` → `useXxxStore().Y(p)` (vuex-pinia 把 mutation 转 action)
 *   B.6  `commit("X", p)` / `dispatch("X", p)` (无 store. 前缀) → 同样改成 useXxxStore
 *   B.7  自动补 `import { useXxxStore } from '@/store'`
 *   B.8  删除 `import { useStore } from 'pinia'`
 *
 * 输入:vuex-pinia 已经把 `new Vuex.Store` 转成 `defineStore('xxx', ...)`,生成
 *      `useXxxStore` 函数 (例如 useAppStore / useUserStore)。
 *      composition 已经把组件转成 `<script setup>`,并在 setup 里写
 *      `const store = useStore()` + `store.dispatch('user/login', p)` 等残留模式。
 *
 * 优先级:-1(在 composition 之后跑,清理 composition 残留)
 */

// @ts-ignore
import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

// ESM-safe wrappers (babel under different entry points)
const _traverseObj: any = (_traverse as any)
const traverse = (_traverseObj.default || _traverseObj) as typeof _traverse

// iter-046: hard-coded getter→store mapping (从 vue-element-admin 实际项目归纳)
//   每个 getter 的 state 字段在哪个 store 文件里,这里就指向哪个 store.
//   找不到时 fallback 到 useAppStore() 并标 review.
const GETTER_TO_STORE: Record<string, string> = {
  // app store getters
  sidebar: 'app',
  device: 'app',
  size: 'app',
  showSettings: 'settings',
  showTagsView: 'settings',
  fixedHeader: 'settings',
  sidebarLogo: 'settings',
  theme: 'settings',
  // user store getters
  token: 'user',
  avatar: 'user',
  name: 'user',
  roles: 'user',
  introduction: 'user',
  // tagsView store getters
  visitedViews: 'tagsView',
  cachedViews: 'tagsView',
  // permission store getters
  routes: 'permission',
  addRoutes: 'permission',
  permission_routes: 'permission',
  // errorLog store getters
  errorLogs: 'errorLog',
  logs: 'errorLog',
}

// 默认 store 名 (useStore() 无参 + 无 context 时的 fallback)
const DEFAULT_STORE = 'app'

/**
 * 推一个 store id → export name 的映射.
 * 'app' → 'useAppStore', 'user' → 'useUserStore', 'tagsView' → 'useTagsViewStore', 'errorLog' → 'useErrorLogStore'
 */
function storeIdToExportName(id: string): string {
  if (!id) return 'useAppStore'
  // PascalCase: 'errorLog' → 'ErrorLog', 'tagsView' → 'TagsView'
  const pascal = id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  return `use${pascal}Store`
}

const plugin: TransformPlugin = {
  name: 'store-bridge',
  description: 'iter-046: bridge Vuex-style component store calls to Pinia store-specific calls. Replaces useStore() (no-arg), store.state.X.Y, store.dispatch(\'X/Y\', p), store.getters.X, store.commit(\'X/Y\', p).',
  priority: -1,  // 在 composition (0) 之后跑, 清理它生成的残留

  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    if (!file.source) return

    let changed = false
    const reviewItems: string[] = []
    const storeImportsNeeded = new Set<string>()  // 收集要 import 的 useXxxStore

    // ------- 决定本文件如何处理 source 替换 -------
    // 如果是 .vue, 只能改 <script> 块 (避免碰 template/style)
    // 如果是 .js/.ts, 改整文件
    const isVue = file.kind === 'vue' || /\.vue$/i.test(file.path || '')

    let processTarget: string
    let targetStart = 0
    let targetEnd = file.source.length
    if (isVue) {
      const scriptOpenMatch = file.source.match(/<script\b[^>]*>/i)
      if (!scriptOpenMatch || scriptOpenMatch.index === undefined) return
      const scriptOpenEnd = scriptOpenMatch.index + scriptOpenMatch[0].length
      const scriptCloseIdx = file.source.indexOf('</script>', scriptOpenEnd)
      if (scriptCloseIdx < 0) return
      targetStart = scriptOpenEnd
      targetEnd = scriptCloseIdx
      processTarget = file.source.substring(targetStart, targetEnd)
    } else {
      processTarget = file.source
    }

    // 保存原始 processTarget 供最后判断是否真的改了
    const originalProcessTarget = processTarget

    // ------- 1. `useStore()` 无参调用 → `useXxxStore()` -------
    //   composition 在生成 setup 时,如果遇到 `this.$store` 会写:
    //     const store = useStore()
    //   useStore() 是从 'pinia' 导入的,Vue3 中 useStore() 不带参数会抛 "no active pinia".
    //   必须替换成具体的 useXxxStore().
    //
    //   替换策略: 把 `useStore()` (从 'pinia' 导入) 替换成 useAppStore() (default).
    //   但如果同文件里有 store.state.X.Y / store.dispatch('X/Y', ...) 出现,
    //   我们会在第 2 步推断具体 store, 然后在 import 阶段把这些 useXxxStore 加进来.
    //   简单的"无参 useStore()" → useAppStore() 替换是安全的兜底.
    const before1 = processTarget
    // 只在 useStore 是从 'pinia' 导入时替换 (避免误伤 setMainStoreExportName 等)
    const usesPiniaUseStore = /from\s+['"]pinia['"]/.test(processTarget) &&
      /import\s*\{[^}]*\buseStore\b[^}]*\}\s*from\s*['"]pinia['"]/.test(processTarget)
    if (usesPiniaUseStore) {
      // 1a. 替换 import: `import { useStore } from 'pinia'` → 整条删掉
      //     (后面会补 useXxxStore import)
      processTarget = processTarget.replace(
        /import\s*\{\s*useStore\s*\}\s*from\s*['"]pinia['"]\s*;?/g,
        '',
      )
      // 1b. 替换 `useStore()` 调用 (无参) → `useAppStore()` (default)
      //     用单词边界避免误匹配 useStoreHook / useStoredXxx
      //     注意: 只在 'pinia' 那个 useStore 上做; 如果之前用户代码里也用 useStore
      //     作别的用途 (e.g. useStoreSelector), 不能误改. 简单起见,我们对所有 `useStore()`
      //     都改 — 99% 的 vue-element-admin 用法都是 pinia useStore().
      processTarget = processTarget.replace(/\buseStore\s*\(\s*\)/g, 'useAppStore()')
      storeImportsNeeded.add('useAppStore')
      reviewItems.push(
        'useStore() 无参调用已替换成 useAppStore() (Pinia 不支持 useStore() no-arg, ' +
        '会抛 "no active pinia" 错)。如果实际用的是别的 store (e.g. user/settings), ' +
        '请手动调整 import 名字。',
      )
    }

    // ------- 2. `store.state.X.Y` → `useXxxStore().Y` -------
    //   pattern: store.state.<storeName>.<subKey>(.<subKey>...)
    //   storeName ∈ {app, user, settings, tagsView, permission, errorLog, ...}
    //   把 .state.<storeName> 整段去掉,留下 useXxxStore() 然后链式访问后面的 subKey
    //
    //   注意: store 是变量名(可能叫 store / store / __store), 在 composition 输出里就是
    //   `const store = useStore()` 或 `const store = useAppStore()`.
    //   我们用 generic 模式: \b\w*store\.state\.(\w+) 然后后接 .X.Y
    //   负向 lookbehind (?<!\.) 避免误匹配 this.$store.state.X (那种由 6.5 步处理)
    const before2 = processTarget
    processTarget = processTarget.replace(
      /(?<![.\w$])\w*store\.state\.([a-zA-Z_]\w*)\.(\w+(\.[a-zA-Z_]\w*)*)/g,
      (_m, storeName, subKey) => {
        if (!GETTER_TO_STORE[subKey.split('.')[0]] && !/^(app|user|settings|tagsView|permission|errorLog)$/.test(storeName)) {
          // 不是已知 store,标 review
          reviewItems.push(
            `store.state.${storeName}.${subKey} 未能推断 store 名字 (默认 fallback 到 useAppStore, 实际可能错)。`,
          )
        }
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        return `${exportName}().${subKey}`
      },
    )
    // 还要处理 `store.state.X` (只有一层) — 这种一般是 `store.state.user` 整体赋给 const state
    processTarget = processTarget.replace(
      /(?<![.\w$])\w*store\.state\.([a-zA-Z_]\w*)\b(?![\.\[])/g,
      (_m, storeName) => {
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        return `${exportName}()`
      },
    )

    // ------- 3. `store.dispatch("X/Y", payload)` → `useXxxStore().Y(payload)` -------
    //   pattern: <var>store.dispatch('user/login', p) → useUserStore().login(p)
    //   payload 是第 2 个 arg, 可选
    const before3 = processTarget
    processTarget = processTarget.replace(
      /(?<![.\w$])\w*store\.dispatch\s*\(\s*(['"`])([^'"`]+)\1\s*([,]?\s*([^)]*))\)/g,
      (_m, q, type, _hasComma, payloadRaw) => {
        const parts = type.split('/')
        if (parts.length !== 2) {
          reviewItems.push(
            `store.dispatch('${type}', ...) 形式不规范,需要 'storeName/actionName' 格式,已 fallback 到 useAppStore。`,
          )
          const exportName = storeIdToExportName(DEFAULT_STORE)
          storeImportsNeeded.add(exportName)
          return payloadRaw && payloadRaw.trim() ? `${exportName}().dispatch(${payloadRaw.trim()})` : `${exportName}()`
        }
        const [storeName, actionName] = parts
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        // payload 清理: 如果 payload 是空 (e.g. `, ` 或只有空白), 不传参
        const trimmed = (payloadRaw || '').replace(/^[,\s]+/, '').trim()
        if (trimmed) {
          return `${exportName}().${actionName}(${trimmed})`
        }
        return `${exportName}().${actionName}()`
      },
    )

    // ------- 4. `store.getters.X` → `useXxxStore().X` -------
    //   推断: 用 GETTER_TO_STORE 查表, fallback 到 useAppStore
    const before4 = processTarget
    processTarget = processTarget.replace(
      /(?<![.\w$])\w*store\.getters\.([a-zA-Z_]\w*)\b/g,
      (_m, getterName) => {
        const storeName = GETTER_TO_STORE[getterName] || DEFAULT_STORE
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        if (!GETTER_TO_STORE[getterName]) {
          reviewItems.push(
            `store.getters.${getterName} 未知 getter,fallback 到 use${storeName.charAt(0).toUpperCase() + storeName.slice(1)}Store()。请确认实际 store 名字。`,
          )
        }
        return `${exportName}().${getterName}`
      },
    )

    // ------- 5. `store.commit("X/Y", payload)` → `useXxxStore().Y(payload)` -------
    //   vuex-pinia 把 mutation 转成 action, 所以 commit 调用应该全部用 action 形式
    //   如果 Y 是原 mutation (大写命名), vuex-pinia 仍然保留了它作为 action (例如 SET_TOKEN)
    //   所以 `useXxxStore().SET_TOKEN(p)` 是合法调用
    const before5 = processTarget
    processTarget = processTarget.replace(
      /(?<![.\w$])\w*store\.commit\s*\(\s*(['"`])([^'"`]+)\1\s*([,]?\s*([^)]*))\)/g,
      (_m, _q, type, _hasComma, payloadRaw) => {
        const parts = type.split('/')
        if (parts.length !== 2) {
          reviewItems.push(
            `store.commit('${type}', ...) 形式不规范, fallback 到 useAppStore。`,
          )
          const exportName = storeIdToExportName(DEFAULT_STORE)
          storeImportsNeeded.add(exportName)
          return payloadRaw && payloadRaw.trim() ? `${exportName}().commit(${payloadRaw.trim()})` : `${exportName}()`
        }
        const [storeName, mutationName] = parts
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        const trimmed = (payloadRaw || '').replace(/^[,\s]+/, '').trim()
        if (trimmed) {
          return `${exportName}().${mutationName}(${trimmed})`
        }
        return `${exportName}().${mutationName}()`
      },
    )

    // ------- 6. bare `commit("X", p)` / `dispatch("X", p)` (没有 store. 前缀) -------
    //   这种情况一般来自 methods 里直接 `this.commit(...)` 写错的(不常见),或者解构了 store
    //   (rare). 仅在用户 store useStore 解构时出现.
    //   pattern: commit('user/SET_TOKEN', token) → useUserStore().SET_TOKEN(token)
    //   注意: 用 negative lookbehind `(?<!\.)` 避免误匹配 this.$store.commit (那种是 6.5 步处理的)
    processTarget = processTarget.replace(
      /(?<![.\w$])commit\s*\(\s*(['"`])([^'"`]+)\1\s*([,]?\s*([^)]*))\)/g,
      (_m, _q, type, _hasComma, payloadRaw) => {
        if (type.indexOf('/') === -1) return _m  // 不动
        const parts = type.split('/')
        const [storeName, actionName] = parts
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        const trimmed = (payloadRaw || '').replace(/^[,\s]+/, '').trim()
        return trimmed ? `${exportName}().${actionName}(${trimmed})` : `${exportName}().${actionName}()`
      },
    )
    processTarget = processTarget.replace(
      /(?<![.\w$])dispatch\s*\(\s*(['"`])([^'"`]+)\1\s*([,]?\s*([^)]*))\)/g,
      (_m, _q, type, _hasComma, payloadRaw) => {
        if (type.indexOf('/') === -1) return _m  // 不动
        const parts = type.split('/')
        const [storeName, actionName] = parts
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        const trimmed = (payloadRaw || '').replace(/^[,\s]+/, '').trim()
        return trimmed ? `${exportName}().${actionName}(${trimmed})` : `${exportName}().${actionName}()`
      },
    )

    // ------- 6.5. `this.$store.X.Y` 模式 (Options API 源,常见于 mixin / utility) -------
    //   `this.$store.state.app.device` → `useAppStore().device`
    //   `this.$store.dispatch('user/login', p)` → `useUserStore().login(p)`
    //   `this.$store.getters.token` → `useUserStore().token`
    //   `this.$store.commit('user/SET_TOKEN', t)` → `useUserStore().SET_TOKEN(t)`
    //   注意: 这是 Options API 源(可能是 .vue 里 mixin,或者 .js 文件)。
    //   改成调用具体 useXxxStore() 后,还需要在文件顶部加 const X = useXxxStore() 才能用。
    //   简单做法: 让所有 `this.$store.X` 全部直接调用 useXxxStore()(self-call 形式),这样
    //   不需要 const X = useXxxStore() 也能用. useXxxStore() 是 idempotent / cached,多次调没问题.
    //
    //   6.5a. this.$store.state.X.Y
    processTarget = processTarget.replace(
      /\bthis\.\$store\.state\.([a-zA-Z_]\w*)\.(\w+(\.[a-zA-Z_]\w*)*)/g,
      (_m, storeName, subKey) => {
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        return `${exportName}().${subKey}`
      },
    )
    processTarget = processTarget.replace(
      /\bthis\.\$store\.state\.([a-zA-Z_]\w*)\b(?![\.\[])/g,
      (_m, storeName) => {
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        return `${exportName}()`
      },
    )
    //   6.5b. this.$store.dispatch('X/Y', p)
    processTarget = processTarget.replace(
      /\bthis\.\$store\.dispatch\s*\(\s*(['"`])([^'"`]+)\1\s*([,]?\s*([^)]*))\)/g,
      (_m, _q, type, _hasComma, payloadRaw) => {
        const parts = type.split('/')
        if (parts.length !== 2) {
          reviewItems.push(`this.$store.dispatch('${type}', ...) 形式不规范,fallback 到 useAppStore。`)
          const exportName = storeIdToExportName(DEFAULT_STORE)
          storeImportsNeeded.add(exportName)
          return payloadRaw && payloadRaw.trim() ? `${exportName}().dispatch(${payloadRaw.trim()})` : `${exportName}()`
        }
        const [storeName, actionName] = parts
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        const trimmed = (payloadRaw || '').replace(/^[,\s]+/, '').trim()
        return trimmed ? `${exportName}().${actionName}(${trimmed})` : `${exportName}().${actionName}()`
      },
    )
    //   6.5c. this.$store.getters.X
    processTarget = processTarget.replace(
      /\bthis\.\$store\.getters\.([a-zA-Z_]\w*)\b/g,
      (_m, getterName) => {
        const storeName = GETTER_TO_STORE[getterName] || DEFAULT_STORE
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        if (!GETTER_TO_STORE[getterName]) {
          reviewItems.push(`this.$store.getters.${getterName} 未知 getter,fallback 到 use${storeName.charAt(0).toUpperCase() + storeName.slice(1)}Store()。`)
        }
        return `${exportName}().${getterName}`
      },
    )
    //   6.5d. this.$store.commit('X/Y', p)
    processTarget = processTarget.replace(
      /\bthis\.\$store\.commit\s*\(\s*(['"`])([^'"`]+)\1\s*([,]?\s*([^)]*))\)/g,
      (_m, _q, type, _hasComma, payloadRaw) => {
        const parts = type.split('/')
        if (parts.length !== 2) {
          reviewItems.push(`this.$store.commit('${type}', ...) 形式不规范。`)
          const exportName = storeIdToExportName(DEFAULT_STORE)
          storeImportsNeeded.add(exportName)
          return payloadRaw && payloadRaw.trim() ? `${exportName}().commit(${payloadRaw.trim()})` : `${exportName}()`
        }
        const [storeName, mutationName] = parts
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        const trimmed = (payloadRaw || '').replace(/^[,\s]+/, '').trim()
        return trimmed ? `${exportName}().${mutationName}(${trimmed})` : `${exportName}().${mutationName}()`
      },
    )
    //   6.5e. 单独 `this.$store` (没有 .X) →  useAppStore() 兜底
    processTarget = processTarget.replace(
      /\bthis\.\$store\b(?!\.)/g,
      () => {
        const exportName = storeIdToExportName(DEFAULT_STORE)
        storeImportsNeeded.add(exportName)
        return `${exportName}()`
      },
    )

    // ------- 6.6. 处理 .js 文件里的 `import store from '@/store'` (default import) -------
    //   旧 vuex 项目: import store from '@/store' → store.getters.X / store.dispatch('X/Y', p)
    //   pinia 没有 default store instance,改用 useXxxStore() 替换.
    //   删掉 default import,然后用前面的规则 2-5 替换 store.X.Y.
    //   这一步必须在所有 store.* 替换之前做 — 但其实已经做了,这里只清 default import.
    processTarget = processTarget.replace(
      /import\s+store\s+from\s+['"]@\/store['"]\s*;?/g,
      '',
    )
    // 同样的: import store from '@/store/modules/xxx'
    processTarget = processTarget.replace(
      /import\s+store\s+from\s+['"]@\/store\/modules\/[a-zA-Z_]\w*['"]\s*;?/g,
      '',
    )
    // 侧链 import: `import '@/store'` 这种(没绑定) — 保留(它有副作用: createPinia)
    //   但是 `'@/store';` 这种(只有引号,没 store 名字) — 已经处理,跳过

    // ------- 6.7. 清理 `store.getters &&` / `store.state &&` / `store.dispatch &&` 短路检查 -------
    //   旧 vuex 代码常用 `const roles = store.getters && store.getters.roles` 作为
    //   "is store initialized?" 防御 (store 可能 undefined, 在 vue-router beforeEach 等).
    //   上面规则已经把 `store.getters.roles` 替换成 `useUserStore().roles`,
    //   但 `store.getters &&` 还在, 留下 `useUserStore().roles` 前一段死代码.
    //   模式: `store.X && store.X.Y` 或 `store.X && useXxxStore().Y` → 仅保留右侧.
    //   必须放在 store.* / useXxxStore() 替换之后 (左侧 store.getters 已被用, 右侧已替换).
    //   这里清掉 `store.getters && ` / `store.state && ` / `store.dispatch && ` / `store.commit && `
    //   这种左侧短路, 不管右侧是哪种.
    //   注意: 用 negative lookbehind 避免误匹配 `this.$store.X &&` (那种已由 6.5 处理).
    processTarget = processTarget.replace(
      /(?<![.\w$])([a-zA-Z_]\w*)\b\.(getters|state|dispatch|commit)\s*&&(\s*)(?=(?:[a-zA-Z_]\w*\.(?:getters|state|dispatch|commit)|use[A-Z]\w*Store\s*\(\s*\)))/g,
      '',
    )
    // 同样的 `||` 短路: `store.getters || store.getters.roles` → 留右侧
    processTarget = processTarget.replace(
      /(?<![.\w$])([a-zA-Z_]\w*)\b\.(getters|state|dispatch|commit)\s*\|\|(\s*)(?=(?:[a-zA-Z_]\w*\.(?:getters|state|dispatch|commit)|use[A-Z]\w*Store\s*\(\s*\)))/g,
      '',
    )
    // 同样: `this.$store.X && this.$store.X.Y` 短路清理 (用 \b 避免误伤)
    processTarget = processTarget.replace(
      /\bthis\.\$store\.(getters|state|dispatch|commit)\s*&&(\s*)(?=(?:this\.\$store\.(?:getters|state|dispatch|commit)|use[A-Z]\w*Store\s*\(\s*\)))/g,
      '',
    )
    processTarget = processTarget.replace(
      /\bthis\.\$store\.(getters|state|dispatch|commit)\s*\|\|(\s*)(?=(?:this\.\$store\.(?:getters|state|dispatch|commit)|use[A-Z]\w*Store\s*\(\s*\)))/g,
      '',
    )

    // ------- 6.8. 智能修正 `useAppStore().X` 当 X 实际在别的 store -------
    //   composition plugin 在 mapGetters / mapState 时, 默认生成 `useAppStore().X`,
    //   但实际上 X 可能在 user / settings / tagsView 等别的 store (vue-element-admin 的常见情况).
    //   用 GETTER_TO_STORE 表查找 X 实际属于哪个 store, 替换成 useXxxStore().X.
    //   跳过 useAppStore 自身 (它内部的字段不在 GETTER_TO_STORE 表里, fallback 保持不变).
    //   跳过 action (dispatch 内部 useXxxStore().Y(p) 是已知的正确转换, 不动).
    //   注意: 只针对 useXxxStore().identifier 形式, 不包括 .identifier.identifier
    //   (后者是嵌套访问, 不知道深度, 不动).
    processTarget = processTarget.replace(
      /\buseAppStore\s*\(\s*\)\.([a-zA-Z_]\w*)\b(?!\s*[\(\.])/g,
      (_m, fieldName) => {
        const storeName = GETTER_TO_STORE[fieldName]
        if (!storeName || storeName === 'app') return _m
        const exportName = storeIdToExportName(storeName)
        storeImportsNeeded.add(exportName)
        reviewItems.push(
          `useAppStore().${fieldName} 已改为 use${storeName.charAt(0).toUpperCase() + storeName.slice(1)}Store().${fieldName} (按 GETTER_TO_STORE 表查表, ${fieldName} 在 ${storeName} store)`,
        )
        return `${exportName}().${fieldName}`
      },
    )

    // ------- 7. 更新 import: 把 storeImportsNeeded 加到 import 列表 -------
    if (storeImportsNeeded.size > 0) {
      // 检查是否已有 `import { useXxxStore, useYyyStore } from '@/store'` 或类似
      const storeImportRe = /import\s*\{([^}]*)\}\s*from\s*['"]@\/store['"]/
      const newImports = Array.from(storeImportsNeeded).sort()
      if (storeImportRe.test(processTarget)) {
        // 已存在 store import, 把缺的加进去
        processTarget = processTarget.replace(
          storeImportRe,
          (_m, existing: string) => {
            const existingNames = new Set(
              existing.split(',').map((s) => s.trim()).filter(Boolean),
            )
            const toAdd = newImports.filter((n) => !existingNames.has(n))
            const allNames = Array.from(new Set([...existingNames, ...toAdd])).sort()
            return `import { ${allNames.join(', ')} } from '@/store'`
          },
        )
      } else {
        // 没有 store import, 加一行
        // 插在第一个 import 后面
        const importLine = `import { ${newImports.join(', ')} } from '@/store'`
        const firstImportMatch = processTarget.match(/^[ \t]*import\b[^\n]+/m)
        if (firstImportMatch && firstImportMatch.index !== undefined) {
          const insertPos = firstImportMatch.index + firstImportMatch[0].length
          processTarget = processTarget.substring(0, insertPos) + '\n' + importLine + processTarget.substring(insertPos)
        } else {
          // 没找到任何 import, 加到顶部
          processTarget = importLine + '\n' + processTarget
        }
      }
      changed = true
    }

    if (processTarget !== originalProcessTarget) {
      changed = true
    }

    // ------- 8. 写回 file.source -------
    //   同时把 file.useRawSource = true, 这样 codegen 用我们的 source (避免被 stale AST 覆盖)
    if (changed) {
      if (isVue) {
        file.source = file.source.substring(0, targetStart) + processTarget + file.source.substring(targetEnd)
      } else {
        file.source = processTarget
      }
      file.useRawSource = true
      for (const r of reviewItems) utils.manualReview(r)
      utils.markChanged(`[store-bridge] ${storeImportsNeeded.size} stores bridged (${Array.from(storeImportsNeeded).join(', ')})`)
    } else {
      // 仍然输出 review (即使没改 source, 用户也希望看到)
      for (const r of reviewItems) utils.manualReview(r)
    }
  },
}

registerPlugin(plugin)
export default plugin
