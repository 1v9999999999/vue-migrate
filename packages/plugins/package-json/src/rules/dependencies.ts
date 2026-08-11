/**
 * 依赖名映射表
 *
 * 规则：
 *   - value 为空字符串 + remove: true → 删除该依赖
 *   - value 存在 → 重命名到 value，并应用新版本（若指定 version）
 *
 * 涵盖 Vue 2 → Vue 3 主流依赖迁移：
 *   - vue: ^2.x → ^3.4
 *   - vue-router: ^3.x → ^4.2
 *   - vuex: ^3.x / ^4.x → 删（由 pinia 替代）
 *   - element-ui: ^2.x → element-plus: ^2.4
 *   - vue-template-compiler: 删（Vue 3 不再需要）
 *   - vue-cli-plugin-* : 删
 *   - @vue/cli-plugin-* : 删
 *   - vue-loader: ^15 → ^17
 *   - @vue/compiler-sfc: ^3 (如已存在则保持)
 */

export interface DepMapEntry {
  /** 替换后的依赖名（空字符串表示删除） */
  name: string
  /** 替换后的版本（如不指定则沿用原值） */
  version?: string
  /** 是否删除原依赖 */
  remove?: boolean
  /**
   * manual review 提示（被附加到 changes[] 输出末尾）。
   * 标记该依赖的升级有 breaking change 或无法自动迁移，提示用户手动检查。
   * - 仍会升版本到 version（如有指定）
   * - 不会自动删 / 改名
   */
  manualReview?: string
}

export const DEP_MAP: Record<string, DepMapEntry> = {
  // ============ Vue 核心 / 路由 / 状态 / UI 库 ============
  'vue': { name: 'vue', version: '^3.4.0' },
  'vue-router': { name: 'vue-router', version: '^4.2.0' },
  // vuex v3 与 Vue3 不兼容；当前用 pinia 替代
  'vuex': { name: 'pinia', version: '^2.1.0' },
  'element-ui': { name: 'element-plus', version: '^2.4.0' },

  // ============ Vue 2 时代产物（删除） ============
  'vue-template-compiler': { name: '', remove: true },
  'vue-cli-plugin-element': { name: '', remove: true },
  'vue-cli-plugin-typescript': { name: '', remove: true },
  'vue-cli-plugin-babel': { name: '', remove: true },
  'vue-cli-plugin-pwa': { name: '', remove: true },
  'vue-cli-plugin-eslint': { name: '', remove: true },
  'vue-cli-plugin-unit-jest': { name: '', remove: true },
  // @vue/cli-plugin-* 通配删除
  '@vue/compiler-sfc': { name: '@vue/compiler-sfc', version: '^3.4.0' },
  '@vue/cli-service': { name: '', remove: true },
  'vue-loader': { name: 'vue-loader', version: '^17.4.0' },

  // ============ 3rd-party 库升级（Vue 3 兼容） ============
  // vuedraggable: v2 用 Vue.extend,Vue3 启动即崩 → v4 用 Composition API
  'vuedraggable': {
    name: 'vuedraggable',
    version: '^4.1.0',
    manualReview:
      'vuedraggable v2→v4 有 API 变化：默认导出改为 named export `draggable`；原 v2 `import draggable from "vuedraggable"` 需改为 `import { draggable } from "vuedraggable"` 并设置 `componentName: "draggable"`。同时依赖 sortablejs v1.15+。',
  },
  // vue-count-to: v1 内部用 Vue.extend 模板字符串 → v2 改写为 Vue3 SFC
  'vue-count-to': {
    name: 'vue-count-to',
    version: '^2.0.0',
    manualReview:
      'vue-count-to v1→v2 重写为 Vue3 SFC；组件名默认导出仍为 "CountTo"，但 props 命名/事件签名可能微调。Kanban/DndList/count-to 页面需手动验证渲染。',
  },
  // echarts: v4 CJS-only + 不支持 ESM `import echarts` 严格模式 → v5 原生 ESM
  'echarts': {
    name: 'echarts',
    version: '^5.5.0',
    manualReview:
      'echarts v4→v5 是大版本升级，v5 原生 ESM；Vite 项目必须使用 `import * as echarts from "echarts"` 或具名 import；旧 `import echarts from "echarts"` 在 Vite SSR/strict 模式下会报 "default is not exported"。所有 Charts/* 和 dashboard 包装组件需检查 import 形式。',
  },
  // screenfull: v4 是 CJS,vite default 导入失败 → v6 原生 ESM
  'screenfull': {
    name: 'screenfull',
    version: '^6.0.0',
    manualReview:
      'screenfull v4→v6 升级到 ESM（但只有 default export）；API 完全兼容。`import screenfull from "screenfull"` 在 Vite 5 下能直接跑，无需改 namespace import。',
  },
  // driver.js: 0.x 老旧 → 1.x 改 API
  'driver.js': {
    name: 'driver.js',
    version: '^1.3.0',
    manualReview:
      'driver.js 0.x→1.x API 调整：`new Driver({...})` 改为 `new Driver({ className, ...})`，`driver.defineSteps([...])` 改 `driver.setSteps([...])`。guide/index.vue 需手动适配。',
  },
  // tui-editor: 1.x 已弃用,官方迁移到无 Vue 包装的 @toast-ui/editor
  'tui-editor': {
    name: '@toast-ui/editor',
    version: '^3.2.0',
    manualReview:
      'tui-editor 1.x 已停止维护;新版不再提供 Vue 包装。本自动迁移会改包名但不会自动加 Vue3 包装;markdown.vue 等需重写或换 monaco-editor / codemirror 6。',
  },
  // @element-plus/icons-vue: Element Plus 2.3+ 才有. 如果代码里 import 自这个包, 但 deps 缺, 必须注入
  // (P0 #4: 13+ 个文件 import 自 @element-plus/icons-vue 但 package.json 缺这个包 → build 挂)
  '@element-plus/icons-vue': {
    name: '@element-plus/icons-vue',
    version: '^2.3.0',
  },
  // vue-splitpane: 1.0.4 是 Vue2 only，社区有 Vue3 fork
  'vue-splitpane': {
    name: 'vue-splitpane',
    version: '^1.0.6',
    manualReview:
      'vue-splitpane 官方 1.0.4 是 Vue2 only（内部 Vue.component + slot）。社区有 1.0.6 Vue3 fork 但不保证 100% 兼容；split-pane.vue 演示页可能渲染失败，建议自实现一个简单 split-pane 组件。',
  },

  // ============ devDeps 也通过 DEP_MAP 生效（devDependencies 复用 DEP_MAP） ============
  // @vue/test-utils: v1 配合 Vue 2 / vue-jest 4；v2 配合 Vue 3 / @vue/vue3-jest
  '@vue/test-utils': {
    name: '@vue/test-utils',
    version: '^2.4.0',
    manualReview:
      '@vue/test-utils v1→v2 大改 API：$on/$off/$once 移除，propsData 改 props，contains 改 find().exists()。同时 jest.config.js 需把 vue-jest 改 @vue/vue3-jest。tests/unit/** 需要逐个迁移。',
  },
  // jest → vitest 替换
  'jest': { name: 'vitest', version: '^1.0.0' },
  'babel-jest': { name: 'vitest', version: '^1.0.0' },
  'vue-jest': { name: '@vue/vue3-jest', version: '^29.0.0' },
  // webpack 专属：删
  'html-webpack-plugin': { name: '', remove: true },
  'script-ext-html-webpack-plugin': { name: '', remove: true },
  'svg-sprite-loader': { name: '', remove: true },
  'script-loader': { name: '', remove: true },
  'babel-plugin-dynamic-import-node': { name: '', remove: true },
  'babel-eslint': { name: '@babel/eslint-parser', version: '^7.23.0' },
  // path-browserify: Vite 浏览器没有 node:path，需要 polyfill
  'path': { name: 'path-browserify', version: '^1.0.1' },
}

/** 哪些 @vue/cli-plugin-* 通配删除 */
export function isVueCliPlugin(name: string): boolean {
  return /^@vue\/cli-plugin-/.test(name)
}

/** 应用依赖映射；返回新依赖对象 + 改动列表 */
export function applyDepMap(
  deps: Record<string, string> | undefined,
): { deps: Record<string, string>; changes: string[] } {
  const out: Record<string, string> = {}
  const changes: string[] = []
  if (!deps) return { deps: out, changes }

  for (const [k, v] of Object.entries(deps)) {
    // 通配删除 @vue/cli-plugin-*
    if (isVueCliPlugin(k)) {
      changes.push(`移除 ${k}@${v}`)
      continue
    }
    const m = DEP_MAP[k]
    if (m) {
      if (m.remove) {
        changes.push(`移除 ${k}@${v}`)
        continue
      }
      out[m.name] = m.version ?? v
      if (m.name !== k) {
        changes.push(`改 ${k}@${v} → ${m.name}@${out[m.name]}`)
      } else if (m.version && m.version !== v) {
        changes.push(`升 ${k}: ${v} → ${m.version}`)
      }
      // manualReview 提示：在改动后追加一个 ⚠️ 标记
      if (m.manualReview) {
        changes.push(`⚠ ${k}→${m.name} 需 review: ${m.manualReview}`)
      }
    } else {
      out[k] = v
    }
  }
  return { deps: out, changes }
}
