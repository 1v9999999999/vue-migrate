/**
 * 精简版 template scanner — 只识别 element + attributes + v-decorator
 *
 * 复用 elementui 的 scanner 思路, 但只 export 需要的函数:
 *   - findElementsByTag: 找所有指定 tag 的元素位置
 *   - hasDecorator: 元素是否有 v-decorator 指令
 *   - hasClickWithoutOkCancel: 元素有 @click 但没有 @ok / @cancel
 *   - hasReplaceFieldsProp: 元素有 :replaceFields prop
 */

export interface ElementLite {
  /** 在 template 内的 start offset */
  start: number
  /** 在 template 内的 end offset (exclusive) */
  end: number
  /** 起始标签 '<' 的 offset */
  openStart: number
  /** 起始标签名起始 offset */
  tagNameStart: number
  /** 起始标签名结束 offset */
  tagNameEnd: number
  /** 标签名 */
  tagName: string
  /** 起始标签 '>' 的 offset */
  openEnd: number
  /** 是否自闭合 */
  selfClosing: boolean
  /** 内容起始 offset */
  contentStart: number
  /** 内容结束 offset (如果有) */
  contentEnd: number
  /** 闭合标签 '<' offset */
  closeStart: number
  /** 闭合标签 end offset */
  closeEnd: number
  /** 解析后的属性列表 */
  attrs: AttrLite[]
}

export interface AttrLite {
  start: number
  end: number
  raw: string
  rawName: string
  name: string
  value: string | true
  isDirective: boolean
  modifiers: string[]
  /** v- 指令名 (bind/on/model/slot/...) */
  dirName: string
}

/**
 * 在 template 字符串中扫描所有元素 (含嵌套)
 */
export function scanAllElementsLite(template: string): ElementLite[] {
  const results: ElementLite[] = []
  const stack: ElementLite[] = []
  let i = 0
  const n = template.length

  while (i < n) {
    const c = template[i]

    if (c === '<') {
      // 注释
      if (template.startsWith('<!--', i)) {
        const end = template.indexOf('-->', i + 4)
        if (end < 0) break
        i = end + 3
        continue
      }
      // 结束标签
      if (template[i + 1] === '/') {
        const tagStart = i + 2
        const tagNameMatch = /^\s*([a-zA-Z][\w-]*)/.exec(template.slice(tagStart))
        if (!tagNameMatch) {
          i++
          continue
        }
        const tagName = tagNameMatch[1]
        const tagNameEnd = tagStart + tagName.length
        const gt = template.indexOf('>', tagNameEnd)
        if (gt < 0) break
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].tagName === tagName) {
            const top = stack[s]
            top.contentEnd = i
            top.closeStart = i
            top.closeEnd = gt + 1
            top.end = gt + 1
            results.push(top)
            stack.length = s
            break
          }
        }
        i = gt + 1
        continue
      }
      // 跳过 <! 或 <?
      if (template[i + 1] === '!' || template[i + 1] === '?') {
        const end = template.indexOf('>', i)
        if (end < 0) break
        i = end + 1
        continue
      }
      // 开始标签
      const tagStart = i + 1
      const tagNameMatch = /^([a-zA-Z][\w-]*)/.exec(template.slice(tagStart))
      if (!tagNameMatch) {
        i++
        continue
      }
      const tagName = tagNameMatch[1]
      const tagNameEnd = tagStart + tagName.length
      const openStart = i

      let j = tagNameEnd
      while (j < n && /\s/.test(template[j])) j++
      let selfClosing = false
      let openEnd = -1
      while (j < n) {
        const ch = template[j]
        if (ch === '"' || ch === "'") {
          const q = ch
          j++
          while (j < n && template[j] !== q) j++
          if (j < n) j++
          continue
        }
        if (ch === '>') {
          openEnd = j
          break
        }
        if (ch === '/' && template[j + 1] === '>') {
          openEnd = j + 1
          selfClosing = true
          break
        }
        j++
      }
      if (openEnd < 0) break

      const attrText = template.slice(tagNameEnd, j)
      const attrs = parseAttrsLite(attrText)

      const el: ElementLite = {
        start: openStart,
        end: openEnd + 1,
        openStart,
        tagNameStart: tagStart,
        tagNameEnd,
        tagName,
        openEnd,
        selfClosing,
        contentStart: openEnd + 1,
        contentEnd: selfClosing ? openEnd + 1 : -1,
        closeStart: -1,
        closeEnd: -1,
        attrs,
      }

      if (selfClosing) {
        el.end = openEnd + 1
        el.contentEnd = openEnd + 1
        results.push(el)
        i = openEnd + 1
        continue
      }

      stack.push(el)
      i = openEnd + 1
      continue
    }

    i++
  }

  return results
}

function parseAttrsLite(attrText: string): AttrLite[] {
  const attrs: AttrLite[] = []
  let i = 0
  const n = attrText.length
  while (i < n) {
    while (i < n && /\s/.test(attrText[i])) i++
    if (i >= n) break
    const start = i
    while (i < n && !/[\s=]/.test(attrText[i]) && attrText[i] !== '>' && attrText[i] !== '/') i++
    const rawName = attrText.slice(start, i)
    if (!rawName) break
    while (i < n && /\s/.test(attrText[i])) i++
    let value: string | true = true
    if (attrText[i] === '=') {
      i++
      while (i < n && /\s/.test(attrText[i])) i++
      if (attrText[i] === '"' || attrText[i] === "'") {
        const quote = attrText[i]
        i++
        const valStart = i
        while (i < n && attrText[i] !== quote) i++
        value = attrText.slice(valStart, i)
        if (i < n) i++
      } else {
        const valStart = i
        while (i < n && !/[\s>]/.test(attrText[i])) i++
        value = attrText.slice(valStart, i)
      }
    }

    const isDirective = /^[v:@]/.test(rawName) || /^v-/.test(rawName)
    const { dirName, name, modifiers } = splitDir(rawName)

    attrs.push({
      start,
      end: i,
      raw: attrText.slice(start, i),
      rawName,
      name: isDirective ? dirName : stripPrefix(rawName),
      value,
      isDirective,
      modifiers,
      dirName,
    })
  }
  return attrs
}

function splitDir(raw: string): { dirName: string; name: string; modifiers: string[] } {
  let body: string
  if (raw.startsWith('v-')) body = raw.slice(2)
  else if (raw.startsWith(':')) body = 'bind'
  else if (raw.startsWith('@')) body = 'on'
  else return { dirName: '', name: raw, modifiers: [] }

  // 处理 :visible.sync → bind.sync
  // 处理 @click → on.click
  if (raw.startsWith(':')) {
    const rest = raw.slice(1)
    if (rest.includes('.')) {
      const dotIdx = rest.indexOf('.')
      const mods = rest.slice(dotIdx + 1).split('.').filter(Boolean)
      return { dirName: 'bind', name: 'bind', modifiers: mods }
    }
    return { dirName: 'bind', name: 'bind', modifiers: [] }
  }

  const dotIdx = body.indexOf('.')
  if (dotIdx < 0) return { dirName: body, name: body, modifiers: [] }
  const name = body.slice(0, dotIdx)
  const mods = body.slice(dotIdx + 1).split('.').filter(Boolean)
  return { dirName: name, name, modifiers: mods }
}

function stripPrefix(raw: string): string {
  if (raw.startsWith('v-')) return raw.slice(2)
  if (raw.startsWith(':')) return raw.slice(1)
  if (raw.startsWith('@')) return 'on:' + raw.slice(1)
  return raw
}

/** 检查元素是否使用了 v-decorator 指令 */
export function hasDecorator(el: ElementLite): boolean {
  return el.attrs.some(a => a.rawName === 'v-decorator' || a.dirName === 'decorator' || a.name === 'decorator')
}

/** 检查元素是否有 @click 但没有 @ok / @cancel */
export function hasClickWithoutOkCancel(el: ElementLite): { hasClick: boolean; hasOkOrCancel: boolean } {
  let hasClick = false
  let hasOkOrCancel = false
  for (const a of el.attrs) {
    if (a.isDirective) {
      // @click
      if (a.rawName.startsWith('@') && a.rawName === '@click') hasClick = true
      if (a.rawName === 'v-on:click') hasClick = true
      // @ok / @cancel
      if (a.rawName === '@ok' || a.rawName === '@cancel') hasOkOrCancel = true
      if (a.rawName === 'v-on:ok' || a.rawName === 'v-on:cancel') hasOkOrCancel = true
    }
  }
  return { hasClick, hasOkOrCancel }
}

/** 检查元素是否有 :replaceFields prop (a-tree-select 1.x → 2.x 改名) */
export function hasReplaceFields(el: ElementLite): boolean {
  // 1.x 写 :replaceFields (camelCase) 或 :replace-fields (kebab-case)
  return el.attrs.some(a => {
    const r = a.rawName.toLowerCase()
    return r === ':replacefields' ||
      r === 'v-bind:replacefields' ||
      r === 'replacefields' ||
      r === ':replace-fields' ||
      r === 'v-bind:replace-fields' ||
      r === 'replace-fields'
  })
}
