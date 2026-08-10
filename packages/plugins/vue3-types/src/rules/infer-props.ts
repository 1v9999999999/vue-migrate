/**
 * Rule 4.2 — `props: { name: String, age: { type: Number, default: 0 } }` → typed props
 *
 * MVP strategy (per project spec):
 *  - Build an inferred prop type map per component.
 *  - For TS scripts: add a JSDoc-style block comment above the `props:` key
 *    that declares the inferred TypeScript shape (e.g. `props?: { name?: string; age?: number }`).
 *  - For JS scripts: same, but using JSDoc shape.
 *  - Cache each prop's inferred type in `ctx.project.typeCache` (key `props.<name>`).
 *
 * Note: We do NOT rewrite the runtime `props: { ... }` declaration.
 * Converting to `defineProps<{}>()` requires `<script setup>`, which Options-API files don't have.
 *
 * Built-in type map (Vue 2 prop type constructor → TS type):
 *   String  → string
 *   Number  → number
 *   Boolean → boolean
 *   Array   → unknown[]    (can't infer element type)
 *   Object  → object / Record<string, unknown>
 *   Date    → Date
 *   Function→ Function
 *   Symbol  → symbol
 */

import * as t from '@babel/types'
import type { TransformContext, TransformUtils } from '@vue-migrate/core'
import {
  type InferredType,
  kw,
  ref,
  union,
  arrayOf,
  shape,
  attachJSDoc,
  recordInferredType,
  isFileTs,
  tsTypeToString,
} from '../utils.js'
import { inferLiteralType } from './infer-data.js'

/** Cast the markChanged signature — core's types.ts is stale, the real impl accepts a message. */
const markChanged = (utils: TransformUtils, msg: string) => (utils.markChanged as any)(msg)

// ------------------------------------------------------------------
// Public entry
// ------------------------------------------------------------------

export function transformPropsTypes(ctx: TransformContext): void {
  const { file, project, utils } = ctx
  if (!file.scriptAst) return

  traverseDefaultExports(file.scriptAst, (optionsObj) => {
    for (const prop of optionsObj.properties) {
      if (t.isSpreadElement(prop)) continue
      if (!isPropsProperty(prop)) continue
      if (!t.isObjectExpression(prop.value)) continue

      const fields: Array<{ name: string; optional: boolean; type: t.TSType; comment?: string }> = []
      for (const p of prop.value.properties) {
        if (!t.isObjectProperty(p)) continue
        const name = propertyKeyName(p)
        if (!name) continue
        const required = inferRequired(p.value)
        const inf = inferPropType(p.value, name)
        fields.push({ name, optional: !required, type: inf.tsType, comment: `[confidence=${inf.confidence}] ${inf.reason}` })
        recordInferredType(project, file, `props.${name}`, inf)
      }

      if (fields.length === 0) continue

      const typeObj = shape(fields)
      const shapeStr = fields
        .map((f) => `${f.name}${f.optional ? '?' : ''}: ${tsTypeToString(f.type)}`)
        .join('; ')

      // Always attach a JSDoc-style block — works for both TS and JS
      attachJSDoc(prop, [
        `vue3-types inferred props shape:`,
        `@type {{ ${shapeStr} }}`,
        `(In Vue3, the recommended equivalent is`,
        `  const props = defineProps<{ ${fields.map((f) => `${f.name}${f.optional ? '?' : ''}: ${tsTypeToString(f.type)}`).join('; ')} }>()`,
        `  in <script setup>. For Options API, runtime props are kept as-is.)`,
      ])

      // For TS scripts: also generate a defineComponent<...> wrap as a comment
      // (we don't actually wrap the export because Vue 3 defineComponent generics
      // are too specific to type both data() and props safely)
      if (isFileTs(file) && file.kind === 'vue') {
        markChanged(utils, `annotated props: { ${shapeStr} }`)
      } else {
        markChanged(utils, `annotated props (JSDoc): { ${shapeStr} }`)
      }
    }
  })
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function traverseDefaultExports(ast: t.Node, visit: (obj: t.ObjectExpression) => void): void {
  if (t.isFile(ast)) {
    for (const stmt of ast.program.body) traverseDefaultExports(stmt, visit)
    return
  }
  if (t.isExportDefaultDeclaration(ast) && t.isObjectExpression(ast.declaration)) {
    visit(ast.declaration)
    return
  }
}

function isPropsProperty(prop: t.ObjectMethod | t.ObjectProperty): prop is t.ObjectProperty {
  return t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'props'
}

function propertyKeyName(prop: t.ObjectProperty): string | null {
  if (t.isIdentifier(prop.key)) return prop.key.name
  if (t.isStringLiteral(prop.key)) return prop.key.value
  return null
}

/**
 * A prop is required when:
 *  - it's a bare type identifier (e.g. `name: String`) — Vue 2 treats these as required by default
 *    UNLESS the user wrote `name: { type: String, required: false }`
 *  - or its definition object has `required: true`
 */
function inferRequired(value: t.Node): boolean {
  // Bare identifier like `name: String` is REQUIRED in Vue 2 if there's no `default`
  if (t.isIdentifier(value)) {
    return !BARE_TYPE_HAS_DEFAULT.has(value.name) // we conservatively mark as required
  }
  if (t.isObjectExpression(value)) {
    let hasDefault = false
    let requiredVal: boolean | null = null
    for (const p of value.properties) {
      if (!t.isObjectProperty(p)) continue
      const k = propertyKeyName(p)
      if (k === 'default') hasDefault = true
      if (k === 'required' && t.isBooleanLiteral(p.value)) {
        requiredVal = p.value.value
      }
    }
    if (requiredVal !== null) return requiredVal
    if (hasDefault) return false
    return true
  }
  return false
}

/** Vue 2 prop type constructors we know about. */
const BUILTIN_TYPES: Record<string, t.TSType> = {
  String: kw('string'),
  Number: kw('number'),
  Boolean: kw('boolean'),
  Array: arrayOf(kw('any')),     // we don't know the element type
  Object: ref('Record<string, unknown>'),
  Date: ref('Date'),
  Function: ref('Function'),
  Symbol: kw('symbol'),
  BigInt: kw('bigint'),
}

/** For the bare-identifier form (`name: String`), assume required unless we see a default. */
const BARE_TYPE_HAS_DEFAULT = new Set<string>()

/** Map a Vue 2 prop value to an InferredType. */
function inferPropType(value: t.Node, propName: string): InferredType {
  // Form A: `name: String`
  if (t.isIdentifier(value)) {
    const mapped = BUILTIN_TYPES[value.name]
    if (mapped) {
      return {
        tsType: mapped,
        jsTypeString: tsTypeToString(mapped),
        confidence: 1.0,
        reason: `bare type: ${value.name}`,
      }
    }
    // Unknown identifier — treat as the identifier's name as a TS type
    return {
      tsType: ref(value.name),
      jsTypeString: value.name,
      confidence: 0.6,
      reason: `bare custom type: ${value.name}`,
    }
  }

  // Form B: `name: [String, Number]`
  if (t.isArrayExpression(value)) {
    const tsTypes: t.TSType[] = []
    let minConf = 1.0
    let reasons: string[] = []
    for (const el of value.elements) {
      if (!el) continue
      if (t.isIdentifier(el) && BUILTIN_TYPES[el.name]) {
        tsTypes.push(BUILTIN_TYPES[el.name])
        reasons.push(el.name)
        minConf = Math.min(minConf, 1.0)
      } else if (t.isIdentifier(el)) {
        tsTypes.push(ref(el.name))
        reasons.push(el.name)
        minConf = Math.min(minConf, 0.6)
      } else {
        tsTypes.push(kw('unknown'))
        reasons.push('?')
        minConf = Math.min(minConf, 0.3)
      }
    }
    if (tsTypes.length === 0) {
      return { tsType: kw('unknown'), jsTypeString: 'unknown', confidence: 0.0, reason: 'empty type[]' }
    }
    return {
      tsType: union(...tsTypes),
      jsTypeString: tsTypes.map(tsTypeToString).join(' | '),
      confidence: minConf,
      reason: `multi-type: [${reasons.join(', ')}]`,
    }
  }

  // Form C: `name: { type: X, default: Y }`
  if (t.isObjectExpression(value)) {
    let typeNode: t.Node | null = null
    let defaultNode: t.Node | null = null
    for (const p of value.properties) {
      if (!t.isObjectProperty(p)) continue
      const k = propertyKeyName(p)
      if (k === 'type') typeNode = p.value
      if (k === 'default') defaultNode = p.value
    }

    // 1) Use `type` field if present
    if (typeNode) {
      // type can be Identifier (String) or ArrayExpression ([String, Number])
      if (t.isIdentifier(typeNode) && BUILTIN_TYPES[typeNode.name]) {
        return {
          tsType: BUILTIN_TYPES[typeNode.name],
          jsTypeString: tsTypeToString(BUILTIN_TYPES[typeNode.name]),
          confidence: 1.0,
          reason: `type: ${typeNode.name}${defaultNode ? ' (with default)' : ''}`,
        }
      }
      if (t.isArrayExpression(typeNode)) {
        const tsTypes: t.TSType[] = []
        let minConf = 1.0
        let reasons: string[] = []
        for (const el of typeNode.elements) {
          if (!el) continue
          if (t.isIdentifier(el) && BUILTIN_TYPES[el.name]) {
            tsTypes.push(BUILTIN_TYPES[el.name])
            reasons.push(el.name)
            minConf = Math.min(minConf, 1.0)
          } else if (t.isIdentifier(el)) {
            tsTypes.push(ref(el.name))
            reasons.push(el.name)
            minConf = Math.min(minConf, 0.6)
          } else {
            tsTypes.push(kw('unknown'))
            minConf = Math.min(minConf, 0.3)
          }
        }
        return {
          tsType: union(...tsTypes),
          jsTypeString: tsTypes.map(tsTypeToString).join(' | '),
          confidence: minConf,
          reason: `type: [${reasons.join(', ')}]`,
        }
      }
      // e.g. `type: SomeCustomClass`
      if (t.isIdentifier(typeNode)) {
        return {
          tsType: ref(typeNode.name),
          jsTypeString: typeNode.name,
          confidence: 0.6,
          reason: `custom type: ${typeNode.name}`,
        }
      }
    }

    // 2) Fall back to `default` value
    if (defaultNode) {
      const inf = inferLiteralType(defaultNode)
      return {
        tsType: inf.tsType,
        jsTypeString: inf.jsTypeString,
        confidence: Math.max(0.5, inf.confidence * 0.8), // down-rate because we inferred from default
        reason: `inferred from default value (${inf.reason})`,
      }
    }

    return { tsType: kw('unknown'), jsTypeString: 'unknown', confidence: 0.0, reason: 'props entry has no type or default' }
  }

  return { tsType: kw('any'), jsTypeString: 'any', confidence: 0.3, reason: `unrecognized props entry ${value.type}` }
}
