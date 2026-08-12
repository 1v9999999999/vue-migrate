/**
 * Convert a TS class component AST node into a `<script setup>` string.
 *
 * Inputs:
 *   - classNode: babel ClassDeclaration / ClassExpression (already determined to be
 *     a Vue class component — extends Vue or extends mixins(...))
 *   - scriptInner: full script text (for collecting before-class imports if needed)
 *   - isTs: true if the source <script> declared lang="ts" (or .ts/.tsx file)
 *
 * Output: ClassComponentResult with `setupCode`, `extraImports`, `vueImports`, etc.
 *
 * Conversion rules (iter-119):
 *   - class field `count = 0`            → `const count = ref(0)`           (vueImports: ref)
 *   - class field `name: string = ''`    → `const name = ref<string>('')`   (vueImports: ref)
 *   - getter method `get double() {...}` → `const double = computed(() => ...)`  (vueImports: computed)
 *   - lifecycle method `mounted() {...}` → `onMounted(() => {...})`         (vueImports: onMounted)
 *   - method `inc() { this.count++ }`    → `function inc() { count.value++ }`
 *   - @Prop({ default: '' }) name        → `const props = defineProps({ name: { default: '' } })`
 *   - @State('user') user                → `const user = computed(() => useStore().state.user)`
 *   - @Getter('token') token             → `const token = computed(() => useStore().getters.token)`
 *   - @Action('login') login             → `const login = (payload) => useStore().dispatch('login', payload)`
 *   - @Watch('user') onUserChange        → `watch(user, (newVal) => { ... })`  (note: user is a computed)
 *
 * this.xxx in method bodies:
 *   - if xxx is a class field: this.xxx → xxx.value
 *   - if xxx is a @State/@Getter name: this.xxx → xxx (already a computed)
 *   - if xxx is a @Prop name: this.xxx → props.xxx
 *   - if xxx is a @Action name: this.xxx → xxx (function)
 *   - if xxx is a method: this.xxx → xxx (function)
 *   - if xxx is `this.$nextTick` → nextTick
 *   - if xxx is `this.$emit` → emit  (TODO: review if no defineEmits)
 *   - if xxx is `this.$route`/`$router` → route/router
 *
 * 限制 / manual review (passed up to caller):
 *   - @Component({ components: {...} }) — components 注册, 需手动
 *   - @Emit decorator — emit 重新触发, 复杂
 *   - extends mixins(...) — mixin 成员, 需手拆
 *   - constructor method — 需手拆
 *   - @Provide / @Inject — 需手拆
 */

import type * as t from '@babel/types'

export interface ClassComponentResult {
  setupCode: string
  extraImports: string[]         // e.g. "import { useStore } from 'vuex'"
  vueImports: Set<string>        // from 'vue': ref, reactive, computed, watch, onMounted, etc.
  reviewItems: string[]          // manual review items
  classMembers: number           // number of class members processed (for logging)
  changed: boolean               // true if any meaningful change was made
}

interface ClassField {
  name: string                   // 'count', 'name', etc.
  typeAnnotation: string | null  // e.g. 'string', 'number' (raw TS source)
  initializer: string | null     // e.g. '0', "''", "[]" (raw source)
  /** Original babel node offset range (for raw body extraction) */
  start: number
  end: number
}

interface PropInfo {
  name: string                   // 'name', 'title'
  optionsSource: string | null   // raw source of @Prop({...}) arg, or null if @Prop shorthand
}

interface ClassMethod {
  name: string                   // 'mounted', 'onUserChange', 'inc'
  params: string                 // '(n: number)' or '()' (raw source of params)
  body: string                   // full method body source (between { })
  isStatic: boolean
  isAsync: boolean
  isGenerator: boolean
  isLifecycle: boolean
  lifecycleHook: string | null   // 'onMounted' | 'onBeforeUnmount' | etc., null if not lifecycle
  isGetter: boolean             // true if class has `get xxx()` form
  isSetter: boolean             // true if class has `set xxx()` form
  start: number
  end: number
  /** decorators applied to this method, in source order */
  decorators: MethodDecorator[]
}

interface MethodDecorator {
  name: string                   // 'Watch', 'Emit', etc.
  args: string[]                 // raw string args (e.g. "'user'", "'change', { deep: true }")
}

interface ClassFieldDecorated {
  field: ClassField
  decorators: FieldDecorator[]
}

interface FieldDecorator {
  name: string                   // 'Prop', 'State', 'Getter', 'Action', etc.
  args: string[]                 // raw arg sources
  /** Full decorator source range */
  start: number
  end: number
}

/**
 * The lifecycle method name → setup hook name mapping.
 * Same mapping used by composition plugin's options-to-setup.
 */
const LIFECYCLE_MAP: Record<string, string> = {
  beforeCreate: 'onBeforeMount',  // closest equivalent (no real beforeCreate in setup)
  created: 'onMounted',           // ditto
  beforeMount: 'onBeforeMount',
  mounted: 'onMounted',
  beforeUpdate: 'onBeforeUpdate',
  updated: 'onUpdated',
  activated: 'onActivated',
  deactivated: 'onDeactivated',
  beforeUnmount: 'onBeforeUnmount',
  unmounted: 'onUnmounted',
  errorCaptured: 'onErrorCaptured',
  beforeDestroy: 'onBeforeUnmount',
  destroyed: 'onUnmounted',
  // Vue 2 render
  beforeRouteEnter: '',  // not in setup
  beforeRouteLeave: '',
  // Vue Router navigation guards — leave as manual review
}

/**
 * Convert a class component to setup code.
 */
export function convertClassComponentToSetup(
  classNode: t.ClassDeclaration | t.ClassExpression,
  scriptInner: string,
  isTs: boolean,
): ClassComponentResult {
  const result: ClassComponentResult = {
    setupCode: '',
    extraImports: [],
    vueImports: new Set<string>(),
    reviewItems: [],
    classMembers: 0,
    changed: false,
  }

  const classBody = classNode.body
  if (!classBody || classBody.type !== 'ClassBody') {
    return result
  }

  // Detect vuex usage early to know if we need to add `useStore` import
  let needsVuex = false
  let needsVueRouter = false
  let hasEmits = false

  // 1. Classify members: fields vs methods
  //    Note: babel exposes class members as ClassProperty (legacy) or PropertyDefinition (TS new).
  //    Both have similar shape: key, value (initializer), decorators, typeAnnotation, etc.
  const fields: ClassFieldDecorated[] = []
  const methods: ClassMethod[] = []

  for (const member of classBody.body) {
    if (member.type === 'ClassProperty' || member.type === 'PropertyDefinition') {
      // Class field (e.g. `count = 0`, `name: string = ''`)
      const field: ClassField = {
        name: getKeyName(member.key),
        typeAnnotation: member.typeAnnotation ? extractTSTypeText(member.typeAnnotation, scriptInner) : null,
        initializer: member.value ? extractSource(member.value, scriptInner) : null,
        start: (member as any).start ?? 0,
        end: (member as any).end ?? 0,
      }
      const decorators = extractFieldDecorators(member, scriptInner)
      const decorated: ClassFieldDecorated = { field, decorators }
      fields.push(decorated)

      // Detect vuex / prop decorators
      for (const dec of decorators) {
        if (dec.name === 'State' || dec.name === 'Getter' || dec.name === 'Action' ||
            dec.name === 'Mutation' || dec.name === 'namespace') {
          needsVuex = true
        }
        if (dec.name === 'Prop' || dec.name === 'PropSync' || dec.name === 'Model') {
          // no extra import needed
        }
        if (dec.name === 'Inject' || dec.name === 'Provide') {
          result.reviewItems.push(
            `@${dec.name} decorator detected — please manually convert to provide()/inject() in <script setup>.`,
          )
        }
      }
    } else if (member.type === 'ClassMethod' || member.type === 'MethodDefinition') {
      // Class method (e.g. `mounted() {...}`, `get double() {...}`, `inc() {...}`)
      const method: ClassMethod = {
        name: getKeyName(member.key),
        params: extractParamsText(member, scriptInner),
        body: extractMethodBody(member, scriptInner),
        isStatic: !!(member as any).static,
        isAsync: !!(member as any).async,
        isGenerator: !!(member as any).generator,
        isLifecycle: false,
        lifecycleHook: null,
        isGetter: (member as any).kind === 'get',
        isSetter: (member as any).kind === 'set',
        start: (member as any).start ?? 0,
        end: (member as any).end ?? 0,
        decorators: extractMethodDecorators(member, scriptInner),
      }

      // Check if it's a lifecycle hook
      if (!method.isStatic && !method.isGetter && !method.isSetter) {
        const hook = LIFECYCLE_MAP[method.name]
        if (hook) {
          method.isLifecycle = true
          method.lifecycleHook = hook
        }
      }

      // Check for @Watch / @Emit decorators
      for (const dec of method.decorators) {
        if (dec.name === 'Watch') {
          // need watch + the source
        }
        if (dec.name === 'Emit') {
          hasEmits = true
        }
      }

      methods.push(method)
    } else if (member.type === 'TSAbstractMethodDef' || member.type === 'TSDeclareMethod') {
      // Type-only declarations — skip
      continue
    }
    // Skip TSIndexSignature, static blocks, etc.
  }

  // 2. Check the @Component decorator for components/mixins options
  //    Note: the @Component decorator is on the class itself, not on a member.
  //    But the iter-119 task only shows it without options — so we handle both.
  for (const dec of (classNode.decorators as any[]) || []) {
    const name = getDecoratorName(dec)
    if (name === 'Component') {
      const arg = dec.expression?.type === 'CallExpression' ? dec.expression.arguments[0] : null
      if (arg && arg.type === 'ObjectExpression') {
        const hasComponents = arg.properties.some((p: any) => getKeyName(p.key) === 'components')
        const hasMixins = arg.properties.some((p: any) => getKeyName(p.key) === 'mixins')
        if (hasComponents) {
          result.reviewItems.push(
            `@Component({ components: {...} }) — components 注册需要手动在 <script setup> 里 import + 引用, e.g. import ChildComp from './ChildComp.vue'。`,
          )
        }
        if (hasMixins) {
          result.reviewItems.push(
            `@Component({ mixins: [...] }) — Vue 3 不推荐 mixins; 建议提取为 composable (useXxx() 函数)。`,
          )
        }
      }
    }
  }

  // 3. Now generate the setup code
  const lines: string[] = []

  // 3a. Collect refs (class fields without decorator → ref)
  // 3b. Collect defineProps (class fields with @Prop)
  // 3c. Collect vuex state/getter/action
  // 3d. Emit watch decorators
  // 3e. Emit computed getters
  // 3f. Emit lifecycle hooks
  // 3g. Emit regular methods
  // 3h. Emit @Watch handlers
  // 3i. Emit @Emit handlers

  // First, collect all names referenced by method bodies (for this.xxx rewriting)
  const fieldNames = new Set<string>()   // data fields → ref
  const methodNames = new Set<string>()  // methods → direct
  const propNames = new Set<string>()    // @Prop → props.xxx
  const stateNames = new Set<string>()   // @State → state.xxx (via computed)
  const getterNames = new Set<string>()  // @Getter → getters.xxx (via computed)
  const actionNames = new Set<string>()  // @Action → function

  // Process decorated fields: @Prop / @State / @Getter / @Action
  const propEntries: Array<{ name: string; options: string | null }> = []

  for (const f of fields) {
    const decs = f.decorators
    if (decs.length === 0) {
      // Plain class field → ref
      fieldNames.add(f.field.name)
    } else {
      // Has decorator(s) — figure out the role
      const propDec = decs.find((d) => d.name === 'Prop' || d.name === 'PropSync')
      const stateDec = decs.find((d) => d.name === 'State' || d.name === 'namespace')
      const getterDec = decs.find((d) => d.name === 'Getter')
      const actionDec = decs.find((d) => d.name === 'Action')
      const mutationDec = decs.find((d) => d.name === 'Mutation')

      if (propDec) {
        propNames.add(f.field.name)
        const opts = propDec.args[0] || null
        propEntries.push({ name: f.field.name, options: opts })
      } else if (stateDec) {
        stateNames.add(f.field.name)
      } else if (getterDec) {
        getterNames.add(f.field.name)
      } else if (actionDec) {
        actionNames.add(f.field.name)
      } else if (mutationDec) {
        result.reviewItems.push(
          `@Mutation decorator on "${f.field.name}" — Vue 3 + Pinia 中, mutation 应改为 store 内 action。手动处理。`,
        )
        // Treat as action for safety
        actionNames.add(f.field.name)
      } else {
        // Unknown decorator — treat as plain field
        fieldNames.add(f.field.name)
      }
    }
  }

  // 3a. defineProps from @Prop
  if (propEntries.length > 0) {
    result.vueImports.add('defineProps')
    const propObjParts: string[] = []
    for (const p of propEntries) {
      if (p.options) {
        // Use the raw options source
        propObjParts.push(`${p.name}: ${p.options}`)
      } else {
        // No options — empty prop definition
        propObjParts.push(`${p.name}: null`)
      }
    }
    lines.push(`const props = defineProps({ ${propObjParts.join(', ')} })`)
  }

  // 3b. vuex-class state/getter/action → useStore
  if (needsVuex) {
    result.extraImports.push(`import { useStore } from 'vuex'`)
  }

  // Emit @State declarations
  if (stateNames.size > 0) {
    result.vueImports.add('computed')
    for (const f of fields) {
      if (!stateNames.has(f.field.name)) continue
      const stateDec = f.decorators.find((d) => d.name === 'State' || d.name === 'namespace')!
      const arg = stateDec.args[0] || `'${f.field.name}'`
      // @State('user') → const user = computed(() => useStore().state.user)
      // @State('module', 'prop') → const prop = computed(() => useStore().state.module.prop)
      // @State('namespace') → spread all state from that module (TODO: can't do that simply)
      if (stateDec.name === 'namespace' && stateDec.args.length === 1) {
        result.reviewItems.push(
          `@State('namespace') — spread all state from module ${arg}; please manually destructure: const { a, b } = useStore().state.${arg}`,
        )
        continue
      }
      if (stateDec.args.length === 2) {
        // @State('module', 'prop')
        const moduleName = stripStringQuotes(stateDec.args[0])
        const propName = stripStringQuotes(stateDec.args[1])
        lines.push(`const ${f.field.name} = computed(() => useStore().state.${moduleName}.${propName})`)
      } else {
        // @State('key') or @State('module.key')
        const argStr = stateDec.args[0] || `'${f.field.name}'`
        // strip outer quotes to embed as object path
        const innerPath = argStr.replace(/^['"`]|['"`]$/g, '')
        lines.push(`const ${f.field.name} = computed(() => useStore().state['${innerPath}'])`)
      }
    }
  }

  // Emit @Getter declarations
  if (getterNames.size > 0) {
    result.vueImports.add('computed')
    for (const f of fields) {
      if (!getterNames.has(f.field.name)) continue
      const getterDec = f.decorators.find((d) => d.name === 'Getter')!
      const arg = getterDec.args[0] || `'${f.field.name}'`
      const innerPath = arg.replace(/^['"`]|['"`]$/g, '')
      lines.push(`const ${f.field.name} = computed(() => useStore().getters['${innerPath}'])`)
    }
  }

  // Emit @Action declarations
  if (actionNames.size > 0) {
    for (const f of fields) {
      if (!actionNames.has(f.field.name)) continue
      const actionDec = f.decorators.find((d) => d.name === 'Action' || d.name === 'Mutation')!
      const arg = actionDec.args[0] || `'${f.field.name}'`
      const innerPath = arg.replace(/^['"`]|['"`]$/g, '')
      // const login = (payload) => useStore().dispatch('login', payload)
      // For single-arg dispatch, simpler form:
      lines.push(`const ${f.field.name} = (payload) => useStore().dispatch('${innerPath}', payload)`)
    }
  }

  // 3c. Plain class fields → ref
  for (const f of fields) {
    if (!fieldNames.has(f.field.name)) continue
    const init = f.field.initializer
    const type = f.field.typeAnnotation
    if (init !== null) {
      if (isTs && type) {
        lines.push(`const ${f.field.name} = ref<${type}>(${init})`)
      } else if (isTs) {
        lines.push(`const ${f.field.name} = ref(${init})`)
      } else {
        lines.push(`const ${f.field.name} = ref(${init})`)
      }
    } else if (isTs && type) {
      lines.push(`const ${f.field.name} = ref<${type}>()`)
    } else {
      lines.push(`const ${f.field.name} = ref()`)
    }
  }
  if (fieldNames.size > 0) {
    result.vueImports.add('ref')
  }

  // 3d. Emit @Watch handlers
  for (const method of methods) {
    const watchDec = method.decorators.find((d) => d.name === 'Watch')
    if (!watchDec) continue
    const watchKey = watchDec.args[0] || `'${method.name}'`
    const watchOpts = watchDec.args[1] || null
    result.vueImports.add('watch')
    // Strip outer quotes from watchKey for embedding in source
    const innerKey = watchKey.replace(/^['"`]|['"`]$/g, '')
    // Build watch body — replace (newVal, oldVal) → ... with our function
    // Method has params like (newVal: any, oldVal: any) — we strip TS type annotations
    // so the output is valid plain JS (no TS plugin in core's selfCheck parser)
    const watchBody = method.body.trim()
    const cbParams = stripTypeAnnotations(method.params || '(newVal, oldVal)')
    // Build the source ref — resolve simple identifier or dot-path
    let watchSource: string
    if (fieldNames.has(innerKey)) {
      watchSource = innerKey
    } else if (stateNames.has(innerKey)) {
      watchSource = innerKey
    } else if (getterNames.has(innerKey)) {
      watchSource = innerKey
    } else if (propNames.has(innerKey)) {
      watchSource = `props.${innerKey}`
    } else {
      // likely a method name or path
      watchSource = innerKey
    }
    if (watchOpts) {
      lines.push(`watch(${watchSource}, ${cbParams} => {\n${watchBody}\n}, ${watchOpts})`)
    } else {
      lines.push(`watch(${watchSource}, ${cbParams} => {\n${watchBody}\n})`)
    }
    // Mark this method as consumed
    method.name = ''  // don't emit again
  }

  // 3e. Emit @Emit handlers — TODO review
  for (const method of methods) {
    const emitDec = method.decorators.find((d) => d.name === 'Emit')
    if (!emitDec) continue
    const eventName = emitDec.args[0] || method.name
    const innerEvent = eventName.replace(/^['"`]|['"`]$/g, '')
    result.reviewItems.push(
      `@Emit('${innerEvent}') on method "${method.name}" — Vue 3 中需要在 <script setup> 顶部加 const emit = defineEmits(['${innerEvent}']), 然后方法内用 emit('${innerEvent}', ...)。` +
      `\n  请手动确认并修改方法体。`,
    )
    // Emit a placeholder that calls emit
    const innerName = method.name
    if (method.isAsync) {
      lines.push(`async function ${innerName}(...) {\n  // @Emit('${innerEvent}') — manually convert\n  ${method.body.trim()}\n}`)
    } else {
      lines.push(`function ${innerName}(...) {\n  // @Emit('${innerEvent}') — manually convert\n  ${method.body.trim()}\n}`)
    }
    hasEmits = true
    method.name = ''
  }

  // 3f. Emit @Watch / @Emit consumed methods (they have name='') — they're handled
  //     now iterate remaining methods
  methodNames.clear()
  for (const m of methods) {
    if (m.name && !m.isStatic && !m.isGetter && !m.isSetter && !m.isLifecycle) {
      methodNames.add(m.name)
    }
  }

  // 3g. Emit computed getters
  for (const m of methods) {
    if (!m.isGetter || m.isStatic) continue
    if (m.decorators.length > 0) continue  // skip if has decorators (already handled)
    result.vueImports.add('computed')
    const body = m.body.trim()
    // Replace this.xxx in body
    const newBody = replaceThisInBody(body, {
      fieldNames, methodNames, propNames, stateNames, getterNames, actionNames,
    })
    lines.push(`const ${m.name} = computed(() => {\n${newBody}\n})`)
  }

  // 3h. Emit lifecycle hooks
  for (const m of methods) {
    if (!m.isLifecycle || !m.lifecycleHook) continue
    if (m.isStatic) continue
    result.vueImports.add(m.lifecycleHook)
    const body = m.body.trim()
    const newBody = replaceThisInBody(body, {
      fieldNames, methodNames, propNames, stateNames, getterNames, actionNames,
    })
    const cbParams = m.params || '()'
    if (m.isAsync) {
      lines.push(`${m.lifecycleHook}(async ${cbParams} => {\n${newBody}\n})`)
    } else {
      lines.push(`${m.lifecycleHook}(${cbParams} => {\n${newBody}\n})`)
    }
  }

  // 3i. Emit regular methods (non-getter, non-lifecycle, non-decorated)
  //     Methods that have been "consumed" (name === '') were already emitted as @Watch/@Emit
  for (const m of methods) {
    if (!m.name) continue
    if (m.isStatic) continue
    if (m.isGetter || m.isSetter) continue
    if (m.isLifecycle) continue
    if (m.decorators.length > 0) continue
    if (m.name === 'constructor') {
      // Constructor in Vue class component is not supported in setup. Warn and emit a placeholder.
      result.reviewItems.push(
        `constructor detected — Vue 3 + <script setup> 不支持 constructor; 改为 setup() 函数 (在 script setup 顶层写初始化逻辑)。`,
      )
      continue
    }
    if (m.name === 'data' || m.name === 'render') {
      // 'data' is a method, but in class components 'data' isn't typical. render() is a function.
      // For now, treat as a regular method.
    }
    const body = m.body.trim()
    const newBody = replaceThisInBody(body, {
      fieldNames, methodNames, propNames, stateNames, getterNames, actionNames,
    })
    const params = stripTypeAnnotations(m.params || '()')
    if (m.isAsync) {
      lines.push(`async function ${m.name}${params} {\n${newBody}\n}`)
    } else {
      lines.push(`function ${m.name}${params} {\n${newBody}\n}`)
    }
  }

  result.classMembers = fields.length + methods.length
  result.setupCode = lines.join('\n\n')
  result.changed = lines.length > 0

  // Add defineEmits if @Emit was used
  if (hasEmits) {
    // We collected the event names in reviewItems. For each, the user can manually adjust.
    // For now, we just add a TODO comment in the setup code.
    const emitEvents: string[] = []
    for (const m of methods) {
      const emitDec = m.decorators.find((d) => d.name === 'Emit')
      if (emitDec) {
        const eventName = emitDec.args[0] || m.name
        const innerEvent = eventName.replace(/^['"`]|['"`]$/g, '')
        emitEvents.push(innerEvent)
      }
    }
    if (emitEvents.length > 0) {
      result.vueImports.add('defineEmits')
      // We prepend the defineEmits line to setupCode
      const defineEmitsLine = `const emit = defineEmits([${emitEvents.map((e) => `'${e}'`).join(', ')}])`
      result.setupCode = defineEmitsLine + '\n\n' + result.setupCode
    }
  }

  // Inject this.$nextTick / this.$emit / this.$route / this.$router usage
  // → if any method body uses these, add corresponding imports
  const allMethodBodies = methods.map((m) => m.body).join('\n')
  if (/\bthis\.\$nextTick\b/.test(allMethodBodies)) {
    result.vueImports.add('nextTick')
  }
  if (/\bthis\.\$route\b/.test(allMethodBodies)) {
    needsVueRouter = true
  }
  if (/\bthis\.\$router\b/.test(allMethodBodies)) {
    needsVueRouter = true
  }
  if (/\bthis\.\$store\b/.test(allMethodBodies)) {
    if (!needsVuex) {
      result.extraImports.push(`import { useStore } from 'vuex'`)
      needsVuex = true
    }
  }
  if (/\bthis\.\$emit\b/.test(allMethodBodies)) {
    // emit should be defined via defineEmits
    if (!result.vueImports.has('defineEmits') && !hasEmits) {
      // Generic emit — user-defined events. Add a manual review note.
      result.reviewItems.push(
        `this.$emit found in class methods — please add defineEmits([...]) at top of <script setup> with the event names you emit.`,
      )
    }
  }
  if (needsVueRouter) {
    result.extraImports.push(`import { useRoute, useRouter } from 'vue-router'`)
    if (/\bthis\.\$route\b/.test(allMethodBodies)) {
      lines.unshift(`const route = useRoute()`)
    }
    if (/\bthis\.\$router\b/.test(allMethodBodies)) {
      lines.unshift(`const router = useRouter()`)
    }
  }

  return result
}

// ============================================================
// Helpers
// ============================================================

/** Get the identifier name from a babel node key (Identifier / StringLiteral / NumericLiteral). */
function getKeyName(key: any): string {
  if (!key) return ''
  if (key.type === 'Identifier') return key.name
  if (key.type === 'StringLiteral') return key.value
  if (key.type === 'NumericLiteral') return String(key.value)
  if (key.type === 'PrivateName') return '#' + (key.id?.name || '')
  return ''
}

/** Get the decorator name (handles both `@Foo` and `@Foo()` forms). */
function getDecoratorName(dec: any): string {
  if (!dec || !dec.expression) return ''
  const expr = dec.expression
  if (expr.type === 'Identifier') return expr.name
  if (expr.type === 'CallExpression' && expr.callee?.type === 'Identifier') {
    return expr.callee.name
  }
  return ''
}

/** Extract source text from a babel node, using scriptInner. */
function extractSource(node: any, scriptInner: string): string {
  if (!node || (node as any).start === undefined) return ''
  const start = (node as any).start
  const end = (node as any).end
  if (typeof start !== 'number' || typeof end !== 'number') return ''
  return scriptInner.substring(start, end)
}

/** Extract TS type annotation as text (raw). */
function extractTSTypeText(typeNode: any, scriptInner: string): string {
  if (!typeNode) return ''
  return extractSource(typeNode, scriptInner)
    .replace(/^:\s*/, '')
    .trim()
}

/** Extract method params source (including parens). */
function extractParamsText(method: any, scriptInner: string): string {
  // babel stores params as a separate node from body. params is the array of params.
  // We need the source from after method.key to the start of body.
  const start = (method as any).start
  const end = (method as any).end
  if (typeof start !== 'number' || typeof end !== 'number') return '()'
  const fullText = scriptInner.substring(start, end)
  // Find the opening paren after method key
  const keyEnd = (method.key as any).end
  if (typeof keyEnd !== 'number') {
    // fallback: find first '('
    const idx = fullText.indexOf('(')
    if (idx < 0) return '()'
    // match parens (handle generics like `method<T>(x: T)`)
    let depth = 0
    let inStr: string | null = null
    for (let i = idx; i < fullText.length; i++) {
      const ch = fullText[i]
      if (inStr) {
        if (ch === inStr && fullText[i - 1] !== '\\') inStr = null
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = ch
        continue
      }
      if (ch === '(') depth++
      if (ch === ')') {
        depth--
        if (depth === 0) return fullText.substring(idx, i + 1)
      }
    }
    return '()'
  }
  // key end is the offset of end of the key identifier — search from there
  const relativeKeyEnd = keyEnd - start
  const idx = fullText.indexOf('(', relativeKeyEnd)
  if (idx < 0) return '()'
  let depth = 0
  let inStr: string | null = null
  for (let i = idx; i < fullText.length; i++) {
    const ch = fullText[i]
    if (inStr) {
      if (ch === inStr && fullText[i - 1] !== '\\') inStr = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch
      continue
    }
    if (ch === '(') depth++
    if (ch === ')') {
      depth--
      if (depth === 0) return fullText.substring(idx, i + 1)
    }
  }
  return '()'
}

/** Extract method body (between { and matching }) as raw source. */
function extractMethodBody(method: any, scriptInner: string): string {
  // babel MethodDefinition has body: BlockStatement with start/end
  const bodyNode = method.body
  if (!bodyNode || (bodyNode as any).start === undefined) return ''
  const start = (bodyNode as any).start
  const end = (bodyNode as any).end
  if (typeof start !== 'number' || typeof end !== 'number') return ''
  let body = scriptInner.substring(start, end)
  // Strip outer braces
  if (body.startsWith('{') && body.endsWith('}')) {
    body = body.substring(1, body.length - 1)
  }
  return body
}

/** Extract decorators from a class field, with their raw arg sources. */
function extractFieldDecorators(member: any, scriptInner: string): FieldDecorator[] {
  const out: FieldDecorator[] = []
  const decs = member.decorators || []
  for (const dec of decs) {
    const name = getDecoratorName(dec)
    const args: string[] = []
    if (dec.expression?.type === 'CallExpression') {
      for (const arg of dec.expression.arguments) {
        args.push(extractSource(arg, scriptInner))
      }
    }
    out.push({
      name,
      args,
      start: (dec as any).start ?? 0,
      end: (dec as any).end ?? 0,
    })
  }
  return out
}

/** Extract decorators from a class method. */
function extractMethodDecorators(member: any, scriptInner: string): MethodDecorator[] {
  const out: MethodDecorator[] = []
  const decs = member.decorators || []
  for (const dec of decs) {
    const name = getDecoratorName(dec)
    const args: string[] = []
    if (dec.expression?.type === 'CallExpression') {
      for (const arg of dec.expression.arguments) {
        args.push(extractSource(arg, scriptInner))
      }
    }
    out.push({ name, args })
  }
  return out
}

interface ThisRewriteContext {
  fieldNames: Set<string>
  methodNames: Set<string>
  propNames: Set<string>
  stateNames: Set<string>
  getterNames: Set<string>
  actionNames: Set<string>
}

/**
 * Replace `this.xxx` in method body with the appropriate identifier in setup form.
 *
 * Rules (priority order — first match wins):
 *   1. this.$route / $router / $store / $nextTick / $emit / $message / $notify / $msgbox / $loading / $refs / $attrs / $slots / $el / $forceUpdate / $destroy / $set / $delete / $watch / $on / $off / $once / $children / $parent / $root / $vnode / $isServer / $isDestroyed / $options
 *      → handled by known mappings (route, router, store, nextTick, emit, etc.)
 *   2. this.xxx where xxx is a data field → xxx.value
 *   3. this.xxx where xxx is a @State / @Getter → xxx (already a computed)
 *   4. this.xxx where xxx is a @Prop → props.xxx
 *   5. this.xxx where xxx is a @Action → xxx (already a function)
 *   6. this.xxx where xxx is a method → xxx (already a function)
 *   7. this.xxx otherwise → leave as-is (manual review by caller)
 *
 * We use a simple balanced-brace scanner for `this.X(arg1, arg2)` to handle calls
 * correctly (e.g. this.login({x:1}) → login({x:1})).
 */
function replaceThisInBody(body: string, ctx: ThisRewriteContext): string {
  // Walk through body, find `this.X` (not part of longer identifier), replace
  // We use a regex that requires `\bthis\.X\b` — but need to skip string/regex/comment contexts
  // For simplicity, we process the body as a string with a single linear scan,
  // tracking string/regex/comment state.

  const out: string[] = []
  let i = 0
  const len = body.length

  while (i < len) {
    const ch = body[i]
    const next = i + 1 < len ? body[i + 1] : ''

    // Skip string literals
    if (ch === '"' || ch === "'" || ch === '`') {
      out.push(ch)
      i++
      const quote = ch
      while (i < len) {
        const c = body[i]
        if (c === '\\') {
          out.push(c)
          if (i + 1 < len) {
            out.push(body[i + 1])
            i += 2
            continue
          }
          i++
          continue
        }
        if (c === quote) {
          out.push(c)
          i++
          break
        }
        // template literal ${ ... }
        if (quote === '`' && c === '$' && body[i + 1] === '{') {
          out.push('$')
          out.push('{')
          i += 2
          // scan to matching }
          let depth = 1
          while (i < len && depth > 0) {
            const cc = body[i]
            if (cc === '{') depth++
            else if (cc === '}') depth--
            if (depth > 0) {
              out.push(cc)
              i++
            }
          }
          if (i < len) {
            out.push('}')
            i++
          }
          continue
        }
        out.push(c)
        i++
      }
      continue
    }

    // Skip line comments
    if (ch === '/' && next === '/') {
      while (i < len && body[i] !== '\n') {
        out.push(body[i])
        i++
      }
      continue
    }
    // Skip block comments
    if (ch === '/' && next === '*') {
      out.push('/*')
      i += 2
      while (i < len) {
        if (body[i] === '*' && body[i + 1] === '/') {
          out.push('*/')
          i += 2
          break
        }
        out.push(body[i])
        i++
      }
      continue
    }

    // Try to match `this.X` or `this.X(...)`
    if (ch === 't' && body.substring(i, i + 5) === 'this.' && isThisAtBoundary(body, i)) {
      // Read the identifier after `this.`
      let j = i + 5
      const idStart = j
      while (j < len && /[a-zA-Z0-9_$]/.test(body[j])) j++
      if (j === idStart) {
        // no identifier after this. — leave as-is
        out.push('this.')
        i += 5
        continue
      }
      const id = body.substring(idStart, j)
      const replacement = mapThisReplacement(id, ctx)
      if (replacement) {
        out.push(replacement)
        i = j
        continue
      } else {
        // Unknown this.X — leave as-is
        out.push('this.')
        i += 5
        continue
      }
    }

    out.push(ch)
    i++
  }

  return out.join('')
}

/** Check that `this` is at a word boundary (not part of a longer identifier). */
function isThisAtBoundary(body: string, i: number): boolean {
  if (i > 0) {
    const prev = body[i - 1]
    if (/[a-zA-Z0-9_$]/.test(prev)) return false
  }
  return true
}

/**
 * Strip TypeScript type annotations from a function parameter list.
 * E.g. `(newVal: any, oldVal: any)` → `(newVal, oldVal)`
 *      `(x: { foo: string }, y?: number = 0)` → `(x, y = 0)`
 *
 * Why: core's `selfCheck` parser for non-.vue files doesn't have the TS plugin,
 *       so TS annotations would fail the post-generation validation. By stripping
 *       type annotations, the generated setup code is valid plain JS.
 *
 * Limitations: this is a simple state-machine — it handles `: type` and `?: type`
 *              and `= default` but not generic type parameters `<T>` in params
 *              (those are extremely rare in decorator methods).
 */
function stripTypeAnnotations(params: string): string {
  if (!params) return params
  // Remove `: type` annotations — but only after identifiers, not inside `,` or `{` or `<`
  // Simple state machine:
  let result = ''
  let i = 0
  const len = params.length
  while (i < len) {
    const ch = params[i]
    // Handle strings
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      result += ch
      i++
      while (i < len) {
        const c = params[i]
        result += c
        i++
        if (c === '\\' && i < len) {
          result += params[i]
          i++
          continue
        }
        if (c === quote) break
      }
      continue
    }
    // Handle `?` or `:` after an identifier — strip until end of type
    // Pattern: identifier chars (letters, digits, _, $) then optional `?` then `:`
    if (ch === ':') {
      // Skip until , or = or ) at depth 0
      let depth = 0
      i++  // skip the ':'
      while (i < len) {
        const c = params[i]
        if (c === '{' || c === '<' || c === '(' || c === '[') {
          depth++
        } else if (c === '}' || c === '>' || c === ']') {
          depth--
        } else if (c === ')') {
          // closing paren — could be end of params (depth 0) OR nested type (depth > 0)
          if (depth === 0) {
            break  // end of param list reached
          }
          depth--
        }
        // break on top-level terminators (not nested)
        if (depth === 0 && c === ',') break
        if (depth === 0 && c === '=') break
        i++
      }
      continue
    }
    if (ch === '?') {
      // Optional marker like `x?: type`. The `?` is fine to keep (or skip), but the
      // following `: type` will be stripped by the next iteration. Just keep `?` away.
      // We skip the `?` so the param looks normal.
      i++
      continue
    }
    // Default value `= expr` — handle nested parens/braces/brackets
    if (ch === '=') {
      result += ch
      i++
      let depth = 0
      while (i < len) {
        const c = params[i]
        if (c === '{' || c === '(' || c === '[') depth++
        if (c === '}' || c === ')' || c === ']') depth--
        result += c
        i++
        if (depth === 0 && (c === ',' || c === ')')) break
      }
      continue
    }
    // Bracket depth tracking for nested types in generics (rare; skip)
    result += ch
    i++
  }
  return result
}

/** Map `this.X` to its setup form. Returns the replacement string (without `this.`), or null if unknown. */
function mapThisReplacement(id: string, ctx: ThisRewriteContext): string | null {
  // Vue 2 / 3 instance API (well-known)
  switch (id) {
    case '$route': return 'route'
    case '$router': return 'router'
    case '$store': return 'store'  // user can map useStore() result as `store`
    case '$nextTick': return 'nextTick'
    case '$emit': return 'emit'
    case '$refs': return '__refs'  // will need a wrapper — manual review
    case '$attrs': return '$attrs'
    case '$slots': return '$slots'
    case '$el': return '$el'
    case '$forceUpdate': return 'forceUpdate'  // not in setup; manual review
    case '$destroy': return null  // removed
    case '$set': return null
    case '$delete': return null
    case '$watch': return 'watch'  // might work
    case '$on': return null
    case '$off': return null
    case '$once': return null
    case '$children': return null
    case '$parent': return null
    case '$root': return null
    case '$vnode': return null
    case '$isServer': return 'import.meta.env.SSR'
    case '$isDestroyed': return null
    case '$options': return null
    case '$message': return 'ElMessage'
    case '$notify': return 'ElNotification'
    case '$msgbox': return 'ElMessageBox'
    case '$loading': return 'ElLoading.service'
    case '$alert': return 'ElMessageBox.alert'
    case '$confirm': return 'ElMessageBox.confirm'
    case '$prompt': return 'ElMessageBox.prompt'
    case '$scopedSlots': return '$slots'
    case '$listeners': return null  // merged into $attrs in Vue 3
    case '$bus': return null  // removed
  }

  // Class field / data → xxx.value
  if (ctx.fieldNames.has(id)) {
    return `${id}.value`
  }
  // @State / @Getter — already a computed, use directly
  if (ctx.stateNames.has(id) || ctx.getterNames.has(id)) {
    return id
  }
  // @Action — already a function
  if (ctx.actionNames.has(id)) {
    return id
  }
  // @Prop — props.xxx
  if (ctx.propNames.has(id)) {
    return `props.${id}`
  }
  // Method
  if (ctx.methodNames.has(id)) {
    return id
  }

  return null  // unknown — leave as-is
}
