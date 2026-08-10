/**
 * Rule 4.1 — `data() { return {...} }` → annotate return type
 *
 * MVP strategy (per project spec "方式 A"):
 *  - For TS scripts: add `: { count: number; msg: string; items: number[] }`
 *    as a return-type annotation on the `data()` method.
 *  - For JS scripts: add a JSDoc `@returns {{...}}` block.
 *
 * Inference rules for each value:
 *   - NumericLiteral           → number
 *   - StringLiteral            → string
 *   - BooleanLiteral           → boolean
 *   - NullLiteral              → null
 *   - RegExpLiteral            → RegExp
 *   - TemplateLiteral (no expr)→ string
 *   - ArrayExpression          → arrayOf(infer(first) ?? any)
 *   - ObjectExpression         → shape({...})  (recursive)
 *   - UnaryExpression (!x)     → boolean
 *   - TSAsExpression / TSTypeAssertion → unwrap and re-infer
 *   - ArrowFunctionExpression / FunctionExpression → unknown
 *   - NewExpression            → unknown
 *   - MemberExpression         → unknown
 *   - Identifier               → unknown
 *   - everything else          → any  (with low confidence)
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
  annotate,
  attachJSDoc,
  recordInferredType,
  isFileTs,
  tsTypeToString,
} from '../utils.js'

// ------------------------------------------------------------------
// Public entry — run on a single file's scriptAst
// ------------------------------------------------------------------

/** Cast the markChanged signature — core's types.ts is stale, the real impl accepts a message. */
const markChanged = (utils: TransformUtils, msg: string) => (utils.markChanged as any)(msg)

/**
 * Process the `data()` method of every Options-API default-exported object
 * in the given file. Mutates the AST in place.
 *
 * Output strategy:
 *  - For `.vue` files with `<script lang="ts">`  → add a real `: T` return-type annotation
 *  - For everything else (JS / standalone .ts / .tsx) → add a JSDoc `@returns {...}` block
 *
 * Why this split: core's `selfCheck` uses a plain Babel parser (no `typescript`
 * plugin) for non-Vue files. So if we emit TS-only syntax in a `.ts` file,
 * self-check fails and the file gets skipped.
 */
export function transformDataTypes(ctx: TransformContext): void {
  const { file, project, utils } = ctx
  if (!file.scriptAst) return

  // Use real TS return-type annotation only for .vue files (where SFC parser
  // accepts TS syntax). For standalone .ts/.tsx, fall back to JSDoc to keep
  // core's selfCheck (plain babel parser) happy.
  const useTsReturnType = isFileTs(file) && file.kind === 'vue'

  // Find all "default export = { ... }" patterns and process each
  traverseDefaultExports(file.scriptAst, (optionsObj) => {
    for (const prop of optionsObj.properties) {
      // skip spread elements
      if (t.isSpreadElement(prop)) continue
      const dataProp = getDataProperty(prop)
      if (!dataProp) continue

      // ObjectMethod: data() {...} → method itself is the function
      // ObjectProperty: data: function() {...} or data: () => ({...}) → value is the function
      const dataFn: t.Function | null = t.isObjectMethod(dataProp)
        ? dataProp
        : getDataFunction(dataProp.value)
      if (!dataFn) continue

      // Extract the return literal
      const retExpr = extractReturnedObject(dataFn)
      if (!retExpr || !t.isObjectExpression(retExpr)) {
        // data() returns a non-object — skip
        ctx.log(`data() returns non-object literal, skipped`)
        continue
      }

      // Infer types for each property in the return
      const fields: Array<{ name: string; optional: boolean; type: any; comment?: string }> = []
      for (const retProp of retExpr.properties) {
        if (!t.isObjectProperty(retProp)) continue
        const key = propertyKeyName(retProp)
        if (!key) continue
        const value = retProp.value
        // `as` / `<T>` cast: unwrap before inferring
        const inner = unwrapTsAssertion(value)
        const inf = inferLiteralType(inner)
        const conf = inf.confidence
        const comment = `[confidence=${conf}] ${inf.reason}`

        fields.push({ name: key, optional: false, type: inf.tsType, comment })
        recordInferredType(project, file, `data.${key}`, inf)
      }

      if (fields.length === 0) continue

      // Apply annotation / JSDoc
      const typeObj = shape(fields)
      if (useTsReturnType) {
        // Set return type on the data() method/function
        if (t.isObjectMethod(dataFn) || t.isFunctionExpression(dataFn) || t.isArrowFunctionExpression(dataFn) || t.isObjectProperty(dataProp)) {
          setFunctionReturnType(dataProp, dataFn, typeObj)
        }
        markChanged(utils, `annotated data() return type: { ${fields.map((f) => `${f.name}: ${tsTypeToString(f.type)}`).join('; ')} }`)
      } else {
        // JS / .ts / .tsx fallback: JSDoc above the `data` key
        const shapeStr = fields
          .map((f) => `${f.name}${f.optional ? '?' : ''}: ${tsTypeToString(f.type)}`)
          .join(', ')
        attachJSDoc(dataProp, [
          `vue3-types inferred data() return type:`,
          `@returns {{${shapeStr}}}`,
        ])
        markChanged(utils, `added JSDoc for data(): { ${shapeStr} }`)
      }
    }
  })
}

// ------------------------------------------------------------------
// AST helpers
// ------------------------------------------------------------------

/** Traverse top-level `export default { ... }` (ExportDefaultDeclaration with ObjectExpression). */
function traverseDefaultExports(ast: t.Node, visit: (obj: t.ObjectExpression) => void): void {
  if (t.isFile(ast)) {
    for (const stmt of ast.program.body) traverseDefaultExports(stmt, visit)
    return
  }
  if (t.isExportDefaultDeclaration(ast) && t.isObjectExpression(ast.declaration)) {
    visit(ast.declaration)
    return
  }
  // Also handle `const X = { ... }; export default X` (less common but legal)
  // For MVP we focus on the inline form.
}

function getDataProperty(prop: t.ObjectMethod | t.ObjectProperty): t.ObjectProperty | t.ObjectMethod | null {
  if (t.isObjectMethod(prop) && t.isIdentifier(prop.key) && prop.key.name === 'data') return prop
  if (t.isObjectProperty(prop) && t.isIdentifier(prop.key) && prop.key.name === 'data') return prop
  return null
}

function getDataFunction(
  value: t.Node,
): t.FunctionExpression | t.ArrowFunctionExpression | t.ObjectMethod | null {
  if (t.isObjectMethod(value)) return value
  if (t.isFunctionExpression(value)) return value
  if (t.isArrowFunctionExpression(value)) return value
  return null
}

/** Extract the ObjectExpression returned by data(). Handles both block-return and implicit-return. */
function extractReturnedObject(fn: t.Function): t.ObjectExpression | null {
  if (t.isObjectMethod(fn) || t.isFunctionExpression(fn)) {
    if (!t.isBlockStatement(fn.body)) return null
    const ret = lastReturn(fn.body)
    if (ret && t.isObjectExpression(ret.argument)) return ret.argument
    return null
  }
  if (t.isArrowFunctionExpression(fn)) {
    if (t.isBlockStatement(fn.body)) {
      const ret = lastReturn(fn.body)
      if (ret && t.isObjectExpression(ret.argument)) return ret.argument
      return null
    }
    if (t.isObjectExpression(fn.body)) return fn.body
  }
  return null
}

function lastReturn(block: t.BlockStatement): t.ReturnStatement | null {
  for (let i = block.body.length - 1; i >= 0; i--) {
    const s = block.body[i]
    if (t.isReturnStatement(s)) return s
  }
  return null
}

function propertyKeyName(prop: t.ObjectProperty): string | null {
  if (t.isIdentifier(prop.key)) return prop.key.name
  if (t.isStringLiteral(prop.key)) return prop.key.value
  return null
}

function unwrapTsAssertion(node: t.Node): t.Node {
  if (t.isTSAsExpression(node)) return unwrapTsAssertion(node.expression)
  if (t.isTSTypeAssertion(node)) return unwrapTsAssertion(node.expression)
  if (t.isTSNonNullExpression(node)) return unwrapTsAssertion(node.expression)
  if (t.isTSSatisfiesExpression(node)) return unwrapTsAssertion(node.expression)
  return node
}

// ------------------------------------------------------------------
// Type inference
// ------------------------------------------------------------------

/** Infer a TS type from a literal-ish expression. */
export function inferLiteralType(node: t.Node): InferredType {
  // unwrap casts first
  const raw = unwrapTsAssertion(node)
  node = raw

  // NumericLiteral (handles negative if wrapped in UnaryExpression, see below)
  if (t.isNumericLiteral(node)) {
    return { tsType: kw('number'), jsTypeString: 'number', confidence: 0.9, reason: `literal ${node.value}` }
  }
  if (t.isStringLiteral(node)) {
    return { tsType: kw('string'), jsTypeString: 'string', confidence: 0.9, reason: `string literal ${JSON.stringify(node.value).slice(0, 40)}` }
  }
  if (t.isBooleanLiteral(node)) {
    return { tsType: kw('boolean'), jsTypeString: 'boolean', confidence: 0.9, reason: `boolean literal ${node.value}` }
  }
  if (t.isNullLiteral(node)) {
    return { tsType: kw('null'), jsTypeString: 'null', confidence: 0.9, reason: 'null literal' }
  }
  if (t.isRegExpLiteral(node)) {
    return { tsType: ref('RegExp'), jsTypeString: 'RegExp', confidence: 1.0, reason: 'RegExp literal' }
  }
  if (t.isTemplateLiteral(node)) {
    if (node.expressions.length === 0) {
      return { tsType: kw('string'), jsTypeString: 'string', confidence: 0.9, reason: 'template literal (no expressions)' }
    }
    return { tsType: kw('string'), jsTypeString: 'string', confidence: 0.6, reason: 'template literal with expressions' }
  }
  if (t.isArrayExpression(node)) {
    if (node.elements.length === 0) {
      return { tsType: arrayOf(kw('any')), jsTypeString: 'any[]', confidence: 0.5, reason: 'empty array' }
    }
    // Union of all element types (deduped shallowly)
    const elTypes = new Map<string, t.TSType>()
    let minConf = 1.0
    for (const el of node.elements) {
      if (!el) continue // sparse hole
      if (t.isSpreadElement(el)) {
        elTypes.set('any[]', arrayOf(kw('any')))
        minConf = Math.min(minConf, 0.3)
        continue
      }
      const inf = inferLiteralType(el)
      elTypes.set(tsTypeToString(inf.tsType), inf.tsType)
      minConf = Math.min(minConf, inf.confidence)
    }
    const elemType = elTypes.size === 1
      ? [...elTypes.values()][0]
      : union(...elTypes.values())
    return { tsType: arrayOf(elemType), jsTypeString: tsTypeToString(arrayOf(elemType)), confidence: minConf, reason: `array[${node.elements.length}]` }
  }
  if (t.isObjectExpression(node)) {
    // Recursive inline shape
    const fields: Array<{ name: string; optional: boolean; type: t.TSType; comment?: string }> = []
    let minConf = 1.0
    for (const p of node.properties) {
      if (!t.isObjectProperty(p)) continue
      const k = propertyKeyName(p)
      if (!k) continue
      const inf = inferLiteralType(p.value)
      fields.push({ name: k, optional: false, type: inf.tsType, comment: `[confidence=${inf.confidence}] ${inf.reason}` })
      minConf = Math.min(minConf, inf.confidence)
    }
    return { tsType: shape(fields), jsTypeString: tsTypeToString(shape(fields)), confidence: Math.max(0.5, minConf), reason: `inline object{${fields.length}}` }
  }
  if (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument)) {
    return { tsType: kw('number'), jsTypeString: 'number', confidence: 0.9, reason: `negative numeric ${node.operator}${node.argument.value}` }
  }
  if (t.isUnaryExpression(node) && node.operator === '!') {
    return { tsType: kw('boolean'), jsTypeString: 'boolean', confidence: 0.6, reason: 'unary !' }
  }
  if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
    return { tsType: kw('unknown'), jsTypeString: 'Function', confidence: 0.0, reason: 'function literal' }
  }
  if (t.isClassExpression(node) && t.isIdentifier(node.id)) {
    return { tsType: ref(node.id.name), jsTypeString: node.id.name, confidence: 1.0, reason: 'class expression' }
  }
  if (t.isNewExpression(node) && t.isIdentifier(node.callee)) {
    return { tsType: ref(node.callee.name), jsTypeString: node.callee.name, confidence: 0.6, reason: `new ${node.callee.name}()` }
  }
  if (t.isIdentifier(node)) {
    if (node.name === 'undefined') return { tsType: kw('undefined'), jsTypeString: 'undefined', confidence: 1.0, reason: 'undefined identifier' }
    if (node.name === 'Infinity' || node.name === 'NaN') return { tsType: kw('number'), jsTypeString: 'number', confidence: 0.8, reason: `global ${node.name}` }
    return { tsType: kw('unknown'), jsTypeString: 'unknown', confidence: 0.0, reason: `identifier ${node.name}` }
  }

  return { tsType: kw('any'), jsTypeString: 'any', confidence: 0.3, reason: `unrecognized ${node.type}` }
}

// ------------------------------------------------------------------
// Return-type annotation setter
// ------------------------------------------------------------------

/**
 * Set the return type annotation on the data() method/function.
 *   - ObjectMethod           → fn.returnType = TSTypeAnnotation
 *   - ObjectProperty (fn)    → fn.value.returnType
 */
function setFunctionReturnType(
  dataProp: t.ObjectProperty | t.ObjectMethod,
  dataFn: t.Function,
  type: t.TSType,
): void {
  if (t.isObjectMethod(dataProp)) {
    ;(dataProp as any).returnType = annotate(type)
    return
  }
  // ObjectProperty wrapping a function — set returnType on the inner function
  if (t.isObjectProperty(dataProp)) {
    if (
      t.isFunctionExpression(dataFn) ||
      t.isArrowFunctionExpression(dataFn)
    ) {
      ;(dataFn as any).returnType = annotate(type)
    }
  }
}
