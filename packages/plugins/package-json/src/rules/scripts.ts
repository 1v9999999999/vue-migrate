/**
 * scripts 转换
 *
 * 规则：
 *   1) key 重命名: `serve` → `dev`
 *   2) command 重写: 任意位置出现的 `vue-cli-service <subcmd>` → 等价的 Vite/原生命令
 *      - 支持子串匹配（不要求整条脚本就是这个命令）
 *      - 支持 `&&` / `||` / `;` 复合命令里嵌入的命令
 *      - 保留 `vue-cli-service <subcmd>` 之后的 args（直到 `&&` / `||` / `;` / 行尾为止）
 *   3) 未知 command 原样保留
 *
 * vue-cli-service 命令 → Vite 等价命令：
 *   serve     → vite
 *   build     → vite build
 *   lint      → eslint --ext .js,.vue,.ts src
 *   inspect   → vite inspect
 *   test:unit → vitest run
 *   test      → vitest
 */

const KEY_RENAME: Record<string, string> = {
  'serve': 'dev',
}

/** `vue-cli-service <subcmd>` → 等价命令 */
const CMD_REWRITE: Record<string, string> = {
  'vue-cli-service serve': 'vite',
  'vue-cli-service build': 'vite build',
  'vue-cli-service lint': 'eslint --ext .js,.vue,.ts src',
  'vue-cli-service inspect': 'vite inspect',
  'vue-cli-service test:unit': 'vitest run',
  'vue-cli-service test': 'vitest',
}

/** 顶级命令分隔符（含周围空白） */
const SEGMENT_SPLIT = /\s*(?:\|\||&&|;)\s*/

/**
 * 把单条 script value 里的 `vue-cli-service <subcmd>` 替换成等价命令。
 *
 * 例:
 *   "vue-cli-service build --mode staging"
 *     → "vite build --mode staging"
 *   "jest --clearCache && vue-cli-service test:unit"
 *     → "jest --clearCache && vitest run"
 *   "vue-cli-service serve --port 8080"
 *     → "vite --port 8080"
 */
function rewriteValue(value: string): { out: string; changed: boolean } {
  // 用 split 拆成 [seg, sep, seg, sep, ...] 交替,只处理 seg 部分
  // 思路: 既然 split 已经把 sep 吞了,我们就用 split 抓 segments + 正则提取 seps
  // 更简单: 写一个分段函数
  type Piece = { kind: 'seg' | 'sep'; text: string }
  const pieces: Piece[] = []
  let buf = ''
  let i = 0
  let inSeg = true
  while (i < value.length) {
    if (inSeg) {
      // 在 segment 中: 看从 i 开始是否匹配 separator
      const sepMatch = value.slice(i).match(/^\s*(?:\|\||&&|;)\s*/)
      if (sepMatch) {
        if (buf.length > 0) pieces.push({ kind: 'seg', text: buf })
        buf = ''
        pieces.push({ kind: 'sep', text: sepMatch[0] })
        inSeg = false
        i += sepMatch[0].length
        continue
      }
      buf += value[i]
      i++
    } else {
      // 在 separator 中（已 push 到 pieces, 现在跳过 separator 后的空白）
      // 实际上上面 sepMatch 已经把后续空白一起吞了,所以直接切到下一个非空白就是 seg
      // 但要避免死循环:如果当前 i 是空白但没匹配 separator,继续
      // 我们用 inSeg=false 的状态只是过渡,马上会变 true
      inSeg = true
    }
  }
  if (buf.length > 0) pieces.push({ kind: 'seg', text: buf })

  // 对每个 seg 单独做子串替换
  let anyChanged = false
  const rebuilt: string[] = []
  for (const p of pieces) {
    if (p.kind === 'sep') {
      rebuilt.push(p.text)
    } else {
      const { out, changed } = rewriteSegment(p.text)
      if (changed) anyChanged = true
      rebuilt.push(out)
    }
  }
  return { out: rebuilt.join(''), changed: anyChanged }
}

/**
 * 在单个 segment 中找 `vue-cli-service <subcmd>` 并替换,保留后续 args。
 * 如果没找到,原样返回。
 */
function rewriteSegment(seg: string): { out: string; changed: boolean } {
  const TOKEN = 'vue-cli-service'
  // 找 TOKEN 位置（前面必须是空白或行首)
  const re = new RegExp(
    `(?:^|\\s)(${TOKEN})\\s+([A-Za-z][\\w:-]*)(.*)$`,
    's',
  )
  const m = seg.match(re)
  if (!m) return { out: seg, changed: false }

  const leadingWs = seg.startsWith(TOKEN) ? '' : m[0].match(/^\s*/)![0] // 段首可能本就没有 ws
  // m.index 是整段匹配起点;重新取整段以保留段首空格
  const fullMatch = m[0]
  const afterTokenAndWs = fullMatch.match(new RegExp(`^(?:\\s)?(?:^|\\s)${TOKEN}\\s+`))![0]
  // 直接用更安全的方式: 已知 m[0] 是从行首或 ws 开始,按位置重组
  const beforeMatch = seg.slice(0, m.index)
  // m[1] = TOKEN, m[2] = subcmd, m[3] = 后面的 args（含前导空白)
  const sub = m[2]
  const rest = m[3] // 含 subcmd 后的所有内容（含前导空白）
  const replacement = CMD_REWRITE[`${TOKEN} ${sub}`]
  if (!replacement) {
    // 未知 subcmd,原样保留
    return { out: seg, changed: false }
  }
  const newSeg = beforeMatch + replacement + rest
  return { out: newSeg, changed: true }
}

export function applyScriptMap(
  scripts: Record<string, string> | undefined,
): { scripts: Record<string, string>; changes: string[] } {
  const out: Record<string, string> = {}
  const changes: string[] = []
  if (!scripts) return { scripts: out, changes }

  for (const [k, v] of Object.entries(scripts)) {
    const newKey = KEY_RENAME[k] ?? k
    const { out: newVal, changed } = rewriteValue(v)
    out[newKey] = newVal

    if (newKey !== k) {
      changes.push(`重命名 scripts.${k} → ${newKey}: ${newVal}`)
    } else if (changed) {
      changes.push(`改 scripts.${k}: ${v} → ${newVal}`)
    }
  }
  return { scripts: out, changes }
}
