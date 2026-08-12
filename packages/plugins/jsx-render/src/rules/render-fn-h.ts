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
 * 实现策略 (iter-120):
 *   1. 用 babel parser 解析 .tsx/.ts/.js 文件的整个 source
 *   2. 找到所有 h() / createElement() / $createElement() 调用
 *   3. 检查第二参数 (VNodeData) 是否是 ObjectExpression
 *   4. 按顺序合并/转换属性到一个新的 ObjectExpression
 *   5. 替换原 ObjectExpression
 *   6. 用 babel generator 输出新 source
 *
 * 局限:
 *   - 不支持 h() 调用嵌套在动态 import 里的情况
 *   - 不支持 hook: { mounted() {} } (标 review, 让用户手动)
 *   - 不支持 scopedSlots 命名 slot (除 default, 标 review)
 */

import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'

// @ts-ignore
const traverse = (_traverse as any).default || _traverse
const generate = (_generate as any).default || _generate

export interface RenderFnResult {
  modifications: number
  changes: string[]
  reviewItems: string[]
  /** New source code (only if changes were made via AST rewrite) */
  newSource?: string
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
  reviews: string[]
} {
  const changes: string[] = []
  const reviews: string[] = []

  // 分类属性
  const flatProps: t.ObjectProperty[] = []  // 直接放顶层
  const removedProps = new Set<string>()

  for (const prop of dataObj.properties) {
    if (!t.isObjectProperty(prop)) continue
    if (t.isSpreadElement(prop)) continue
    if (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key)) continue
    const keyName = t.isIdentifier(prop.key)
      ? prop.key.name
      : (prop.key as t.StringLiteral).value

    // ============ slot: 'header' ============
    if (keyName === 'slot' && t.isStringLiteral(prop.value)) {
      continue
    }

    // ============ staticClass: 'foo' → 合并到 class ============
    if (keyName === 'staticClass' && t.isStringLiteral(prop.value)) {
      const staticVal = prop.value.value
      const classProp = dataObj.properties.find(
        (p) => t.isObjectProperty(p) && (t.isIdentifier((p as any).key, { name: 'class' }) || (t.isStringLiteral((p as any).key) && (p as any).key.value === 'class')),
      ) as t.ObjectProperty | undefined

      if (classProp && t.isStringLiteral(classProp.value)) {
        classProp.value = t.stringLiteral(`${classProp.value.value} ${staticVal}`)
      } else {
        flatProps.push(
          t.objectProperty(t.identifier('class'), t.stringLiteral(staticVal)),
        )
      }
      removedProps.add(keyName)
      changes.push(`staticClass: '${staticVal}' → class`)
      continue
    }

    // ============ refInFor: true → 移除 ============
    if (keyName === 'refInFor') {
      removedProps.add(keyName)
      changes.push(`refInFor removed (Vue 3 自动处理)`)
      continue
    }

    // ============ hook: { mounted() {} } ============
    if (keyName === 'hook' && t.isObjectExpression(prop.value)) {
      reviews.push(
        `hook: { mounted/updated/beforeDestroy ... } 需手动改写为 onMounted/onUpdated/onBeforeUnmount`,
      )
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
    if (keyName === 'scopedSlots' && t.isObjectExpression(prop.value)) {
      reviews.push(
        `scopedSlots 合并到 slots — fn 提取为 children, 行为可能有变化 (Vue 3 slots 统一)`,
      )
      // 不修改结构, 但移除 scopedSlots 节点 (用户需要手改)
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
        if (k === 'class' || k === 'style') continue
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
        const propKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k)
          ? (t.identifier(k) as any)
          : (t.stringLiteral(k) as any)
        flatProps.push(t.objectProperty(propKey, dp.value as t.Expression))
      }
      removedProps.add(keyName)
      changes.push(`domProps: {...} 展开到顶层`)
      continue
    }

    // ============ nativeOn: { click: h } → onClick: h ============
    if (keyName === 'nativeOn' && t.isObjectExpression(prop.value)) {
      for (const ep of prop.value.properties) {
        if (!t.isObjectProperty(ep)) continue
        const k = t.isIdentifier(ep.key)
          ? ep.key.name
          : (ep.key as t.StringLiteral).value
        flatProps.push(
          t.objectProperty(t.identifier(`on${capitalize(k)}`), ep.value as t.Expression),
        )
        changes.push(`nativeOn: { ${k}: ... } → on${capitalize(k)}: ...`)
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

  // 构造新 ObjectExpression
  const remaining: t.ObjectProperty[] = []
  for (const prop of dataObj.properties) {
    if (t.isSpreadElement(prop)) {
      remaining.push(prop as any)
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
  return { newData, changes, reviews }
}

function capitalize(s: string): string {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

/**
 * 主入口: 迁移 render(h) 中 h() 签名
 *
 * @param source The full source code of the file
 * @param isTs Whether to parse with TypeScript plugin
 * @returns RenderFnResult with newSource if changes were made
 */
export function migrateRenderFnH(source: string, isTs: boolean): RenderFnResult {
  const changes: string[] = []
  const reviewItems: string[] = []
  let modifications = 0

  let ast: any
  try {
    ast = parse(source, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      plugins: [
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'jsx',
        ...(isTs ? ['typescript' as const] : []),
      ],
    })
  } catch (e: any) {
    return { modifications, changes: [`parse failed: ${e.message}`], reviewItems }
  }

  traverse(ast, {
    CallExpression(path: any) {
      const node = path.node
      if (!isHCall(node.callee)) return
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
    },
  })

  if (modifications === 0) {
    return { modifications, changes, reviewItems }
  }

  // Generate new source
  let newSource: string
  try {
    const out = generate(ast, {
      comments: true,
      compact: false,
      concise: false,
    })
    newSource = out.code
  } catch (e: any) {
    return { modifications, changes: [`generate failed: ${e.message}`], reviewItems }
  }

  return { modifications, changes, reviewItems, newSource }
}
