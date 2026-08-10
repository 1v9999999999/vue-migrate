/**
 * @vue-migrate/plugin-vue3-types — shared utilities
 *
 * - typeCache helpers (ProjectContext.typeCache)
 * - TSTypeAnnotation builders
 * - JSDoc comment builders
 * - script-lang detection (TS vs JS) for both .vue and standalone .ts/.tsx
 */

import * as t from '@babel/types'
import type { ProjectContext, FileNode } from '@vue-migrate/core'

// ------------------------------------------------------------------
// Confidence levels
// ------------------------------------------------------------------

/**
 * Confidence (0~1) for an inferred type.
 *  - 1.0 = type is declared (e.g. prop with `type: Number` literal)
 *  - 0.8 = type inferred from a single literal value (e.g. `count: 0` → number)
 *  - 0.5 = type inferred from heuristics (e.g. `[]` → any[] without context)
 *  - 0.0 = cannot infer (return 'unknown')
 */
export type Confidence = number

export interface InferredType {
  /** TS type expression (rendered in a TSTypeAnnotation) */
  tsType: t.TSType
  /** JSDoc-style string (for JS scripts) */
  jsTypeString: string
  /** how confident we are */
  confidence: Confidence
  /** what we observed (for debugging / manual review) */
  reason: string
}

// ------------------------------------------------------------------
// typeCache access
// ------------------------------------------------------------------

/**
 * Get (or create) the per-file type cache entry.
 * Cache shape: Map<filePath, Map<symbolKey, InferredType>>
 */
export function getFileTypeCache(
  project: ProjectContext,
  file: FileNode,
): Map<string, InferredType> {
  // core's typeCache is typed `Map<string, Map<string, string>>` but we want to store
  // structured InferredType objects. Cast through unknown so the rich info survives.
  let entry = project.typeCache.get(file.path) as unknown as Map<string, InferredType> | undefined
  if (!entry) {
    entry = new Map()
    ;(project.typeCache as any).set(file.path, entry)
  }
  return entry
}

/** Write an inferred type into the cache + bump the global stat. */
export function recordInferredType(
  project: ProjectContext,
  file: FileNode,
  key: string,
  inf: InferredType,
): void {
  const cache = getFileTypeCache(project, file)
  cache.set(key, inf)
  // Also keep the core's expected `string` shape populated so cross-plugin readers work
  const str = inf.jsTypeString
  if (!cache.has('__' + key)) {
    ;(cache as any).set('__' + key, str)
  }
  project.stats.newTypesInferred++
}

// ------------------------------------------------------------------
// Language detection
// ------------------------------------------------------------------

export function isFileTs(file: FileNode): boolean {
  // .ts / .tsx file → always TS
  if (file.kind === 'ts' || file.kind === 'tsx') return true
  // .vue with explicit <script lang="ts">
  if (file.kind === 'vue' && file.sfc?.script?.lang === 'ts') return true
  // metadata fallback
  if (file.metadata.lang === 'ts' || file.metadata.lang === 'tsx') return true
  return false
}

// ------------------------------------------------------------------
// Low-level TS type builders
// ------------------------------------------------------------------

/** `number` / `string` / `boolean` / `null` / `undefined` / `unknown` */
export const kw = (name: 'number' | 'string' | 'boolean' | 'null' | 'undefined' | 'any' | 'unknown' | 'void' | 'never' | 'object' | 'symbol' | 'bigint'): t.TSType =>
  t.tsTypeReference(t.identifier(name))

/** `Foo` (named reference) */
export const ref = (name: string): t.TSType =>
  t.tsTypeReference(t.identifier(name))

/** `string | number` */
export function union(...types: t.TSType[]): t.TSType {
  if (types.length === 0) return kw('unknown')
  if (types.length === 1) return types[0]
  return t.tsUnionType(types)
}

/** `string[]` */
export function arrayOf(elem: t.TSType): t.TSType {
  return t.tsArrayType(elem)
}

/** `{ a: number; b: string }` */
export function shape(
  props: Array<{ name: string; optional: boolean; type: t.TSType; comment?: string }>,
  /** when false, skip per-property JSDoc (keeps the generated type readable) */
  includePropertyComments: boolean = false,
): t.TSType {
  const members: t.TSTypeElement[] = props.map((p) => {
    const prop = t.tsPropertySignature(
      t.identifier(p.name),
      t.tsTypeAnnotation(p.type),
    )
    prop.optional = p.optional
    if (p.comment && includePropertyComments) {
      prop.leadingComments = [{
        type: 'CommentBlock',
        value: `\n * ${p.comment}\n `,
      } as any]
    }
    return prop
  })
  return t.tsTypeLiteral(members)
}

/** `: T` (TSTypeAnnotation) */
export function annotate(type: t.TSType): t.TSTypeAnnotation {
  return t.tsTypeAnnotation(type)
}

// ------------------------------------------------------------------
// JSDoc builders (for JS scripts)
// ------------------------------------------------------------------

/**
 * Build a JSDoc block string like:
 *   /**
 *    * @returns {{count: number, msg: string}}
 *    *\/
 */
export function jsdocReturns(shape: string): string {
  return `* @returns {${shape}} `
}

/** Build a JSDoc `@type` block above a property. */
export function jsdocType(shape: string, extra: string = ''): string {
  const lines = [`* @type {${shape}}`]
  if (extra) lines.push(`* ${extra}`)
  return lines.join('\n  ') + ' '
}

/** Helper: attach a leading JSDoc block comment to a node. */
export function attachJSDoc(node: t.Node, bodyLines: string[]): void {
  // We must provide the FULL block comment value including `*` on each line.
  // @babel/generator outputs `/*<value>*/` verbatim, with no auto-asterisk.
  // Start with `*` so the very first content line is `*` (right after `/*`).
  // A leading `\n` makes the generator put a newline before the `/*` so the
  // comment sits on its own line.
  const text = `\n * ${bodyLines.join('\n * ')}\n `
  const comment: t.CommentBlock = {
    type: 'CommentBlock',
    value: text,
  } as any
  // Insert before any existing leadingComments
  const existing = (node as any).leadingComments as t.Comment[] | undefined
  if (existing) {
    ;(node as any).leadingComments = [...existing, comment]
  } else {
    ;(node as any).leadingComments = [comment]
  }
}

// ------------------------------------------------------------------
// Misc helpers
// ------------------------------------------------------------------

/** Pretty-print a TSType as a TS source string (for JSDoc / comments). */
export function tsTypeToString(type: t.TSType | null | undefined): string {
  if (!type) return 'unknown'
  if (t.isTSNumberKeyword(type)) return 'number'
  if (t.isTSStringKeyword(type)) return 'string'
  if (t.isTSBooleanKeyword(type)) return 'boolean'
  if (t.isTSNullKeyword(type)) return 'null'
  if (t.isTSUndefinedKeyword(type)) return 'undefined'
  if (t.isTSAnyKeyword(type)) return 'any'
  if (t.isTSUnknownKeyword(type)) return 'unknown'
  if (t.isTSVoidKeyword(type)) return 'void'
  if (t.isTSNeverKeyword(type)) return 'never'
  if (t.isTSObjectKeyword(type)) return 'object'
  if (t.isTSSymbolKeyword(type)) return 'symbol'
  if (t.isTSBigIntKeyword(type)) return 'bigint'
  if (t.isTSArrayType(type)) return tsTypeToString(type.elementType) + '[]'
  if (t.isTSUnionType(type)) {
    return type.types.map(tsTypeToString).join(' | ')
  }
  if (t.isTSLiteralType(type)) {
    const l = type.literal
    if (t.isStringLiteral(l)) return JSON.stringify(l.value)
    if (t.isNumericLiteral(l)) return String(l.value)
    if (t.isBooleanLiteral(l)) return String(l.value)
    return 'unknown'
  }
  if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
    return type.typeName.name
  }
  if (t.isTSTypeLiteral(type)) {
    const parts: string[] = []
    for (const m of type.members) {
      if (t.isTSPropertySignature(m) && t.isIdentifier(m.key)) {
        const opt = m.optional ? '?' : ''
        parts.push(`${m.key.name}${opt}: ${tsTypeToString(m.typeAnnotation?.typeAnnotation as any)}`)
      }
    }
    return '{ ' + parts.join('; ') + ' }'
  }
  return 'unknown'
}
