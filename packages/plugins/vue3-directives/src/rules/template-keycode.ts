/**
 * 规则：keycode 修饰符移除
 *
 *   @keyup.13  →  @keyup.enter + 警告
 *   @keydown.65.ctrl →  @keydown.ctrl + 警告
 *   @keypress.32.space  →  等
 *
 * Vue3 移除了 keycode 数字修饰符，必须换成 key 名（enter / tab / esc / space ...）。
 * 我们做最保守的替换：把 .NN 数字换成 friendly key 名，提示人工。
 */

import { transformTemplate } from '../utils'

// 匹配 @keyup / @keydown / @keypress / @keyenter 后面可以跟 .modifier
// 捕获 modifier 链以便处理
const KEY_EVENT_RE = /((?:@|v-on:)(?:key(?:up|down|press|enter)))((?:\.[\w.-]+)*)\s*=\s*"([^"]*)"/g

/** 数字 keycode → 友好名。完整映射太大，给出几个常见 + 兜底 */
const KEYCODE_HINT: Record<string, string> = {
  '13': 'enter',
  '27': 'esc',
  '32': 'space',
  '37': 'arrow-left',
  '38': 'arrow-up',
  '39': 'arrow-right',
  '40': 'arrow-down',
  '46': 'delete',
  '8': 'backspace',
  '9': 'tab',
  '65': 'a',
  '66': 'b',
  '67': 'c',
  '68': 'd',
  '69': 'e',
  '70': 'f',
  '71': 'g',
  '72': 'h',
  '73': 'i',
  '74': 'j',
  '75': 'k',
  '76': 'l',
  '77': 'm',
  '78': 'n',
  '79': 'o',
  '80': 'p',
  '81': 'q',
  '82': 'r',
  '83': 's',
  '84': 't',
  '85': 'u',
  '86': 'v',
  '87': 'w',
  '88': 'x',
  '89': 'y',
  '90': 'z',
}

export function applyKeycodeRemoval(ctx: any): void {
  transformTemplate(
    ctx.file,
    (template) => {
      const reviewItems: string[] = []
      let changed = false

      const out = template.replace(KEY_EVENT_RE, (full, eventPrefix, modifiers, handler) => {
        // 找 .数字 修饰符（修饰符链的每一段都是 .NAME 形式）
        const numMatches = [...modifiers.matchAll(/\.(\d+)(?=$|\.)/g)]
        if (numMatches.length === 0) return full

        let newModifiers = modifiers
        for (const nm of numMatches) {
          const code = nm[1]
          const friendly = KEYCODE_HINT[code]
          const hint = friendly ? `.${friendly}` : ''
          reviewItems.push(
            `keycode .${code} → ${hint || '(unknown)'} on ${eventPrefix} (Vue3 removed numeric keycodes)`,
          )
          newModifiers = newModifiers.replace('.' + code, hint)
        }
        changed = true
        return `${eventPrefix}${newModifiers}="${handler}"`
      })

      return { out, changed, reviewItems }
    },
    ctx.utils,
    'keycode numeric modifiers removed',
  )
}
