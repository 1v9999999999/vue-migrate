/**
 * Composition plugin: convert Vue 2 Options API to <script setup>.
 *
 * This is a simplified but functional reimplementation of the original
 * options-to-setup.ts (which was corrupted by PowerShell encoding damage).
 *
 * Supports:
 *   - data() -> ref/reactive
 *   - methods -> function declarations
 *   - computed -> computed()
 *   - watch -> watch()
 *   - lifecycle hooks -> onMounted/onCreated/etc
 *   - this.$emit -> emit
 *   - this.$refs (static + dynamic via __refsMap)
 *   - this.$route / $router -> route / router (auto-injected)
 *   - this.$nextTick -> nextTick
 *   - this.$store -> store (Vuex/Pinia compatible)
 *   - this.$message / $notify / $msgbox / $loading -> El* equivalents
 *   - this.$xxx (free variables) -> declared as `let xxx: any`
 */

import _traverse from '@babel/traverse'
import _generate from '@babel/generator'
import * as t from '@babel/types'
import type { FileNode, TransformContext } from '@vue-migrate/core'

const traverse = (_traverse as any).default || _traverse
const generate = (_generate as any).default || _generate

export interface OptionsToSetupResult {
  setupCode: string
  extraImports: string[]
  reviewItems: string[]
  injectedTopSetup: string[]
  refRenames: Map<string, string>
  vuexStateNames: Set<string>
  vuexActionNames: Set<string>
  freeVariables: Set<string>
  dataFieldRenames: Map<string, string>
  changed: boolean
  vueImports: Set<string>
  warnings: string[]
  routeUsed: boolean
  routerUsed: boolean
  storeUsed: boolean
  emitUsed: boolean
  hasProps: boolean
  propsTypeString: string
}

interface DataField {
  name: string
  originalName: string
  kind: 'ref' | 'reactive'
  initStr: string
  typeStr: string
  isShorthandImport: boolean
  isReactiveAssignment: boolean  // 检测 this.x = expr 模式
}

interface MethodDef {
  name: string
  params: string[]
  body: string
  isAsync: boolean
  isLifecycle: boolean
  vueHook: string | null  // '__INLINE__' | 'onMounted' | 'onCreated' | etc
  originalName: string
}

interface ComputedDef {
  name: string
  body: string
  isSetter: boolean
}

interface WatchInfo {
  key: string
  params: string[]
  body: string
  isReactive: boolean
  originalName: string
  hasOptions: boolean
  deep: boolean
  immediate: boolean
}

interface LifecycleDef {
  name: string
  body: string
  vueHook: string
}

interface PropsInfo {
  hasProps: boolean
  typeString: string
  propNames: Set<string>
}

const RESERVED_FIELD_NAMES = new Set(['new', 'class', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while'])

/**
 * 从 generate(body).code 的输出中提取内部语句, 并返回 kind 告诉 caller 该怎么用.
 *
 * 输入是 babel generate 的 BlockStatement (function body) 或 Expression (arrow body) 输出.
 * 输出三种 kind:
 *  - 'block'    : 原本是 `{ ... }`, 内容保留 block 形式 (适用于 () => { return X; } 等)
 *  - 'expr'     : 原本是 expression (箭头函数 expression body), 内容去掉 `return ` 关键字
 *  - 'stmt'     : 单语句 (X;)
 *
 * 这样调用方可以根据 kind 决定是用 `() => ${body}` 还是 `() => { ${body} }`.
 */
function unwrapBlockBody(body: string): { kind: 'block' | 'expr' | 'stmt'; body: string } {
  const trimmed = body.trim()
  // 1. form `{ ... }` -> 'block', content preserved
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // extract outermost `{ }` body
    const inner = trimmed.slice(1, -1)
    return {
      kind: 'block',
      body: inner.replace(/^\n/, '').replace(/\n[ \t]*$/, ''),
    }
  }
  // 2. form `return X;` -> 'expr', strip `return` keyword
  const retMatch = trimmed.match(/^return\s+([\s\S]+?);?$/)
  if (retMatch) {
    return { kind: 'expr', body: retMatch[1].trim().replace(/;$/, '') }
  }
  // 3. 形如 X;  -> 'stmt'
  return { kind: 'stmt', body: trimmed.replace(/^;|;$/g, '') }
}

/**
 * Main entry: convert Options API to Composition API setup code
 */
export function convertOptionsToSetup(
  file: FileNode,
  ctx: TransformContext,
): OptionsToSetupResult {
  const result: OptionsToSetupResult = {
    setupCode: '',
    extraImports: [],
    reviewItems: [],
    injectedTopSetup: [],
    refRenames: new Map(),
    vuexStateNames: new Set(),
    vuexActionNames: new Set(),
    freeVariables: new Set(),
    dataFieldRenames: new Map(),
    changed: false,
    vueImports: new Set(),
    warnings: [],
    routeUsed: false,
    routerUsed: false,
    storeUsed: false,
    emitUsed: false,
    hasProps: false,
    propsTypeString: '{}',
  }

  if (!file.scriptAst)
  return result

  let exportDefault: any = null
  traverse(file.scriptAst, {
    ExportDefaultDeclaration(path: any) {
      exportDefault = path.node.declaration
    },
  })

  if (!exportDefault || !t.isObjectExpression(exportDefault)) {
    // detect Vue.extend({...}) nested component
if (exportDefault && t.isCallExpression(exportDefault) && t.isMemberExpression(exportDefault.callee) && t.isIdentifier(exportDefault.callee.object) && exportDefault.callee.object.name === 'Vue' && t.isIdentifier(exportDefault.callee.property) && exportDefault.callee.property.name === 'extend' &&
        exportDefault.arguments[0] && t.isObjectExpression(exportDefault.arguments[0])) {
      exportDefault = exportDefault.arguments[0]
      result.reviewItems.push(
        'Vue.extend({...}) 在 Vue3 中可保留（仍兼容），但建议改用 defineComponent({...}) 以获得更好的 TS 推断。',
      )
    } else if (exportDefault && t.isCallExpression(exportDefault) && t.isIdentifier(exportDefault.callee) &&
               exportDefault.callee.name === 'defineComponent' &&
               exportDefault.arguments[0] && t.isObjectExpression(exportDefault.arguments[0])) {
      // defineComponent({...}) - Options API form, also supported
      exportDefault = exportDefault.arguments[0]
    } else {
      // Not an Options API component
return result } }

  const obj = exportDefault as any
  const data = parseData(obj, result)
  const methods = parseMethods(obj, result)
  const computeds = parseComputed(obj, result)
  const watches = parseWatch(obj, result)
  const lifecycles = parseLifecycle(obj, result)
  const props = parseProps(obj, result)
  const importNames = collectImportNames(file)
  const refNames = collectTemplateRefNames(file)
  const refsToDeclare = new Set<string>()

  // Resolve data field renames (data/import conflict)
  for (const f of data.fields) {
    if (f.isShorthandImport) continue
    if (importNames.has(f.name)) {
      const oldName = f.name
      f.originalName = oldName
      f.name = `${oldName}Data`
      result.dataFieldRenames.set(oldName, f.name)
      result.reviewItems.push(
        `data field "${oldName}" conflicts with import; renamed to "${f.name}". Update this.${oldName}.xxx to this.${f.name}.xxx.`,
      )
    } else if (RESERVED_FIELD_NAMES.has(f.name)) {
      const oldName = f.name
      f.originalName = oldName
      f.name = `${oldName}Ref`
      result.reviewItems.push(
        `data field "${oldName}" is a reserved word; renamed to "${f.name}".`,
      )
    }
  }

  // Detect Vuex state/action usage
  detectVuexUsage(file, result)

  // Build setup code
const lines: string[] = []
  // injectedTopSetup is appended AFTER all data/refs (avoid TDZ)
const injected: string[] = []

  // 1. Refs from template (for static ref="x" where x is also a data field)
  //    Collect them and rename to avoid conflict
  for (const refName of refNames) {
    if (data.fields.some((f) => f.name === refName) ||
        methods.some((m) => m.name === refName) ||
        computeds.some((c) => c.name === refName)) {
      const newName = `${refName}Ref`
      result.refRenames.set(refName, newName)
      refsToDeclare.add(newName)
      result.reviewItems.push(
        `template ref "${refName}" conflicts with data/method; renamed to "${newName}". Template ref updated.`,
      )
    } else {
      refsToDeclare.add(refName)
    }
  }

  // 2. Inject this.$xxx (router/route/store/emit/nextTick) - pre-scan ALL bodies
  let hasRoute = false, hasRouter = false, hasStore = false, hasNextTick = false, hasEmit = false
  const allBodies = [
    ...methods.map((m) => m.body),
    ...computeds.map((c) => c.body),
    ...watches.map((w) => w.body),
    ...lifecycles.map((l) => l.body),
  ]
  for (const b of allBodies) {
    for (const tok of b.matchAll(/this\.\$([a-zA-Z_]\w*)/g)) {
      const name = tok[1]
      if (name === 'route') hasRoute = true
      else if (name === 'router') hasRouter = true
      else if (name === 'store') hasStore = true
      else if (name === 'nextTick') hasNextTick = true
      else if (name === 'emit') hasEmit = true
    }
  }
  // 2.0.1 simultaneously check whether watch key contains $route / $router / $store (no `this.` prefix)
  //      e.g. `watch: { $route() { ... } }` is Vue2 syntax
  for (const w of watches) {
    if (/\$route\b/.test(w.key)) hasRoute = true
    if (/\$router\b/.test(w.key)) hasRouter = true
    if (/\$store\b/.test(w.key)) hasStore = true
  }
  // 2.0.2 check whether template uses $route / $router / $store (this. prefix case handled in replaceThisInBody)
  //      here we read file.source for full match (template is outside script)
  if (file && file.source) {
    const tplMatch = file.source.match(/<template[^>]*>([\s\S]*?)<\/template>/i)
    const tpl = tplMatch ? tplMatch[1] : ''
    if (/\$route\b/.test(tpl)) hasRoute = true
    if (/\$router\b/.test(tpl)) hasRouter = true
    if (/\$store\b/.test(tpl)) hasStore = true
    if (/\$emit\b/.test(tpl)) hasEmit = true
  }
  if (hasRoute) {
    injected.push('const route = useRoute()')
    if (!result.extraImports.includes("import { useRoute } from 'vue-router'")) {
      result.extraImports.push("import { useRoute } from 'vue-router'")
    }
  }
  if (hasRouter) {
    injected.push('const router = useRouter()')
    if (!result.extraImports.includes("import { useRouter } from 'vue-router'")) {
      result.extraImports.push("import { useRouter } from 'vue-router'")
    }
  }
  if (hasStore) {
    injected.push('const store = useStore()')
    if (!result.extraImports.includes("import { useStore } from 'pinia'")) {
      result.extraImports.push("import { useStore } from 'pinia'")
    }
  }
  if (hasNextTick && !result.extraImports.includes("import { nextTick } from 'vue'")) {
    result.extraImports.push("import { nextTick } from 'vue'")
  }
  if (hasEmit && !result.extraImports.includes("const emit = defineEmits<any>()")) {
    injected.push('const emit = defineEmits<any>()')
  }
  // 2.0.3 sync to result.*Used (for watch key translation, replaceThisInBody and other subsequent steps)
  if (hasRoute) result.routeUsed = true
  if (hasRouter) result.routerUsed = true
  if (hasStore) result.storeUsed = true
  if (hasEmit) result.emitUsed = true
  // 2.5 inject `const props = defineProps<...>()` if props exist
  if (props.hasProps) {
    injected.unshift(`const props = defineProps<${props.typeString}>()`)
  }

  // 3. Data fields
  for (const f of data.fields) {
    if (f.isShorthandImport) {
      // already imported, no const
      continue
    }
    // process this.xxx in initStr (this.getDefaultForm() -> getDefaultForm())
    let initStr = f.initStr
    initStr = initStr.replace(/\bthis\./g, '')
    if (f.kind === 'ref') {
      let init = initStr
      // null/undefined initial value use 'null' (TypeScript ref accepts null)
      if (init === 'undefined' || init === 'null') init = 'null'
      // 如果 typeStr 是 'any | null' 而 init 是 'null', 直接用 ref<any> (更简洁)
      let typeStr = f.typeStr
      if (init === 'null' && typeStr === 'any | null') {
        typeStr = 'any'
      }
      lines.push(`const ${f.name} = ref<${typeStr}>(${init})`)
      result.vueImports.add('ref')
    } else {
      lines.push(`const ${f.name} = reactive<${f.typeStr}>(${initStr})`)
      result.vueImports.add('reactive')
    }
  }
  if (data.fields.length > 0) lines.push('')

  // 4. Template refs
  for (const refName of refsToDeclare) {
    lines.push(`const ${refName} = ref<any>(null)`)
    result.vueImports.add('ref')
  }
  if (refsToDeclare.size > 0) lines.push('')

  // 5. __refsMap for dynamic refs
  const dynamicRefKeys: string[] = []
  for (const m of methods) {
    for (const tok of m.body.matchAll(/this\.\$refs\[\s*([^\]]+?)\s*\]/g)) {
      const key = tok[1].trim()
      if (!dynamicRefKeys.includes(key)) dynamicRefKeys.push(key)
    }
  }
  if (dynamicRefKeys.length > 0) {
    const entries = dynamicRefKeys.map((k) => {
      // Resolve the actual ref name (handle renames)
      const resolved = result.refRenames.get(k) || refsToDeclare.has(k) ? k : k
      return `  ${k}: ${resolved}`
    }).join(',\n')
    lines.push(`const __refsMap: Record<string, any> = {\n${entries}\n}`)
    lines.push('')
    result.reviewItems.push(
      `dynamic this.$refs[name] usage detected (${dynamicRefKeys.join(', ')}). Vue 3 recommends useTemplateRef() + :ref="setRef".`,
    )
  }

  // 6. Computed
  for (const c of computeds) {
    if (c.isSetter) {
      // skip complex setter computeds
      result.reviewItems.push(`computed "${c.name}" has getter+setter; manual review required.`)
      continue
    }
    // computed 形式:
    //   fullName() { return this.firstName + this.lastName }  -> { return this... }   (function body, block)
    //   fullName: (a, b) => a + b                              -> (a, b) => a + b   (arrow expression body)
    //   fullName: get() { return ... }, set(v) { ... }         -> get() {...}, set(v) {...}
    // unwrapBlockBody 返回 kind 告诉我们: 'block' 表示 `() => { ${body} }`, 'expr' 表示 `() => ${body}`
    const u = unwrapBlockBody(c.body)
    const innerBody = replaceThisInBody(
      u.body,
      data, methods, computeds, props, refNames, refsToDeclare, result,
    )
    const exprBody = u.kind === 'block' ? `() => {\n  ${innerBody}\n}` : `() => ${innerBody}`
    lines.push(`const ${c.name} = computed(${exprBody})`)
    result.vueImports.add('computed')
  }
  if (computeds.length > 0) lines.push('')

  // 7. Methods
  for (const m of methods) {
    if (m.isLifecycle) continue  // handled by onMounted etc
    let body = m.body
    // body 已经是 BlockStatement 生成的字符串 (带外层 `{...}`), 提取内部语句
    body = unwrapBlockBody(body).body
    // Replace this.xxx references
    body = replaceThisInBody(body, data, methods, computeds, props, refNames, refsToDeclare, result)
    const params = m.params.length > 0 ? m.params.join(', ') : ''
    const async_ = m.isAsync ? 'async ' : ''
    lines.push(`${async_}function ${m.name}(${params}) {\n  ${body}\n}`)
  }
  if (methods.filter((m) => !m.isLifecycle).length > 0) lines.push('')

  // 8. Watch - 先对 w.body 做 this.xxx 替换 + 智能 key 翻译, 再 emit
  for (const w of watches) {
    // 8.1 先取出 w.body 的内部语句 (去掉外层 { })
    w.body = unwrapBlockBody(w.body).body
    // 8.2 body 内 this.xxx 替换
    w.body = replaceThisInBody(w.body, data, methods, computeds, props, refNames, refsToDeclare, result)

    // 8.3 取出内部 name (去掉 `() => ` 前缀和引号)
    //   w.key 可能是: '() => name', '() => "name"', 'name', "'name'"
    let inner = w.key
      .replace(/^\s*\(\s*\)\s*=>\s*/, '')   // 去 () =>
      .replace(/^\s*['"]|['"]\s*$/g, '')     // 去 引号
      .trim()
    // 智能加 .value / props. 前缀
    const rootName = inner.split('.')[0].split('[')[0]
    if (props.propNames.has(rootName)) {
      inner = `props.${inner}`
    } else {
      const f = data.fields.find((x) => x.name === rootName)
      if (f) {
        if (f.kind === 'ref') {
          if (inner === rootName) {
            inner = `${inner}.value`
          } else {
            inner = `(() => ${inner}) /* was ref path */`
          }
        }
        // reactive 字段, 路径访问即可
      } else if (methods.some((m) => m.name === rootName)) {
        inner = `${rootName}()`
      } else if (computeds.some((c) => c.name === rootName)) {
        inner = `${rootName}.value`
      }
    }
    // 8.4 翻译 $route/$router/$store/$emit 为 setup 注入的别名
if (inner === '$route' && result.routeUsed) inner = 'route'
    else if (inner === '$router' && result.routerUsed) inner = 'router'
    else if (inner === '$store' && result.storeUsed) inner = 'store'

    // Vue3 watch 必须用 getter 形式: watch(() => xxx, ...)
    const watchKey = `() => ${inner}`
    // 检查是否带 deep/immediate 选项 (object watch form)
    let watchOpts = ''
    if (w.hasOptions) {
      const opts: string[] = []
      if (w.deep) opts.push('deep: true')
      if (w.immediate) opts.push('immediate: true')
      if (opts.length) watchOpts = `, { ${opts.join(', ')} }`
    }
    lines.push(`watch(${watchKey}, (${w.params.join(', ')}) => {\n  ${w.body}\n}${watchOpts})`)
    result.vueImports.add('watch')
  }
  if (watches.length > 0) lines.push('')

  // 9. Lifecycle hooks - 同样先 unwrap block + replace this
  for (const lc of lifecycles) {
    let body = lc.body
    body = unwrapBlockBody(body).body
    body = replaceThisInBody(body, data, methods, computeds, props, refNames, refsToDeclare, result)
    if (lc.vueHook === '__INLINE__') {
      // Inline at top of setup
      injected.push(`// --- ${lc.name}() inline ---`)
      injected.push(body)
    } else {
      lines.push(`${lc.vueHook}(() => {\n  ${body}\n})`)
    }
  }

  // 10. injectedTopSetup (route/router/store/emit) - placed after data
  if (injected.length > 0) {
    lines.push(...injected)
  }
  // (供 index.ts 的 buildNewScript 使用)
  result.injectedTopSetup = [...injected]

  // 11. Free variables (declared as `any` in setup scope - caller must declare)
  if (result.freeVariables.size > 0) {
    for (const v of result.freeVariables) {
      // 安全 fallback: 加显式 let, 但同时在 reviewItems 提示用户
      // 智能推断: 如果变量名是 chart/myChart/instance 这种 ECharts/3rd party 模式, 改用 ref<any>
      const isChartLike = /chart|myChart|chartInstance|editor|monaco/i.test(v)
      if (isChartLike) {
        // ECharts / 3rd-party instance pattern: use ref<any>
        lines.push(`const ${v} = ref<any>(null)`)
        result.vueImports.add('ref')
        result.reviewItems.push(
          `自由变量 \`${v}\` 看起来是 ECharts/3rd-party instance pattern, 已在 setup 顶层声明为 \`const ${v} = ref<any>(null)\` (配合 :ref="set${v.charAt(0).toUpperCase() + v.slice(1)}" 初始化).`,
        )
      } else {
        lines.push(`let ${v}: any`)
        result.reviewItems.push(
          `自由变量 \`${v}\` 在 setup 里声明为 \`let ${v}: any\`, 但未初始化。Vue3 需在 setup() 里显式赋值。`,
        )
      }
    }
  }

  result.setupCode = lines.join('\n')
  result.changed = true  // iter-023: enable with safe free-var fallback

  return result
}

function parseData(obj: any, result: OptionsToSetupResult): { fields: DataField[] } {
  const fields: DataField[] = []
  const dataProp = obj.properties.find((p: any) =>
    (t.isObjectProperty(p) || t.isObjectMethod(p)) && t.isIdentifier(p.key) && p.key.name === 'data'
  )
  if (!dataProp) return { fields }

  // 三种 data 形式:
  //   1. data() { return {...} }          -> ObjectMethod
  //   2. data: function() { return {...} }  -> ObjectProperty + FunctionExpression
  //   3. data: () => ({...})                -> ObjectProperty + ArrowFunctionExpression
  //   4. data: () => ({...}) (对象字面量)  -> ObjectProperty + ArrowFunctionExpression 直接返回
  let returnObj: any = null
  let fn: any = null
  if (t.isObjectMethod(dataProp)) {
    fn = dataProp
  } else if (t.isObjectProperty(dataProp)) {
    if (t.isFunction(dataProp.value)) {
      fn = dataProp.value
    } else if (t.isObjectExpression(dataProp.value)) {
      returnObj = dataProp.value
    }
  }
  if (fn) {
    const body = fn.body
    if (t.isBlockStatement(body)) {
      const ret = body.body.find((n: any) => t.isReturnStatement(n))
      if (ret && t.isObjectExpression(ret.argument)) {
        returnObj = ret.argument
      }
    } else if (t.isObjectExpression(body)) {
      // 隐式返回: () => ({...})
      returnObj = body
    }
  }
  if (!returnObj) return { fields }

  for (const prop of returnObj.properties) {
    if (!t.isObjectProperty(prop)) continue
    if (!t.isIdentifier(prop.key) && !t.isStringLiteral(prop.key)) continue
    const name = t.isIdentifier(prop.key) ? prop.key.name : (prop.key as any).value
    const initStr = generate(prop.value).code
    const trimmedInit = initStr.trim()
    // Heuristic: 只有对象/数组字面量用 reactive, 其它 (null/undefined/标量) 用 ref
    let isObjectLike = (trimmedInit.startsWith('{') && trimmedInit.endsWith('}')) ||
                        (trimmedInit.startsWith('[') && trimmedInit.endsWith(']'))
    // 函数调用初始化 (如 form: this.getDefaultForm()) 通常返回对象
    // 启发式: 调用的函数名包含 "Form"/"Init"/"Default"/"Create"/"Make"/"New"/"Object" 时也归为 reactive
    if (!isObjectLike && t.isCallExpression(prop.value)) {
      const callee = prop.value.callee
      let calleeName = ''
      if (t.isIdentifier(callee)) calleeName = callee.name
      else if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) calleeName = callee.property.name
      if (/Form|Init|Default|Create|Make|New|Object/i.test(calleeName)) {
        isObjectLike = true
      }
    }
    // 推断更精确的 TypeScript 类型
    let typeStr = 'unknown'
    if (t.isBooleanLiteral(prop.value)) typeStr = 'boolean'
    else if (t.isStringLiteral(prop.value)) typeStr = 'string'
    else if (t.isNumericLiteral(prop.value)) typeStr = 'number'
    else if (t.isNullLiteral(prop.value)) typeStr = 'any | null'
    else if (t.isArrayExpression(prop.value)) typeStr = 'any[]'
    else if (t.isObjectExpression(prop.value)) typeStr = 'Record<string, any>'
    else if (t.isNewExpression(prop.value) && t.isIdentifier(prop.value.callee) && prop.value.callee.name === 'Date') typeStr = 'Date'
    else if (t.isRegExpLiteral(prop.value)) typeStr = 'RegExp'
    else if (isObjectLike) typeStr = 'Record<string, any>'
    fields.push({
      name,
      originalName: name,
      kind: isObjectLike ? 'reactive' : 'ref',
      initStr,
      typeStr,
      isShorthandImport: false,
      isReactiveAssignment: false,
    })
  }

  return { fields }
}

function parseMethods(obj: any, result: OptionsToSetupResult): MethodDef[] {
  const methods: MethodDef[] = []
  const methodsProp = obj.properties.find((p: any) =>
    t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'methods'
  )
  if (!methodsProp || !t.isObjectExpression(methodsProp.value))
  return methods

  for (const prop of methodsProp.value.properties) {
    if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue
    const key = t.isIdentifier(prop.key) ? prop.key.name : (prop.key as any).value
    let value = (prop as any).value
    let isAsync = false
    let params: any[] = []
    let body: any = null

    if (t.isObjectMethod(prop)) {
      // method shorthand: foo()
{}
      isAsync = prop.async
      params = prop.params
      body = prop.body
    } else if (t.isFunction(value)) {
      // foo: function() {} or foo: () => {}
      isAsync = !!value.async
      params = value.params
      body = value.body
    } else {
      continue
    }

    const bodyCode = t.isBlockStatement(body) ? generate(body).code : `return ${generate(body).code}`

    methods.push({
      name: key,
      originalName: key,
      params: params.map((p: any) => t.isIdentifier(p) ? p.name : generate(p).code),
      body: bodyCode,
      isAsync,
      isLifecycle: false,
      vueHook: null,
    })
  }

  return methods
}

function parseComputed(obj: any, _result: OptionsToSetupResult): ComputedDef[] {
  const computeds: ComputedDef[] = []
  const computedProp = obj.properties.find((p: any) =>
    t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'computed'
  )
  if (!computedProp || !t.isObjectExpression(computedProp.value))
  return computeds

  for (const prop of computedProp.value.properties) {
    if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue
    const key = t.isIdentifier(prop.key) ? prop.key.name : (prop.key as any).value
    let value = (prop as any).value

    if (t.isObjectMethod(prop) || t.isFunction(value)) {
      // Computed as method shorthand or function expression
      const isSetter = t.isObjectMethod(prop) && prop.kind === 'set'  // not standard
      const body = t.isObjectMethod(prop) ? prop.body : (value as any).body
      const bodyCode = t.isBlockStatement(body) ? generate(body).code : `return ${generate(body).code}`
      computeds.push({ name: key, body: bodyCode, isSetter: false })
    } else if (t.isObjectExpression(value)) {
      // { get() {...}, set(v) {...} }
      // 注: get/set 是方法简写, 在 AST 里是 ObjectMethod, 不是 ObjectProperty
const getProp = value.properties.find((p: any) =>
        (t.isObjectProperty(p) || t.isObjectMethod(p)) &&
        t.isIdentifier(p.key) && p.key.name === 'get'
      )
      if (getProp) {
        // get 的 body 来源不同: ObjectMethod.body (直接) vs ObjectProperty.value.body (函数体)
        const getBody = t.isObjectMethod(getProp)
          ? getProp.body
          : (getProp as any).value.body
        const bodyCode = t.isBlockStatement(getBody) ? generate(getBody).code : `return ${generate(getBody).code}`
        computeds.push({ name: key, body: bodyCode, isSetter: true })
      }
    }
  }

  return computeds
}

function parseWatch(obj: any, _result: OptionsToSetupResult): WatchInfo[] {
  const watches: WatchInfo[] = []
  const watchProp = obj.properties.find((p: any) =>
    t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === 'watch'
  )
  if (!watchProp || !t.isObjectExpression(watchProp.value))
  return watches

  for (const prop of watchProp.value.properties) {
    if (!t.isObjectProperty(prop) && !t.isObjectMethod(prop)) continue
    const key = t.isIdentifier(prop.key) ? prop.key.name : (prop.key as any).value
    const isReactive = !t.isStringLiteral(prop.key) && !t.isNumericLiteral(prop.key)

    // 三种 watch 形式:
    //   1. title(newVal, oldVal) {...}                       -> ObjectMethod
    //   2. title: function(newVal, oldVal) {...}             -> ObjectProperty + Function
    //   3. items: { handler(newVal) {...}, deep: true }      -> ObjectProperty + ObjectExpression
    let body: any = null
    let params: any[] = []
    let hasOptions = false
    let deep = false
    let immediate = false

    if (t.isObjectMethod(prop)) {
      body = prop.body
      params = prop.params
    } else if (t.isObjectProperty(prop)) {
      const value = prop.value
      if (t.isFunction(value)) {
        body = value.body
        params = value.params
      } else if (t.isObjectExpression(value)) {
        // items: { handler(newVal) {...}, deep: true }
        hasOptions = true
        const handlerProp = value.properties.find((q: any) =>
          (t.isObjectProperty(q) || t.isObjectMethod(q)) && t.isIdentifier(q.key) && q.key.name === 'handler'
        )
        if (handlerProp) {
          if (t.isObjectMethod(handlerProp)) {
            body = handlerProp.body
            params = handlerProp.params
          } else if (t.isFunction((handlerProp as any).value)) {
            body = (handlerProp as any).value.body
            params = (handlerProp as any).value.params
          }
        }
        // 提取 deep/immediate
        for (const opt of value.properties) {
          if (!t.isObjectProperty(opt)) continue
          const optKey = t.isIdentifier(opt.key) ? opt.key.name : null
          if (optKey === 'deep' && t.isBooleanLiteral(opt.value) && opt.value.value === true) deep = true
          if (optKey === 'immediate' && t.isBooleanLiteral(opt.value) && opt.value.value === true) immediate = true
        }
      }
    }
    if (!body) continue
    const bodyCode = t.isBlockStatement(body) ? generate(body).code : ''
    watches.push({
      key: isReactive ? `() => ${key}` : key,
      params: params.length > 0 ? params.map((p: any) => t.isIdentifier(p) ? p.name : 'val') : ['newVal', 'oldVal'],
      body: bodyCode,
      isReactive,
      originalName: key,
      hasOptions,
      deep,
      immediate,
    })
  }

  return watches
}

function parseLifecycle(obj: any, _result: OptionsToSetupResult): LifecycleDef[] {
  const lifecycles: LifecycleDef[] = []
  const hookMap: Record<string, string> = {
    // Vue 2 专用 -> Vue 3 对应
    beforeCreate: '__INLINE__',  // Vue 3 没有, 提到 setup 顶部
    created: '__INLINE__',      // Vue 3 没有, 提到 setup 顶部
    beforeMount: 'onBeforeMount',
    mounted: 'onMounted',
    beforeUpdate: 'onBeforeUpdate',
    updated: 'onUpdated',
    activated: 'onActivated',
    deactivated: 'onDeactivated',
    beforeDestroy: 'onBeforeUnmount',
    beforeUnmount: 'onBeforeUnmount',
    destroyed: 'onUnmounted',
    unmounted: 'onUnmounted',
    // Vue 2.5+ 新增
    errorCaptured: 'onErrorCaptured',
    // Vue 2.6+ 新增
    renderTracked: 'onRenderTracked',
    renderTriggered: 'onRenderTriggered',
    // Vue 3 / SSR 新增
    serverPrefetch: 'onServerPrefetch',
  }

  for (const prop of obj.properties) {
    if (!t.isObjectMethod(prop) && !t.isObjectProperty(prop)) continue
    const key = t.isIdentifier(prop.key) ? prop.key.name : null
    if (!key || !hookMap[key]) continue
    const vueHook = hookMap[key]
    const value = (prop as any).value
    const body = t.isObjectMethod(prop) ? prop.body : (t.isFunction(value) ? value.body : null)
    if (!body) continue
    const bodyCode = t.isBlockStatement(body) ? generate(body).code : ''
    lifecycles.push({ name: key, body: bodyCode, vueHook })
  }

  return lifecycles
}

function parseProps(obj: any, result: OptionsToSetupResult): PropsInfo {
  // Parse props option to determine prop names + generate defineProps type
  const propNames = new Set<string>()
  const propTypes: string[] = []
  const propsProp = obj.properties.find((p: any) =>
    (t.isObjectProperty(p) || t.isObjectMethod(p)) && t.isIdentifier(p.key) && p.key.name === 'props'
  )
  if (!propsProp) {
    return { hasProps: false, typeString: '{}', propNames }
  }

  let propsList: any[] = []
  if (t.isObjectMethod(propsProp)) {
    // props: { title: String, ... }  (ObjectMethod with this.props? No, props is just an ObjectExpression)
    return { hasProps: false, typeString: '{}', propNames }
  } else if (t.isArrayExpression(propsProp.value)) {
    // props: ['title', 'count']
    for (const el of propsProp.value.elements) {
      if (t.isStringLiteral(el)) {
        propNames.add(el.value)
        propTypes.push(`${el.value}?: any`)
      }
    }
  } else if (t.isObjectExpression(propsProp.value)) {
    // props: { title: String, count: { type: Number, default: 0 }, ... }
    for (const p of propsProp.value.properties) {
      if (!t.isObjectProperty(p)) continue
      const key = t.isIdentifier(p.key) ? p.key.name : (t.isStringLiteral(p.key) ? p.key.value : null)
      if (!key) continue
      propNames.add(key)
      const val = p.value
      let tsType = 'any'
      if (t.isIdentifier(val)) {
        const map: Record<string, string> = {
          String: 'string', Number: 'number', Boolean: 'boolean',
          Array: 'any[]', Object: 'Record<string, any>', Function: '(...args: any[]) => any',
          Date: 'Date', Symbol: 'symbol',
        }
        tsType = map[val.name] || 'any'
      } else if (t.isArrayExpression(val)) {
        tsType = 'any[]'
      } else if (t.isObjectExpression(val)) {
        const typeProp = val.properties.find((q: any) => t.isObjectProperty(q) && t.isIdentifier(q.key) && q.key.name === 'type')
        if (typeProp && t.isObjectProperty(typeProp)) {
          const typePropValue: any = (typeProp as any).value
          if (t.isIdentifier(typePropValue)) {
            const map: Record<string, string> = {
              String: 'string', Number: 'number', Boolean: 'boolean',
              Array: 'any[]', Object: 'Record<string, any>',
            }
            tsType = map[typePropValue.name] || 'any'
          } else if (t.isArrayExpression(typePropValue)) {
            tsType = 'any[]'
          }
        }
      }
      const requiredProp = (val as any).properties?.find?.((q: any) => t.isObjectProperty(q) && t.isIdentifier(q.key) && q.key.name === 'required' && (q.value as any).value === true)
      propTypes.push(`${key}${requiredProp ? '' : '?'}: ${tsType}`)
    }
  }
  if (propNames.size > 0) {
    result.reviewItems.push(
      `检测到 ${propNames.size} 个 props，已自动生成 defineProps<{...}>(). 模板/computed/methods 中 this.xxx (xxx 是 prop) 已替换为 props.xxx.`,
    )
  }
  const typeString = `{ ${propTypes.join('; ')} }`
  result.hasProps = propNames.size > 0
  result.propsTypeString = typeString
  return {
    hasProps: propNames.size > 0,
    typeString,
    propNames,
  }
}

function collectImportNames(file: FileNode): Set<string> {
  const names = new Set<string>()
  if (!file.scriptAst)
  return names
  traverse(file.scriptAst, {
    ImportDeclaration(path: any) {
      for (const spec of path.node.specifiers) {
        if (t.isImportSpecifier(spec) || t.isImportDefaultSpecifier(spec) || t.isImportNamespaceSpecifier(spec)) {
          names.add(spec.local.name)
        }
      }
    },
  })
  return names
}

function collectTemplateRefNames(file: FileNode): Set<string> {
  const names = new Set<string>()
  // Look for ref="xxx" in template
  const template = (file as any).templateAst
  if (!template) return names
  try {
    traverse(template, {
      JSXAttribute(path: any) {
        if (t.isJSXIdentifier(path.node.name) && path.node.name.name === 'ref') {
          const v = path.node.value
          if (v && t.isStringLiteral(v)) {
            names.add(v.value)
          }
        }
      },
    })
  } catch {}
  return names
}

function detectVuexUsage(_file: FileNode, _result: OptionsToSetupResult) {
  // Simplified: leave as-is
  void _file
  void _result
}

function replaceThisInBody(
  body: string,
  data: { fields: DataField[] },
  methods: MethodDef[],
  computeds: ComputedDef[],
  props: PropsInfo,
  refNames: Set<string>,
  refsToDeclare: Set<string>,
  result: OptionsToSetupResult,
): string {
  let s = body

  // 0. 预先标记已替换的占位符, 避免后面 free variables 误抓
  //    this.$watch('xxx', fn[, opts]) -> watch(() => xxx, fn[, opts]) (...) 调用
  s = expandThisDollarWatch(s, data, props, result)

  // 1. this.$refs.xxx (static) -> xxxRef.value
  s = s.replace(/this\.\$refs\.([\w$]+)/g, (_m, name) => {
    const renamed = result.refRenames.get(name) || (refsToDeclare.has(name) ? name : name)
    return `${renamed}.value`
  })

  // 2. this.$refs[xxx] (dynamic) -> (__refsMap[xxx] as any)?.value
  s = s.replace(/this\.\$refs\[\s*([^\]]+?)\s*\]/g, '(__refsMap[$1] as any)?.value')

  // 3. this.$emit -> emit
  s = s.replace(/\bthis\.\$emit\b/g, 'emit')

  // 4. this.$route -> route
  s = s.replace(/\bthis\.\$route\b/g, 'route')

  // 5. this.$router -> router
  s = s.replace(/\bthis\.\$router\b/g, 'router')

  // 6. this.$nextTick -> nextTick
  s = s.replace(/\bthis\.\$nextTick\b/g, 'nextTick')

  // 7. this.$store -> store
  s = s.replace(/\bthis\.\$store\b/g, 'store')

  // 8. this.$message -> ElMessage (add review note)
  if (/\bthis\.\$message\b/.test(s)) {
    if (!result.extraImports.includes("import { ElMessage } from 'element-plus'")) {
      result.extraImports.push("import { ElMessage } from 'element-plus'")
    }
    s = s.replace(/\bthis\.\$message\b/g, 'ElMessage')
  }

  // 9. this.$notify -> ElNotification (add review note)
  if (/\bthis\.\$notify\b/.test(s)) {
    if (!result.extraImports.includes("import { ElNotification } from 'element-plus'")) {
      result.extraImports.push("import { ElNotification } from 'element-plus'")
    }
    s = s.replace(/\bthis\.\$notify\b/g, 'ElNotification')
    result.reviewItems.push(
      'this.$notify.xxx() in Element Plus has no .xxx() chain; auto-converted by elementui plugin.',
    )
  }

  // 10. this.$msgbox/$alert/$confirm/$prompt -> ElMessageBox
  if (/\bthis\.\$(msgbox|alert|confirm|prompt)\b/.test(s)) {
    if (!result.extraImports.includes("import { ElMessageBox } from 'element-plus'")) {
      result.extraImports.push("import { ElMessageBox } from 'element-plus'")
    }
    s = s.replace(/\bthis\.\$msgbox\b/g, 'ElMessageBox')
    s = s.replace(/\bthis\.\$alert\b/g, 'ElMessageBox.alert')
    s = s.replace(/\bthis\.\$confirm\b/g, 'ElMessageBox.confirm')
    s = s.replace(/\bthis\.\$prompt\b/g, 'ElMessageBox.prompt')
  }

  // 11. this.$loading -> ElLoading.service
  if (/\bthis\.\$loading\b/.test(s)) {
    if (!result.extraImports.includes("import { ElLoading } from 'element-plus'")) {
      result.extraImports.push("import { ElLoading } from 'element-plus'")
    }
    s = s.replace(/\bthis\.\$loading\b/g, 'ElLoading.service')
  }

  // 11.5 this.$bus / $on / $off / $once (Vue2 事件总线, Vue3 已移除)
  if (/\bthis\.\$bus\b/.test(s) || /\bthis\.\$(on|off|once)\b/.test(s)) {
    s = s.replace(/\bthis\.\$bus\b/g, '/* $bus removed: use mitt or external event bus */undefined')
    s = s.replace(/\bthis\.\$on\b\s*\(/g, '/* $on removed: use mitt */mitt.on(')
    s = s.replace(/\bthis\.\$off\b\s*\(/g, '/* $off removed: use mitt */mitt.off(')
    s = s.replace(/\bthis\.\$once\b\s*\(/g, '/* $once removed: use mitt */mitt.once(')
    result.reviewItems.push(
      'this.$bus / $on / $off / $once 在 Vue3 中已移除。建议用 mitt 库 (https://github.com/developit/mitt) 替代。',
    )
  }

  // 11.6 this.$el / $forceUpdate / $destroy / $set / $delete (Vue2 实例方法, Vue3 已移除或改变)
  if (/\bthis\.\$(el|forceUpdate|destroy|set|delete)\b/.test(s)) {
    if (/\bthis\.\$el\b/.test(s)) {
      s = s.replace(/\bthis\.\$el\b/g, '/* $el: use template ref + .$el */undefined')
      result.reviewItems.push('this.$el 在 Vue3 中需用模板 ref 替代: const el = myRef.value?.$el')
    }
    if (/\bthis\.\$forceUpdate\b/.test(s)) {
      s = s.replace(/\bthis\.\$forceUpdate\b\s*\(\s*\)/g, '/* $forceUpdate removed */triggerRef() /* 请选择要 trigger 的 ref */')
      result.reviewItems.push('this.$forceUpdate 已移除, Vue3 改用 ref/reactive 触发响应式')
    }
    if (/\bthis\.\$destroy\b/.test(s)) {
      s = s.replace(/\bthis\.\$destroy\b\s*\(\s*\)/g, '/* $destroy removed */app.unmount() /* 如果有 app 引用 */')
      result.reviewItems.push('this.$destroy 已移除, Vue3 在 app 级别用 app.unmount()')
    }
    if (/\bthis\.\$set\b/.test(s)) {
      s = s.replace(/\bthis\.\$set\b\s*\(\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '/* $set removed */($1)[$2] = $3 /* 配合 triggerRef */')
      result.reviewItems.push('this.$set 已移除, Vue3 直接赋值即可触发响应式: obj[key] = value')
    }
    if (/\bthis\.\$delete\b/.test(s)) {
      s = s.replace(/\bthis\.\$delete\b\s*\(\s*([^,]+),\s*([^)]+)\)/g, '/* $delete removed */delete ($1)[$2]')
      result.reviewItems.push('this.$delete 已移除, Vue3 直接 delete 即可')
    }
  }

  // 12. this.xxx (data field) -> name.value (if ref) or name (if reactive)
  //     但 reactive 字段重赋值要在这一步之前处理 (12.5 提前), 否则 this.x 被替换为 x 后正则匹配不到
  // 12.5 reactive field reassignment:
  //     this.items = expr  ->  items.splice(0, items.length, ...expr)
  //     支持 multi-line object/array literal (用平衡大括号扫描)
  for (const f of data.fields) {
    if (f.kind !== 'reactive') continue
    const re = new RegExp(`(\\bthis\\.${f.name})\\s*=\\s*`, 'g')
    let m: RegExpExecArray | null
    const replacements: Array<{ start: number; end: number; replacement: string; expr: string }> = []
    while ((m = re.exec(s)) !== null) {
      const exprStart = m.index + m[0].length
      // 检查 expr 是不是 { 或 [ 开头
      let i = exprStart
      while (i < s.length && /\s/.test(s[i])) i++
      if (i >= s.length) continue
      const openChar = s[i]
      let closeChar: string | null = null
      if (openChar === '{') closeChar = '}'
      else if (openChar === '[') closeChar = ']'
      else {
        // 不是对象/数组字面量, 用 ; 或换行作结束符
        // 不是对象/数组字面量, 但可能是 await/return/xxx.fun() 形式 (避免多行调用被换行截断)
        let j = i
        let parenDepth = 0
        let braceDepth = 0
        let bracketDepth = 0
        let inStr: string | null = null
        while (j < s.length) {
          const c = s[j]
          if (inStr) {
            if (c === '\\') { j += 2; continue }
            if (c === inStr) inStr = null
            j++; continue
          }
          if (c === "'" || c === '"' || c === '`') { inStr = c; j++; continue }
          if (c === '/' && s[j + 1] === '/') {
            const eol = s.indexOf('\n', j)
            j = eol < 0 ? s.length : eol
            continue
          }
          if (c === '/' && s[j + 1] === '*') {
            const end = s.indexOf('*/', j + 2)
            j = end < 0 ? s.length : end + 2
            continue
          }
          if (c === '(') parenDepth++
          else if (c === ')') parenDepth--
          else if (c === '{') braceDepth++
          else if (c === '}') braceDepth--
          else if (c === '[') bracketDepth++
          else if (c === ']') bracketDepth--
          if (parenDepth === 0 && braceDepth === 0 && bracketDepth === 0 && c === ';') break
          j++
        }
        const expr = s.slice(i, j)
        // 重要: 如果 expr 含 || / && / ?? / ?: 等运算符, 必须包一层 ()
        //       否则 spread 会被错误地只作用于左侧表达式
        //       例: this.x = data.records || []  ->  x.splice(0, x.length, ...data.records || [])
        //       应改为 x.splice(0, x.length, ...(data.records || []))
        const needsParens = /[&|?][&|?]?|\?[^:]/.test(expr)
        const wrappedExpr = needsParens ? `(${expr})` : expr
        replacements.push({
          start: m.index,
          end: j,
          replacement: `${f.name}.splice(0, ${f.name}.length, ...${wrappedExpr})`,
          expr,
        })
        re.lastIndex = j
        continue
      }
      let depth = 1
      let k = i + 1
      let inStr: string | null = null
      while (k < s.length && depth > 0) {
        const c = s[k]
        if (inStr) {
          if (c === '\\') { k += 2; continue }
          if (c === inStr) inStr = null
          k++; continue
        }
        if (c === "'" || c === '"' || c === '`') { inStr = c; k++; continue }
        if (c === '/' && s[k + 1] === '/') {
          const eol = s.indexOf('\n', k)
          k = eol < 0 ? s.length : eol
          continue
        }
        if (c === '/' && s[k + 1] === '*') {
          const end = s.indexOf('*/', k + 2)
          k = end < 0 ? s.length : end + 2
          continue
        }
        if (c === openChar) depth++
        else if (c === closeChar) {
          depth--
          if (depth === 0) break
        }
        k++
      }
      if (depth !== 0) continue
      const expr = s.slice(i, k + 1)
      // expr 应该包含 { ... } 或 [ ... ]
      replacements.push({
        start: m.index,
        end: k + 1,
        replacement: `${f.name}.splice(0, ${f.name}.length, ...${expr})`,
        expr,
      })
      re.lastIndex = k + 1
    }
    // 倒序应用 replacement (避免 index 错位)
    for (let r = replacements.length - 1; r >= 0; r--) {
      const { start, end, replacement, expr } = replacements[r]
      s = s.slice(0, start) + replacement + s.slice(end)
      result.reviewItems.push(
        `reactive field "${f.name}" reassigned via "this.${f.name} = ${expr.substring(0, 50)}${expr.length > 50 ? '...' : ''}". Vue 3 reactive 不能整体重新赋值, 已转 splice(0, ${f.name}.length, ...).`,
      )
    }
  }

  for (const f of data.fields) {
    const re = new RegExp(`\\bthis\\.${f.name}\\b`, 'g')
    if (f.kind === 'ref') {
      s = s.replace(re, `${f.name}.value`)
    } else {
      s = s.replace(re, f.name)
    }
  }

  // 13. this.xxx (method/computed) -> xxx
  for (const m of methods) {
    if (m.isLifecycle) continue
    const re = new RegExp(`\\bthis\\.${m.name}\\b`, 'g')
    s = s.replace(re, m.name)
  }
  for (const c of computeds) {
    const re = new RegExp(`\\bthis\\.${c.name}\\b`, 'g')
    s = s.replace(re, c.name)
  }

  // 13.5 this.xxx (prop) -> props.xxx
  for (const pname of props.propNames) {
    const re = new RegExp(`\\bthis\\.${pname}\\b`, 'g')
    s = s.replace(re, `props.${pname}`)
  }

  // 14. Free this.xxx (unknown) -> declare as free variable
  //    先处理 Vue2 特殊属性 (this.$route, $router, $store, $emit, $nextTick, $refs, $children, $slots)
  //    它们会注入对应的 const 引用, 不要 fall through 到 free variables
  //    this.$refs.xxx  -> xxxRef.value
  s = s.replace(/\bthis\.\$refs\.([a-zA-Z_]\w*)\b/g, (_m, name) => {
    const refName = `${name}Ref`
    refsToDeclare.add(refName)
    return `${refName}.value`
  })
  //    this.$refs (无 .xxx) -> 警告 + 原样保留
  //
  //    (这种情况很少, Vue2 里 this.$refs 是 ref map)
  //    this.$route.xxx  -> route.xxx (需要 const route = useRoute() 注入)
  for (const m of s.matchAll(/\bthis\.(\$route|\$router|\$store|\$emit|\$nextTick|\$children|\$slots|\$scopedSlots|\$attrs|\$listeners)\b/g)) {
    const name = m[1]
    const cleanName = name.startsWith('$') ? name.slice(1) : name
    if (cleanName === 'scopedSlots') {
      s = s.replace(new RegExp(`\\bthis\\.\\$scopedSlots\\b`, 'g'), '$slots')  // $scopedSlots → $slots
    } else if (cleanName === 'listeners') {
      s = s.replace(new RegExp(`\\bthis\\.\\$listeners\\b`, 'g'), '$attrs')  // $listeners → $attrs
    } else {
      // 标记 inject
    if (cleanName === 'route') result.routeUsed = true
    else if (cleanName === 'router') result.routerUsed = true
    else if (cleanName === 'store') result.storeUsed = true
    else if (cleanName === 'emit') result.emitUsed = true
    else if (cleanName === 'nextTick') {
      // nextTick 用法保留为函数调用, 不需要 inject const
      s = s.replace(new RegExp(`\\bthis\\.\\$nextTick\\b`, 'g'), 'nextTick')
        result.vueImports.add('nextTick')
        continue
      } else if (cleanName === 'children') {
        // $children 移除, Vue3 用模板 ref 替代
        s = s.replace(new RegExp(`\\bthis\\.\\$children\\b`, 'g'), '/* $children removed: use template ref */undefined')
        continue
      } else if (cleanName === 'slots') {
        s = s.replace(new RegExp(`\\bthis\\.\\$slots\\b`, 'g'), '$slots')  // $slots 保留
        continue
      } else if (cleanName === 'attrs') {
        s = s.replace(new RegExp(`\\bthis\\.\\$attrs\\b`, 'g'), '$attrs')  // $attrs 保留
        continue
      }
      s = s.replace(new RegExp(`\\bthis\\.\\$` + cleanName + `\\b`, 'g'), cleanName)
    }
  }
  // 跳过已经替换的 this.$xxx - 避免被 free variables catch
  for (const m of s.matchAll(/\bthis\.([a-zA-Z_]\w*)\b/g)) {
    const name = m[1]
    // 跳过 $ 开头 (已处理过)
    if (name === '$' || name.startsWith('$')) continue
    // 跳过 prop (已处理)
    if (props.propNames.has(name)) continue
    // 跳过 prop
    if (data.fields.some((f) => f.name === name || f.originalName === name)) continue
    if (methods.some((m) => m.name === name)) continue
    if (computeds.some((c) => c.name === name)) continue
    if (refNames.has(name)) continue
    if (result.vuexStateNames.has(name) || result.vuexActionNames.has(name)) continue
    result.freeVariables.add(name)
  }
  // Replace free variables
  for (const v of result.freeVariables) {
    s = s.replace(new RegExp(`\\bthis\\.${v}\\b`, 'g'), v)
  }

  // (...) 整体替换为 watch(...)
  //    这里不需要再处理 __WATCH_STRING__ 占位符

  return s
}

/**
 * 把 this.$watch('key', fn[, opts]) 替换成 watch(() => key, fn[, opts])
 * 用平衡括号扫描定位整个调用范围
 */
function expandThisDollarWatch(
  s: string,
  data: { fields: DataField[] },
  props: PropsInfo,
  result: OptionsToSetupResult,
): string {
  const needle = 'this.$watch'
  let out = ''
  let last = 0
  let searchFrom = 0
  while (searchFrom < s.length) {
    const idx = s.indexOf(needle, searchFrom)
    if (idx < 0) break
    // 确保是独立的 this.$watch (前面不是标识符字符)
    if (idx > 0 && /[A-Za-z0-9_$]/.test(s[idx - 1])) {
      searchFrom = idx + 1
      continue
    }
    // ( 位置
    let openParen = idx + needle.length
    while (openParen < s.length && /\s/.test(s[openParen])) openParen++
    if (s[openParen] !== '(') {
      searchFrom = idx + 1
      continue
    }
    // 从 ( 开始扫描平衡括号
    let depth = 1
    let i = openParen + 1
    let inStr: string | null = null
    while (i < s.length && depth > 0) {
      const c = s[i]
      if (inStr) {
        if (c === '\\') { i += 2; continue }
        if (c === inStr) inStr = null
        i++
        continue
      }
      if (c === "'" || c === '"' || c === '`') { inStr = c; i++; continue }
      if (c === '/' && s[i + 1] === '/') {
        const eol = s.indexOf('\n', i)
        i = eol < 0 ? s.length : eol
        continue
      }
      if (c === '/' && s[i + 1] === '*') {
        const end = s.indexOf('*/', i + 2)
        i = end < 0 ? s.length : end + 2
        continue
      }
      if (c === '(') depth++
      else if (c === ')') {
        depth--
        if (depth === 0) break
      }
      i++
    }
    if (depth !== 0) {
      // 没找到匹配的 ), 放弃
      searchFrom = idx + 1
      continue
    }
    // 提取 [idx, i+1] 区间作为完整 this.$watch(...) 调用
    out += s.slice(last, idx)
    const inner = s.slice(openParen + 1, i)
    const strMatch = inner.match(/^\s*(['"`])([^'"`]+)\1/)
    if (strMatch) {
      let key = strMatch[2]
      // 根据 data/props 智能转换
      const rootName = key.split('.')[0].split('[')[0]
      if (props.propNames.has(rootName)) {
        // prop 路径
        if (key === rootName) {
          key = `props.${key}`
        } else {
          key = `props.${key}`
        }
      } else {
        const f = data.fields.find((x) => x.name === rootName)
        if (f) {
          if (f.kind === 'ref') {
            // ref 字段
            if (key === rootName) {
              key = `${key}.value`
            } else {
              // 路径如 'user.name' 转换: 但 ref 没有 property, 应该用 computed 包一下
              key = `(() => ${key}) /* was ref path */`
            }
          } else {
            // reactive 字段
            if (key === rootName) {
              key = `${key}`  // 保留原名
            } else {
              key = `${key}`  // 路径如 'currentUser.name' 保留
            }
          }
        }
      }
      const afterKey = inner.slice(strMatch[0].length).replace(/^\s*,\s*/, '')
      out += `watch(() => ${key}, ${afterKey}) /* was this.$watch('${strMatch[2]}', ...) */`
      result.vueImports.add('watch')
    } else {
      out += `/* manual: this.$watch with non-string key */ watch(() => /* TODO */, ${inner})`
      result.reviewItems.push('this.$watch 第一个参数不是字符串, 需要手动改写。')
      result.vueImports.add('watch')
    }
    last = i + 1
    searchFrom = i + 1
  }
  if (last < s.length) out += s.slice(last)
  return out
}
