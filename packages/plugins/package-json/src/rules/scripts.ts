/**
 * scripts 转换
 *
 * 规则：
 *   1) key 重命名: `serve` → `dev`
 *   2) command 重写: `vue-cli-service <cmd>` → 等价的 Vite/原生命令
 *   3) 未知 command 原样保留
 *
 * vue-cli-service 命令 → Vite 等价命令：
 *   serve     → vite
 *   build     → vite build
 *   lint      → eslint --ext .js,.vue,.ts src
 *   inspect   → vite inspect
 *   test:unit → vitest run
 */

const KEY_RENAME: Record<string, string> = {
  'serve': 'dev',
}

const CMD_REWRITE: Record<string, string> = {
  'vue-cli-service serve': 'vite',
  'vue-cli-service build': 'vite build',
  'vue-cli-service lint': 'eslint --ext .js,.vue,.ts src',
  'vue-cli-service inspect': 'vite inspect',
  'vue-cli-service test:unit': 'vitest run',
  'vue-cli-service test': 'vitest',
}

export function applyScriptMap(
  scripts: Record<string, string> | undefined,
): { scripts: Record<string, string>; changes: string[] } {
  const out: Record<string, string> = {}
  const changes: string[] = []
  if (!scripts) return { scripts: out, changes }

  for (const [k, v] of Object.entries(scripts)) {
    const newKey = KEY_RENAME[k] ?? k
    const newVal = CMD_REWRITE[v] ?? v
    out[newKey] = newVal
    if (newKey !== k) {
      changes.push(`重命名 scripts.${k} → ${newKey}: ${newVal}`)
    } else if (newVal !== v) {
      changes.push(`改 scripts.${k}: ${v} → ${newVal}`)
    }
  }
  return { scripts: out, changes }
}
