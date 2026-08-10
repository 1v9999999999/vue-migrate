/**
 * @vue-migrate/plugin-vite-compat
 *
 * Vue2 → Vue3 浏览器/Vite 兼容性规则
 *
 * 职责：
 *   - 标记 Node.js 内置模块（`path` / `fs` / `process.env`）的浏览器/ESM 兼容性问题
 *   - 在 pinia 上下文中，识别 `store.dispatch / store.getters / store.state` 这类 Vuex 风格调用
 *     并提示需要重写为 `useXxxStore().xxx` 形式
 *   - 检测 echarts@4.x 旧 API，并建议升级到 5
 *   - 在 package.json 中标记存在但与 Vue3 不兼容的包
 *
 * 策略：
 *   - 只做识别 + 警告（manualReview），不做激进重写
 *   - 在 .js / .ts / .vue 文件的 scriptAst 上跑
 *   - 对 package.json 文件单独处理（看是否有 vue2 时代依赖）
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

/** Node-only 内置模块名 */
const NODE_BUILTIN_MODULES = new Set([
  'path',
  'fs',
  'fs/promises',
  'os',
  'child_process',
  'crypto',
  'http',
  'https',
  'url',
  'util',
  'stream',
  'events',
  'buffer',
])

/** Vue2 时代但与 Vue3/Vite 兼容性差的包 */
const VUE2_ONLY_PACKAGES = new Set([
  'vuedraggable',
  'vue-count-to',
  'vue-splitpane',
  'tui-editor',
  'driver.js',
  'screenfull',
  'echarts@4',
])

function applyNodeBuiltinReview(file: any, utils: any): void {
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  traverse(ast, {
    ImportDeclaration(path: any) {
      const node = path.node
      const src = node.source.value
      if (typeof src !== 'string') return
      // `import path from "path"` / `import { join } from "path"`
      if (NODE_BUILTIN_MODULES.has(src)) {
        utils.manualReview(
          `import ... from "${src}" 浏览器/Vite 不支持 Node 内置模块。请改用对应的 browserify/polyfill 包（如 path-browserify、fs-browserify、util 等），或改写为 import.meta.url + URL 形式。`,
        )
        utils.markChanged(`node-builtin import: ${src}`)
      }
    },
  })
}

function applyStoreContextReview(file: any, utils: any): void {
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  // 仅在 .vue 文件中（composition 转换后通常是 .vue）扫描
  // store 的类型需要推断：可能是 Vuex（dispatch/getters/state 都有），
  // 也可能是 pinia（getters = computed refs，dispatch 通常用 store.action() 或 store.$patch()）
  // 这里采取"标 review 不动"的保守策略。
  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      if (
        t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object, { name: 'store' }) &&
        t.isIdentifier(node.callee.property, { name: 'dispatch' })
      ) {
        // 仅在参数为 `"xxx/yyy"` 字符串（Vuex namespace 风格）时提示
        if (
          node.arguments.length >= 1 &&
          t.isStringLiteral(node.arguments[0]) &&
          node.arguments[0].value.includes('/')
        ) {
          utils.manualReview(
            `store.dispatch("${node.arguments[0].value}", ...) 是 Vuex 风格。pinia 改为 useXxxStore().yyy(payload)。`,
          )
          utils.markChanged('store.dispatch Vuex-style call')
        }
      }
    },

    MemberExpression(path: any) {
      const node = path.node
      if (
        !t.isIdentifier(node.object, { name: 'store' }) ||
        !t.isIdentifier(node.property)
      ) {
        return
      }
      const prop = node.property.name
      if (prop === 'getters') {
        // store.getters.xxx — 在 pinia 中 getters 是 useStore().xxx
        // 但不能 100% 确定是 pinia；标 review 让用户确认
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = path
        utils.manualReview(
          `store.getters.xxx 可能是 Vuex getter（pinia 改为 useXxxStore().xxx）。如果 store 是 vuex 4 + useStore()，保持原样。`,
        )
        utils.markChanged('store.getters reference')
      } else if (prop === 'state') {
        utils.manualReview(
          `store.state.xxx 可能是 Vuex state（pinia 改为 useXxxStore().xxx）。如果 store 是 vuex 4 + useStore()，保持原样。`,
        )
        utils.markChanged('store.state reference')
      } else if (prop === 'commit') {
        if (
          path.parent.type === 'CallExpression' &&
          path.parent.arguments[0] &&
          t.isStringLiteral(path.parent.arguments[0]) &&
          (path.parent.arguments[0] as t.StringLiteral).value.includes('/')
        ) {
          utils.manualReview(
            `store.commit("xxx/yyy", ...) 是 Vuex mutation。pinia 没有 mutation，改为 useXxxStore().yyy(payload) 或 store.$patch({...})。`,
          )
        }
      }
    },
  })
}

function applyEchartsReview(file: any, utils: any): void {
  // 只在 .vue / .ts / .js 的 import 语句里识别 `echarts`
  if (!file.scriptAst) return
  const ast = file.scriptAst
  if (!t.isFile(ast)) return

  traverse(ast, {
    ImportDeclaration(path: any) {
      const node = path.node
      if (node.source.value !== 'echarts') return
      // 注意：版本检查需要 package.json 信息。简单做法是直接提示
      utils.manualReview(
        'echarts 包 import 未指定版本。Vue3 + Vite 项目建议使用 echarts@5+。echarts@4 的 CJS 入口在 Vite ESM 环境下会失败。',
      )
    },
    CallExpression(path: any) {
      // require('echarts') 形式
      const node = path.node
      if (
        t.isIdentifier(node.callee, { name: 'require' }) &&
        node.arguments.length === 1 &&
        t.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].value === 'echarts'
      ) {
        utils.manualReview(
          "require('echarts') 是 CJS 形式，Vite 浏览器不直接支持。建议改 import echarts from 'echarts'（升 5+）",
        )
      }
    },
  })
}

const plugin: TransformPlugin = {
  name: 'vite-compat',
  description:
    'Mark Node.js builtin imports (path/fs/process.env) and Vuex-style store calls (dispatch/getters/state/commit) for manual review in pinia/Vite contexts.',
  priority: 5, // 在 composition 之后跑，看到 setup 后的代码
  fileKinds: ['vue', 'js', 'ts'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx

    if (file.scriptAst) {
      applyNodeBuiltinReview(file, utils)
      applyStoreContextReview(file, utils)
      applyEchartsReview(file, utils)
    }

    // package.json 单独处理
    if (file.path && file.path.endsWith('package.json')) {
      applyPackageJsonReview(file, utils)
    }
  },
}

function applyPackageJsonReview(file: any, utils: any): void {
  try {
    const pkg = JSON.parse(file.source)
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    }

    for (const dep of Object.keys(allDeps)) {
      const version = String(allDeps[dep] || '')
      // 检查 vuedraggable@<2 / vue-count-to@1.x / vue-splitpane@1.x
      if (
        dep === 'vuedraggable' ||
        dep === 'vue-count-to' ||
        dep === 'vue-splitpane' ||
        dep === 'tui-editor' ||
        dep === 'driver.js'
      ) {
        utils.manualReview(
          `package.json: "${dep}@${version}" 是 Vue2 时代依赖，Vue3 需替换为 vuedraggable@next / vue3-count-to / 等。`,
        )
      }
      if (dep === 'echarts' && /^[\^~]?4\./.test(version)) {
        utils.manualReview(
          `package.json: "echarts@${version}" 旧版 CJS，Vite ESM 失败。建议升级到 echarts@5。`,
        )
      }
      if (dep === 'screenfull' && /^[\^~]?4\./.test(version)) {
        utils.manualReview(
          `package.json: "screenfull@${version}" CJS 入口。升级到 screenfull@6 获得 ESM 入口。`,
        )
      }
    }
  } catch {
    // invalid json, skip
  }
}

// iter-045a: 暴露内部函数给单测用（避免 export 命名冲突）
export const _testable_applyNodeBuiltinReview = applyNodeBuiltinReview
export const _testable_applyStoreContextReview = applyStoreContextReview
export const _testable_applyEchartsReview = applyEchartsReview
export const _testable_applyPackageJsonReview = applyPackageJsonReview

registerPlugin(plugin)
export default plugin
