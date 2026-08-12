/**
 * 规则: render(h) 函数 h() 签名迁移 (iter-120)
 *
 * Vue 2 h() 签名 (VNodeData 形式):
 *   h('div', {
 *     class: 'foo',           // 直接 class
 *     style: { color: 'red' },
 *     attrs: { id: 'x' },     // HTML attributes
 *     domProps: { innerHTML: '<b/>' },  // DOM properties
 *     on: { click: handler }, // 事件监听
 *     nativeOn: { click: handler },
 *     directives: [{ name: 'foo', value: 'bar' }],
 *     scopedSlots: { default: props => h(...) },
 *     slot: 'header',
 *     key: 'x',
 *     ref: 'myDiv',
 *     refInFor: true,
 *     staticClass: 'static-foo',
 *     hook: { mounted() {}, ... },
 *   }, children)
 *
 * Vue 3 h() 签名 (合并形式):
 *   h('div', {
 *     // 顶层属性 (不再需要 attrs 包装)
 *     id: 'x',
 *     innerHTML: '<b/>',  // domProps 合并到顶层
 *     class: 'foo',
 *     style: { color: 'red' },
 *     onClick: handler,   // on.click → onClick
 *     onMousedown: handler,
 *     'v-foo': 'bar',     // directives.name 变成 'v-name'
 *     key: 'x',
 *     ref: 'myDiv',
 *   }, children)
 *
 * 主要差异:
 *   - attrs: { foo: 'bar' } → foo: 'bar'  (直接展开)
 *   - domProps: { foo: 'bar' } → foo: 'bar'  (直接展开)
 *   - on: { click: h } → onClick: h  (onXxx 命名)
 *   - nativeOn: { click: h } → onClick: h  (Vue 3 已移除 nativeOn, 合并到 on)
 *   - directives: [{ name: 'foo', value: 'v' }] → { 'v-foo': 'v' }
 *   - slot: 'header' → 移到 children 第一个位置 (with slot) 或保留
 *   - scopedSlots: { default: fn } → fn 直接放 children 第一个位置
 *   - staticClass: 'foo' → 合并到 class: 'foo'  (Vue 3 没有 staticClass)
 *   - hook: { mounted() {} } → onMounted / onUpdated 等
 *   - refInFor: true → 不需要, Vue 3 自动处理
 *
 * 实现策略:
 *   1. 找到所有 h() / createElement() / $createElement() 调用
 *   2. 检查第二参数 (VNodeData) 是否是 ObjectExpression
 *   3. 按顺序合并/转换属性到一个新的 ObjectExpression
 *   4. 替换原 ObjectExpression
 *
 * 局限:
 *   - this.$scopedSlots.xxx() 形式 (在 render 中) → 转为 slots 调用, 跟 vue3-template 已处理一致
 *   - 静态分析难以处理的 (e.g. 条件 attrs) → 直接合并, 不会破坏
 */

import _traverse from '@babel/traverse'
import * as t from '@babel/types'
import type { NodePath } from '@babel/traverse'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

export interface RenderFnResult {
  modifications: number
  changes: string[]
  reviewItems: string[]
}

/** 判定 callee 是不是 h / createElement / $createElement */
function isHCall(callee: any): boolean {
  if (!callee) return false
  // h(...) 直接调用
  if (t.isIdentifier(callee, { name: 'h' })) return true
  if (t.isIdentifier(callee, { name: 'createElement' })) return true
  // this.$createElement(...)
  if (
    t.isMemberExpression(callee) &&
    t.isThisExpression(callee.object) &&
    t.isIdentifier(callee.property, { name: '$createElement' })
  ) {
    return true
  }
  return false
}

/**
 * 处理单个 h() 调用的 VNodeData 参数 (ObjectExpression)
 * 返回新 ObjectExpression, 不修改原节点
 */
function migrateVNodeData(dataObj: t.ObjectExpression): {
  newData: t.ObjectExpression
  changes: string[]
  preChildren: t.Expression[]  // slot / scopedSlots 提取出的 children, 需插到 children 之前
  reviews: string[]
} {
  const changes: string[] = []
  const reviews: string[] = []
  const preChildren: t.Expression[] = []

  // 分类属性
  const flatProps: t.ObjectProperty[] = []  // 直接放顶层 (id, class, style, onXxx, key, ref)
  const removedProps = new Set<string>()    // 已处理的 key (避免重复)

  // Vue 2 的 keys
  const MERGE_KEYS = ['attrs', 'domProps', 'nativeOn', 'hook']  // 合并到顶层
  const COMBINE_KEYS = ['on']  // onXxx 命名
  const SPECIAL_KEYS = ['directives', 'scopedSlots', 'slot', 'staticClass', 'refInFor']

  // 处理顺序: 先取走 special (slot / scopedSlots), 再取走 merge (attrs/domProps/nativeOn/hook),
  //           再处理 on → onXxx, 剩下的原样保留
  for (const prop of dataObj.properties) {
    if (!t.isObjectProperty(prop)) continue
    if (t.isSpreadElement(prop)) continue  // 跳过 spread
    if (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key)) continue
    const keyName = t.isIdentifier(prop.key)
      ? prop.key.name
      : (prop.key as t.StringLiteral).value

    // ============ slot: 'header' / 'default' ============
    // Vue 3: slots 通过模板或 h() 第一个 child 处理. 简单做法: 保留 slot,
    // 但在 h 调用级别处理 slot
    if (keyName === 'slot' && t.isStringLiteral(prop.value)) {
      // 不直接处理 — 在外层 h() 处理 level 处理 children
      // 这里我们仍保留, 不算改动
      continue
    }

    // ============ staticClass: 'foo' → 合并到 class ============
    if (keyName === 'staticClass' && t.isStringLiteral(prop.value)) {
      const staticVal = prop.value.value
      // 找 class 属性
      const classProp = dataObj.properties.find(
        (p) => t.isObjectProperty(p) && (t.isIdentifier((p as any).key, { name: 'class' }) || (t.isStringLiteral((p as any).key) && (p as any).key.value === 'class')),
      ) as t.ObjectProperty | undefined

      if (classProp && t.isStringLiteral(classProp.value)) {
        classProp.value = t.stringLiteral(`${classProp.value.value} ${staticVal}`)
      } else {
        // 加新的 class 属性
        flatProps.push(
          t.objectProperty(t.identifier('class'), t.stringLiteral(staticVal)),
        )
      }
      removedProps.add(keyName)
      changes.push(`staticClass: '${staticVal}' → class`)
      continue
    }

    // ============ refInFor: true → 移除 (Vue 3 自动) ============
    if (keyName === 'refInFor') {
      removedProps.add(keyName)
      changes.push(`refInFor removed (Vue 3 自动处理 ref-in-for)`)
      continue
    }

    // ============ hook: { mounted() {} } ============
    if (keyName === 'hook' && t.isObjectExpression(prop.value)) {
      reviews.push(
        `hook: { mounted/updated/beforeDestroy ... } 需手动改写为 onMounted/onUpdated/onBeforeUnmount (组件内调用)`,
      )
      // 保留 (让用户/自动转)
      continue
    }

    // ============ directives: [{ name: 'foo', value: 'bar' }] ============
    if (keyName === 'directives' && t.isArrayExpression(prop.value)) {
      for (const elt of prop.value.elements) {
        if (!elt || !t.isObjectExpression(elt)) continue
        let dName: string | null = null
        let dValue: t.Expression | null = null
        for (const dp of elt.properties) {
          if (!t.isObjectProperty(dp)) continue
          const k = t.isIdentifier(dp.key) ? dp.key.name : (dp.key as t.StringLiteral).value
          if (k === 'name' && t.isStringLiteral(dp.value)) dName = dp.value.value
          if (k === 'value') dValue = dp.value as t.Expression
        }
        if (dName) {
          const propName = `v-${dName}`
          flatProps.push(
            t.objectProperty(
              t.stringLiteral(propName),
              dValue || t.booleanLiteral(true),
            ),
          )
          changes.push(`directives: { name: '${dName}' } → { '${propName}': ... }`)
        }
      }
      removedProps.add(keyName)
      continue
    }

    // ============ scopedSlots: { default: fn } ============
    // Vue 3: scopedSlots 已合并到 slots. 简单处理: 把 fn 提到 children 第一位
    if (keyName === 'scopedSlots' && t.isObjectExpression(prop.value)) {
      reviews.push(
        `scopedSlots 合并到 slots — fn 提取为 children, 行为可能有变化 (Vue 3 slots 统一)`,
      )
      for (const sp of prop.value.properties) {
        if (!t.isObjectProperty(sp)) continue
        const slotName = t.isIdentifier(sp.key)
          ? sp.key.name
          : (sp.key as t.StringLiteral).value
        if (slotName === 'default' && t.isFunction(sp.value as any)) {
          preChildren.push(sp.value as t.Expression)
          changes.push(`scopedSlots.default 提取到 children`)
        } else {
          reviews.push(
            `scopedSlots.${slotName} 需手动转 slots, 命名 slot (非 default) 需额外处理`,
          )
        }
      }
      removedProps.add(keyName)
      continue
    }

    // ============ attrs: { foo: 'bar' } → 展开到顶层 ============
    if (keyName === 'attrs' && t.isObjectExpression(prop.value)) {
      for (const ap of prop.value.properties) {
        if (!t.isObjectProperty(ap)) continue
        const k = t.isIdentifier(ap.key)
          ? ap.key.name
          : (ap.key as t.StringLiteral).value
        // Vue 3 中, h 顶层属性对应 HTML attributes
        // 注意: class 和 style 已经在 attrs 外层, 不能重复
        if (k === 'class' || k === 'style') {
          // 跳过 (顶层已有)
          continue
        }
        // 对 'data-foo' 形式 (含连字符) 用 stringLiteral, 其它用 identifier
        const propKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
          ? (t.identifier(k) as any)
          : (t.stringLiteral(k) as any)
        flatProps.push(t.objectProperty(propKey, ap.value as t.Expression))
      }
      removedProps.add(keyName)
      changes.push(`attrs: {...} 展开到顶层`)
      continue
    }

    // ============ domProps: { innerHTML: '...' } → 展开到顶层 ============
    if (keyName === 'domProps' && t.isObjectExpression(prop.value)) {
      for (const dp of prop.value.properties) {
        if (!t.isObjectProperty(dp)) continue
        const k = t.isIdentifier(dp.key)
          ? dp.key.name
          : (dp.key as t.StringLiteral).value
        // domProps key 通常是 innerHTML / value / checked 等, 都是合法 identifier
        const propKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
          ? (t.identifier(k) as any)
          : (t.stringLiteral(k) as any)
        flatProps.push(t.objectProperty(propKey, dp.value as t.Expression))
      }
      removedProps.add(keyName)
      changes.push(`domProps: {...} 展开到顶层`)
      continue
    }

    // ============ nativeOn: { click: h } → onClick: h (Vue 3 已移除 nativeOn) ============
    if (keyName === 'nativeOn' && t.isObjectExpression(prop.value)) {
      for (const ep of prop.value.properties) {
        if (!t.isObjectProperty(ep)) continue
        const k = t.isIdentifier(ep.key)
          ? ep.key.name
          : (ep.key as t.StringLiteral).value
        flatProps.push(
          t.objectProperty(t.identifier(`on${capitalize(k)}`), ep.value as t.Expression),
        )
        changes.push(`nativeOn: { ${k}: ... } → on${capitalize(k)}: ... (Vue 3 移除 nativeOn)`)
      }
      removedProps.add(keyName)
      continue
    }

    // ============ on: { click: h } → onClick: h ============
    if (keyName === 'on' && t.isObjectExpression(prop.value)) {
      for (const ep of prop.value.properties) {
        if (!t.isObjectProperty(ep)) continue
        const k = t.isIdentifier(ep.key)
          ? ep.key.name
          : (ep.key as t.StringLiteral).value
        // 检查是否已存在 onXxx (避免 nativeOn 重复)
        const targetName = `on${capitalize(k)}`
        const alreadyExists = flatProps.some(
          (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: targetName }),
        )
        if (!alreadyExists) {
          flatProps.push(
            t.objectProperty(t.identifier(targetName), ep.value as t.Expression),
          )
          changes.push(`on: { ${k}: ... } → on${capitalize(k)}: ...`)
        }
      }
      removedProps.add(keyName)
      continue
    }
  }

  // 构造新 ObjectExpression: 先放合并的 (flatProps), 再放剩下的
  const remaining: t.ObjectProperty[] = []
  for (const prop of dataObj.properties) {
    if (t.isSpreadElement(prop)) {
      remaining.push(prop as any)  // 保留 spread
      continue
    }
    if (!t.isObjectProperty(prop)) continue
    const keyName = t.isIdentifier(prop.key)
      ? prop.key.name
      : (prop.key as t.StringLiteral).value
    if (removedProps.has(keyName)) continue
    remaining.push(prop)
  }

  const newData = t.objectExpression([...flatProps, ...remaining])
  return { newData, changes, preChildren, reviews }
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

/**
 * 主入口: 迁移 render(h) 中 h() 签名
 */
export function migrateRenderFnH(scriptAst: any): RenderFnResult {
  const changes: string[] = []
  const reviewItems: string[] = []
  let modifications = 0

  if (!scriptAst) return { modifications, changes, reviewItems }

  traverse(scriptAst, {
    CallExpression(path: NodePath<t.CallExpression>) {
      const node = path.node
      if (!isHCall(node.callee)) return

      // h() 至少 2 个参数才需要处理 data
      if (node.arguments.length < 2) return
      const dataArg = node.arguments[1]
      if (!t.isObjectExpression(dataArg)) return

      const result = migrateVNodeData(dataArg)
      if (result.changes.length > 0) {
        node.arguments[1] = result.newData
        modifications += result.changes.length
        for (const c of result.changes) changes.push(`h(): ${c}`)
        for (const r of result.reviews) reviewItems.push(r)
      }

      // 处理 preChildren: 如果有 scopedSlots 提取, 插到现有 children 之前
      if (result.preChildren.length > 0 && node.arguments.length >= 3) {
        const existing = node.arguments[2]
        if (existing && t.isArrayExpression(existing)) {
          // 在数组前插入
          existing.elements = [...result.preChildren, ...existing.elements] as any
        } else if (existing) {
          // 单个 child, 包成数组
          node.arguments[2] = t.arrayExpression([
            ...result.preChildren,
            existing as any,
          ])
        }
      } else if (result.preChildren.length > 0) {
        // 之前没 children, 现在加上
        node.arguments[2] = t.arrayExpression(result.preChildren as any)
      }
    },
  })

  return { modifications, changes, reviewItems }
}
