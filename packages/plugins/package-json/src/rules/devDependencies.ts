/**
 * devDependencies 转换
 *
 * 主要工作：
 *   1) 复用 dependencies 的映射表（DEP_MAP）
 *   2) 注入 Vite 相关依赖（如果不存在）
 *
 * 注入的依赖：
 *   - vite: ^5.0.0
 *   - @vitejs/plugin-vue: ^5.0.0
 */

import { applyDepMap, DEP_MAP } from './dependencies.js'

const VITE_DEPS: Record<string, string> = {
  'vite': '^5.0.0',
  '@vitejs/plugin-vue': '^5.0.0',
}

export function applyDevDepMap(
  deps: Record<string, string> | undefined,
  injectVite: boolean,
): { deps: Record<string, string>; changes: string[] } {
  const result = applyDepMap(deps)
  const out = result.deps
  const changes = result.changes

  if (injectVite) {
    for (const [k, v] of Object.entries(VITE_DEPS)) {
      if (!out[k]) {
        out[k] = v
        changes.push(`注入 devDependencies.${k}@${v}`)
      }
    }
  }

  return { deps: out, changes }
}
