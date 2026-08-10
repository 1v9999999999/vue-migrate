/**
 * 轻量级 HTML 元素扫描器
 *
 * 用途：在 .vue 模板里找到所有"目标元素"（有 slot / slot-scope / inline-template
 *       / v-bind.sync 属性的元素），返回它们的位置和原始字符串，以便后续重写。
 *
 * 设计原则：
 *  - 不依赖完整的 HTML 解析器（@vue/compiler-dom 没法 serialize）
 *  - 不依赖 AST 重建（容易丢空格、注释、文本）
 *  - 走"自底向上文本替换"路线：识别出元素 → 直接在原文中切出来 → 重写
 *  - 支持嵌套（自闭合 + 配对 + 注释）
 *  - 故意只处理本插件关心的那几种简单情况，遇到怪异的就跳过
 *
 * 注意：本扫描器只针对 .vue 模板块内容工作，假设里头的源码是合法的 Vue 模板。
 *       对奇葩的 HTML（如 < 出现在文本里）会容忍，不会崩溃。
 */

export interface ParsedAttr {
  /** 整个 attribute 的原始字符串（带等号和引号），例如 `slot="header"` */
  raw: string
  /** attribute 的起始 offset（template 局部） */
  start: number
  /** attribute 的结束 offset（template 局部） */
  end: number
  /** name (不区分 v-bind 等指令) —— 指令是去掉 v- / : / @ 后的部分（如 bind, on, model, slot） */
  name: string
  /** 原始 rawName（保留 v-bind / : / @ 等前缀） */
  rawName: string
  /** 值（去引号后的内容），没值就是 true */
  value: string | true
  /** 是否有 v- / : / @ 前缀 */
  isDirective: boolean
  /** 修饰符（仅对指令有效，如 ['sync']） */
  modifiers: string[]
}

export interface ElementMatch {
  /** 整个元素的起始 offset（template 局部） */
  start: number
  /** 元素结束 offset（template 局部，exclusive） */
  end: number
  /** 起始标签 '<' 的 offset */
  openStart: number
  /** 起始标签名起始 offset */
  tagNameStart: number
  /** 起始标签名结束 offset */
  tagNameEnd: number
  /** 标签名（如 div, my-component） */
  tagName: string
  /** 起始标签结束 offset（openStart 之后 '>' 的位置） */
  openEnd: number
  /** 是否自闭合（<x />） */
  selfClosing: boolean
  /** 内容起始 offset（如果有） */
  contentStart: number
  /** 内容结束 offset（如果有） */
  contentEnd: number
  /** 闭合标签 '<' 的 offset（如果有） */
  closeStart: number
  /** 闭合标签结束 offset */
  closeEnd: number
  /** 解析后的属性列表 */
  attrs: ParsedAttr[]
}

/** 解析一段属性字符串为 ParsedAttr 列表。offset 相对于 attrText 起始。 */
export function parseAttrs(attrText: string): ParsedAttr[] {
  const attrs: ParsedAttr[] = []
  let i = 0
  const n = attrText.length
  while (i < n) {
    // 跳过空白
    while (i < n && /\s/.test(attrText[i])) i++
    if (i >= n) break

    const start = i
    // 读 name —— 可以包含 - : @ . 等
    // 注意：name 不能包含空白或 = 或 " ' < > /
    while (
      i < n &&
      !/[\s=]/g.test(attrText[i]) &&
      attrText[i] !== '>' &&
      attrText[i] !== '/'
    ) {
      i++
    }
    const nameEnd = i
    const rawName = attrText.slice(start, nameEnd)
    if (!rawName) break

    // 跳过空白
    while (i < n && /\s/.test(attrText[i])) i++

    let value: string | true = true
    if (attrText[i] === '=') {
      i++
      // 跳过空白
      while (i < n && /\s/.test(attrText[i])) i++
      if (attrText[i] === '"' || attrText[i] === "'") {
        const quote = attrText[i]
        i++
        const valStart = i
        while (i < n && attrText[i] !== quote) i++
        value = attrText.slice(valStart, i)
        if (i < n) i++ // skip closing quote
      } else {
        // 无引号值
        const valStart = i
        while (i < n && !/[\s>]/.test(attrText[i])) i++
        value = attrText.slice(valStart, i)
      }
    }

    const isDirective = /^[v:@]/.test(rawName) || /^v-/.test(rawName)

    const { name: dirName, modifiers: dirMods } = splitDirective(rawName)

    attrs.push({
      raw: attrText.slice(start, i),
      start,
      end: i,
      name: isDirective ? dirName : stripDirectivePrefix(rawName),
      rawName,
      value,
      isDirective,
      modifiers: isDirective ? dirMods : [],
    } as ParsedAttr)
  }
  return attrs
}

function stripDirectivePrefix(raw: string): string {
  if (raw.startsWith('v-')) return raw.slice(2)
  if (raw.startsWith(':')) return raw.slice(1)
  if (raw.startsWith('@')) return 'on:' + raw.slice(1)
  return raw
}

/**
 * 把 v-bind.sync 拆成 { name: 'bind', modifiers: ['sync'] }
 * 把 :foo 拆成 { name: 'bind', modifiers: [] }   (foo 是 arg)
 * 把 @click 拆成 { name: 'on', modifiers: [] }   (click 是 event name)
 * 注意：此函数不解析 arg，只关心 name + 修饰符。arg 的解析在使用方自己处理。
 */
function splitDirective(raw: string): { name: string; modifiers: string[] } {
  let body: string
  let prefix = ''
  if (raw.startsWith('v-')) {
    body = raw.slice(2)
  } else if (raw.startsWith(':')) {
    // 简写 :xxx.mod1.mod2 → name='bind', modifiers=['mod1','mod2']
    // 但 :xxx 里的 xxx 是 arg（属性名），不进入 name/modifiers
    body = 'bind'
    const rest = raw.slice(1)
    // 把 'visible.sync' 当成 bind + arg=visible + modifier=sync
    // 由于 splitDirective 不返回 arg，我们把 arg 当成 body 第一段，modifiers 是后面
    // 但目前 signature 没有 arg 字段，所以简化处理：把所有 :xxx 当 bind 处理
    // 真正的 v-bind.sync 检测需要从 attribute name 里取 .sync
    // 这里把 ':visible.sync' 转成 'bind.sync' 让上层 findDirective(name='bind', modifier='sync') 命中
    if (rest.includes('.')) {
      const dotIdx = rest.indexOf('.')
      const mods = rest.slice(dotIdx + 1).split('.').filter(Boolean)
      return { name: 'bind', modifiers: mods }
    }
  } else if (raw.startsWith('@')) {
    body = 'on'
  } else {
    return { name: raw, modifiers: [] }
  }

  // body 可能是 'bind.sync' / 'on.click.stop' / 'bind' / 'model.lazy'
  const dotIdx = body.indexOf('.')
  if (dotIdx < 0) {
    return { name: body, modifiers: [] }
  }
  const name = body.slice(0, dotIdx)
  const mods = body.slice(dotIdx + 1).split('.').filter(Boolean)
  return { name, modifiers: mods }
}

/**
 * 在 template 文本中扫描所有 top-level 元素位置。
 * 顶层元素即直接位于 template 根下的元素（不返回嵌套的）。
 *
 * 返回的 offsets 都是相对 template 字符串的。
 */
export function scanTopLevelElements(template: string): ElementMatch[] {
  const results: ElementMatch[] = []
  const stack: ElementMatch[] = []
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
        // 找匹配的 stack 顶
        const tagStart = i + 2
        const tagEndMatch = /^\s*([a-zA-Z][\w-]*)/.exec(template.slice(tagStart))
        if (!tagEndMatch) {
          i++
          continue
        }
        const tagName = tagEndMatch[1]
        const tagNameEnd = tagStart + tagName.length
        // 找 '>'
        const gt = template.indexOf('>', tagNameEnd)
        if (gt < 0) break

        // 弹栈直到找到同名
        for (let s = stack.length - 1; s >= 0; s--) {
          if (stack[s].tagName === tagName) {
            const top = stack[s]
            top.contentEnd = i
            top.closeStart = i
            top.closeEnd = gt + 1
            top.end = gt + 1
            // 如果它是顶层，输出
            if (s === 0) {
              results.push(top)
            }
            stack.length = s
            break
          }
        }
        i = gt + 1
        continue
      }
      // 开始标签
      const tagStart = i + 1
      // 跳过可能的 '<!' (declaration) 或 '<?'
      if (template[i + 1] === '!' || template[i + 1] === '?') {
        const end = template.indexOf('>', i)
        if (end < 0) break
        i = end + 1
        continue
      }
      // 读 tag name
      const tagNameMatch = /^([a-zA-Z][\w-]*)/.exec(template.slice(tagStart))
      if (!tagNameMatch) {
        i++
        continue
      }
      const tagName = tagNameMatch[1]
      const tagNameEnd = tagStart + tagName.length
      const openStart = i

      // 找标签结束 '>' 或 '/>'
      let j = tagNameEnd
      // 跳过空白
      while (j < n && /\s/.test(template[j])) j++
      // 找下一个 '>' —— 必须不引号内
      let selfClosing = false
      let openEnd = -1
      while (j < n) {
        const ch = template[j]
        if (ch === '"' || ch === "'") {
          // 跳到匹配的引号
          const q = ch
          j++
          while (j < n && template[j] !== q) j++
          if (j < n) j++
          continue
        }
        if (ch === '>') {
          openEnd = j
          selfClosing = false
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

      // 提取 attribute 文本
      const attrText = template.slice(tagNameEnd, j)
      const attrs = parseAttrs(attrText)

      const el: ElementMatch = {
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
        // 如果是顶层（栈空）就直接输出，否则挂到父
        if (stack.length === 0) {
          results.push(el)
        }
        i = openEnd + 1
        continue
      }

      if (stack.length === 0) {
        stack.push(el)
      } else {
        // 嵌套，挂到父的 children 中（这里我们只关心顶层，
        // 但需要正确维护栈深度，否则 end 匹配会错）
        stack.push(el)
      }
      i = openEnd + 1
      continue
    }

    i++
  }

  // 处理未关闭的栈（兜底）：把剩下的当作顶层
  for (const el of stack) {
    if (el.end > 0) results.push(el)
  }

  return results
}

/**
 * 在 template 中找所有元素（包括嵌套的），用于重写。
 * 返回一个数组，按 start offset 升序，且不会重叠（每个元素独立返回）。
 */
export function scanAllElements(template: string): ElementMatch[] {
  const results: ElementMatch[] = []
  const stack: ElementMatch[] = []
  let i = 0
  const n = template.length

  while (i < n) {
    const c = template[i]

    if (c === '<') {
      if (template.startsWith('<!--', i)) {
        const end = template.indexOf('-->', i + 4)
        if (end < 0) break
        i = end + 3
        continue
      }
      if (template[i + 1] === '/') {
        const tagStart = i + 2
        const tagNameMatch = /^\s*([a-zA-Z][\w-]*)/.exec(template.slice(tagStart))
        if (!tagNameMatch) {
          i++
          continue
        }
        const tagName = tagNameMatch[1]
        // 找 '>'
        const gt = template.indexOf('>', tagStart + tagName.length)
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
      if (template[i + 1] === '!' || template[i + 1] === '?') {
        const end = template.indexOf('>', i)
        if (end < 0) break
        i = end + 1
        continue
      }
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
      const attrs = parseAttrs(attrText)

      const el: ElementMatch = {
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

/**
 * 在元素的所有属性中找指定 name（区分大小写或不区分可选）。
 * name: 'slot' / 'slot-scope' / 'inline-template' 等
 */
export function findAttr(el: ElementMatch, name: string): ParsedAttr | undefined {
  return el.attrs.find((a) => a.name === name)
}

/**
 * 在元素的所有指令属性中找指定指令（如 v-bind / v-model / v-on / @ / :）。
 * - name: 'bind' (匹配 v-bind 或 :)  / 'on' (匹配 v-on 或 @) / 'model'
 * - modifier:  'sync' (匹配 .sync 修饰符) / undefined
 */
export function findDirective(
  el: ElementMatch,
  name: string,
  modifier?: string,
): ParsedAttr | undefined {
  return el.attrs.find((a) => {
    if (!a.isDirective) return false
    if (a.name !== name) return false
    if (modifier !== undefined && !a.modifiers.includes(modifier)) return false
    return true
  })
}
