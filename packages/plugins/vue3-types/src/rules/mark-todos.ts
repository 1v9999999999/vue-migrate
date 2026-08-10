/**
 * Rule 4.4 / 4.5 / 4.6 — TODO markers for `this.$refs.xxx` / `this.$store` / `this.$route`
 *
 * For MVP we don't auto-convert. We:
 *  - add a leading comment on the function body line where the first offending
 *    `this.$<thing>` appears, e.g.
 *        // TODO(vue3-types): this.$refs.foo → ref<InstanceType<typeof Foo>>()
 *  - register a manual review item via ctx.utils.manualReview
 *
 * We de-dup: if the file has 3 uses of `this.$store`, we only mark once.
 */

import * as t from '@babel/types'
// @ts-ignore — @babel/traverse lacks .d.ts in this project's lockfile
import _traverse from '@babel/traverse'
import type { TransformContext } from '@vue-migrate/core'

// @ts-ignore — @babel/traverse default export interop
const traverse = (_traverse as any).default || _traverse

interface TodoRule {
  /** "$refs" / "$store" / "$route" */
  property: string
  /** The Vue3 replacement text */
  vue3Hint: string
  /** Category label for review report */
  category: string
}

const TODO_RULES: TodoRule[] = [
  {
    property: '$refs',
    vue3Hint: 'this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />',
    category: '$refs',
  },
  {
    property: '$store',
    vue3Hint:
      'this.$store → const store = useXxxStore() (Pinia)  // state→store.xxx, dispatch→store.action(), commit→store.$patch({...}); 注意 Vuex 的 getter 在 Pinia 里直接当 computed 属性',
    category: '$store',
  },
  {
    property: '$route',
    vue3Hint: 'this.$route → useRoute()  (vue-router@4)',
    category: '$route',
  },
  {
    property: '$router',
    vue3Hint: 'this.$router → useRouter()  (vue-router@4)',
    category: '$router',
  },
  {
    // vue3-template 插件会先把 $listeners rename 为 $attrs, 所以这里查 $attrs
    property: '$attrs',
    vue3Hint:
      'this.$attrs (Vue3 合并了原 Vue2 的 $listeners)  // 例: this.$attrs.onClick → emits("onClick", $event), 或在子组件 setup 里 const emit = defineEmits(["onClick"]); emit("onClick", $event)',
    category: '$attrs (含原 $listeners)',
  },
  {
    property: '$children',
    vue3Hint:
      'this.$children → 用 template ref 替代  // 例: this.$children[0].someMethod() → const childRef = ref<InstanceType<typeof Child>>(null); childRef.value.someMethod(); 模板: <Child ref="childRef" />',
    category: '$children',
  },
  {
    // vue3-template 插件会先把 $scopedSlots rename 为 $slots, 所以这里查 $slots
    property: '$slots',
    vue3Hint:
      'this.$slots.xxx() (slots are now functions)  // Vue2 的 $scopedSlots 已重命名为 $slots; 旧用法 this.$scopedSlots.xxx → 新用法 this.$slots.xxx()',
    category: '$slots (含原 $scopedSlots)',
  },
]

export function markAccessorsAsTodo(ctx: TransformContext): void {
  const { file, utils } = ctx
  if (!file.scriptAst) return

  // Collect categories seen and how many times, per enclosing function
  interface FnTodos {
    path: any
    fn: t.Function
    categories: Map<string, { count: number; hint: string }>
  }
  const fnsByLocation = new Map<t.Function, FnTodos>()
  const counts = new Map<string, number>()

  // Walk every `this.<$x>` MemberExpression
  let memberCount = 0
  let thisMemberCount = 0
  const thisPropertyNames = new Set<string>()
  traverseThisMembers(file.scriptAst, (memberExpr, path) => {
    memberCount++
    const propNode = memberExpr.property
    if (!t.isIdentifier(propNode)) return
    thisMemberCount++
    const name = propNode.name
    thisPropertyNames.add(name)
    const rule = TODO_RULES.find((r) => r.property === name)
    if (!rule) return

    counts.set(rule.category, (counts.get(rule.category) || 0) + 1)

    const enclosingFn = findEnclosingFunction(path)
    if (!enclosingFn) return

    let entry = fnsByLocation.get(enclosingFn)
    if (!entry) {
      entry = { path, fn: enclosingFn, categories: new Map() }
      fnsByLocation.set(enclosingFn, entry)
    }
    const cat = entry.categories.get(rule.category)
    if (cat) {
      cat.count++
    } else {
      entry.categories.set(rule.category, { count: 1, hint: rule.vue3Hint })
    }
  })

  // Now write one combined comment per enclosing function
  for (const { fn, categories } of fnsByLocation.values()) {
    const lines: string[] = ['vue3-types TODO:', '']
    for (const [cat, info] of categories) {
      lines.push(`  - ${cat} ×${info.count}: ${info.hint}`)
    }
    const comment: t.CommentBlock = {
      type: 'CommentBlock',
      value: `\n * ${lines.join('\n * ')}\n `,
    } as any
    const existing = (fn as any).leadingComments as t.Comment[] | undefined
    ;(fn as any).leadingComments = [...(existing || []), comment]
  }

  // Register ONE manual review per category per file (not per function) to
  // keep the total review count low. The detailed counts are in the TODO
  // comments above.
  for (const [cat, count] of counts) {
    const rule = TODO_RULES.find((r) => r.category === cat)
    if (!rule) continue
    utils.manualReview(`vue3-types TODO: ${cat} usage found (×${count}) — ${rule.vue3Hint}`)
  }

  // Mark changed if we did anything
  if (fnsByLocation.size > 0) {
    const summary = [...counts.entries()].map(([k, v]) => `${k}×${v}`).join(', ')
    ;(utils.markChanged as any)(`marked TODO for Vue3-only accessors: ${summary}`)
    ctx.log(`[vue3-types] TODO markers added: ${summary}`)
  }
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/**
 * Walk all MemberExpressions where the object is a `this` identifier.
 * Calls cb(memberExpr, path) for each match.
 */
function traverseThisMembers(ast: t.Node, cb: (m: t.MemberExpression, path: any) => void): void {
  traverse(ast, {
    MemberExpression: {
      enter(path: any) {
        const node = path.node as t.MemberExpression
        // `this` may be an Identifier (older parser) or ThisExpression (newer parser)
        const obj = node.object
        const isThis = (t.isIdentifier(obj) && obj.name === 'this') || t.isThisExpression(obj)
        if (isThis) {
          cb(node, path)
        }
      },
    },
  })
}

/** Walk up the path to find the nearest enclosing function-like node. */
function findEnclosingFunction(path: any): t.Function | null {
  let p = path.parentPath
  while (p) {
    if (
      t.isFunction(p.node) ||
      t.isFunctionExpression(p.node) ||
      t.isArrowFunctionExpression(p.node) ||
      t.isObjectMethod(p.node)
    ) {
      return p.node as t.Function
    }
    p = p.parentPath
  }
  return null
}
