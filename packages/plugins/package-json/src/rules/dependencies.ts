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
}

export const DEP_MAP: Record<string, DepMapEntry> = {
  // Vue 核心
  'vue': { name: 'vue', version: '^3.4.0' },
  // 路由
  'vue-router': { name: 'vue-router', version: '^4.2.0' },
  // 状态管理（vuex → pinia 跨多个 entry，需 pinia 插件协同）
  'vuex': { name: 'pinia', version: '^2.1.0' },
  // UI 库
  'element-ui': { name: 'element-plus', version: '^2.4.0' },
  // Vue 2 时代产物
  'vue-template-compiler': { name: '', remove: true },
  'vue-cli-plugin-element': { name: '', remove: true },
  'vue-cli-plugin-typescript': { name: '', remove: true },
  'vue-cli-plugin-babel': { name: '', remove: true },
  'vue-cli-plugin-pwa': { name: '', remove: true },
  'vue-cli-plugin-eslint': { name: '', remove: true },
  'vue-cli-plugin-unit-jest': { name: '', remove: true },
  // @vue/cli-plugin-* 全部删除
  // @vue/compiler-sfc 保留
  '@vue/compiler-sfc': { name: '@vue/compiler-sfc', version: '^3.4.0' },
  // @vue/cli-service 核心服务（被 Vite 替代）
  '@vue/cli-service': { name: '', remove: true },
  // vue-loader
  'vue-loader': { name: 'vue-loader', version: '^17.4.0' },
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
    } else {
      out[k] = v
    }
  }
  return { deps: out, changes }
}
