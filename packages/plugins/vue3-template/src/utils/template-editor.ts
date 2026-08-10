/**
 * Centralized HTML element edit primitives for vue3-template rules.
 *
 * Why this module exists:
 *   vue3-template (and elementui) have several rules that need to:
 *     1. Find an HTML element / attribute at a known position
 *     2. Modify it (replace, remove, wrap, etc.)
 *     3. Splice the result back into the source string
 *
 *   Before this module, each rule (slot-rewriting, vbind-sync,
 *   inline-template, icon.ts in elementui) implemented its OWN splice
 *   logic with its OWN whitespace handling. That duplication produced
 *   real bugs — e.g. B33: <template slot-scope=...> was wrapped in
 *   another <template>, because slot-rewriting's wrap logic didn't
 *   consider that the original element was already a <template>.
 *
 *   This module is the single source of truth for "find an element +
 *   apply a transformation + splice it back". All rules should use
 *   these helpers instead of writing their own `source.slice(...)` glue.
 */

import {
  scanAllElements,
  type ElementMatch,
  type ParsedAttr,
} from './template-scanner.js'

// ---------------------------------------------------------------------------
// Offset helpers
// ---------------------------------------------------------------------------

/**
 * Attribute offsets in `ParsedAttr` are RELATIVE to the attribute text
 * (the part of the template between the tag name and the closing '>').
 * This helper converts an attr's relative offset to an absolute offset
 * in the full source string.
 */
export function attrAbsStart(el: ElementMatch, attr: ParsedAttr): number {
  return el.tagNameEnd + attr.start
}

export function attrAbsEnd(el: ElementMatch, attr: ParsedAttr): number {
  return el.tagNameEnd + attr.end
}

// ---------------------------------------------------------------------------
// Element-level edits
// ---------------------------------------------------------------------------

/**
 * Replace the entire element with a new string.
 * The replacement must include the new open and close tags (or be empty).
 *
 * @example
 *   // <i class="el-icon-search"></i> → <el-icon><Search /></el-icon>
 *   out = replaceElement(source, el, '<el-icon><Search /></el-icon>')
 */
export function replaceElement(
  source: string,
  el: ElementMatch,
  replacement: string,
): string {
  return source.slice(0, el.start) + replacement + source.slice(el.end)
}

/**
 * Remove the element entirely.
 * @example
 *   // <div v-if="false">...</div> → (removed)
 *   out = removeElement(source, el)
 */
export function removeElement(source: string, el: ElementMatch): string {
  return source.slice(0, el.start) + source.slice(el.end)
}

/**
 * Insert content immediately before the element's open tag.
 * Does NOT add a newline; the caller controls whitespace.
 */
export function insertBeforeElement(
  source: string,
  el: ElementMatch,
  content: string,
): string {
  return source.slice(0, el.start) + content + source.slice(el.start)
}

/**
 * Insert content immediately after the element's close tag.
 * Does NOT add a newline; the caller controls whitespace.
 */
export function insertAfterElement(
  source: string,
  el: ElementMatch,
  content: string,
): string {
  return source.slice(0, el.end) + content + source.slice(el.end)
}

// ---------------------------------------------------------------------------
// Attribute-level edits
// ---------------------------------------------------------------------------

/**
 * Replace a single attribute on an element.
 *   - newAttr = new attribute text (e.g. 'v-model:foo="foo"')
 *   - newAttr = '' or null → remove the attribute (with intelligent whitespace)
 *
 * When removing, adjacent whitespace is handled automatically:
 *   - <tag bad />                    → <tag />
 *   - <tag bad other="x" />         → <tag other="x" />
 *   - <tag x="1" bad />             → <tag x="1" />
 *   - <tag x="1" bad y="2" />       → <tag x="1" y="2" />
 *
 * @example
 *   // inline-template → removed
 *   out = replaceAttribute(source, el, attr, null)
 *
 *   // v-bind.sync="foo" → v-model:foo="foo"
 *   out = replaceAttribute(source, el, attr, 'v-model:foo="foo"')
 */
export function replaceAttribute(
  source: string,
  el: ElementMatch,
  attr: ParsedAttr,
  newAttr: string | null,
): string {
  const absStart = attrAbsStart(el, attr)
  const absEnd = attrAbsEnd(el, attr)

  if (newAttr === null || newAttr === '') {
    return removeAttributeWithWhitespace(source, el, attr, absStart, absEnd)
  }
  return source.slice(0, absStart) + newAttr + source.slice(absEnd)
}

/**
 * Modify the raw text of an attribute in place, preserving the same offsets.
 * Unlike replaceAttribute, this is intended for in-place modifications
 * (e.g. removing a modifier from a directive's raw name).
 * The new raw text must be the same length or shorter to keep the surrounding
 * whitespace intact. If the new text is shorter, the trailing space (if any)
 * is preserved.
 */
export function modifyAttributeRaw(
  source: string,
  el: ElementMatch,
  attr: ParsedAttr,
  newRaw: string,
): string {
  const absStart = attrAbsStart(el, attr)
  const absEnd = attrAbsEnd(el, attr)
  return source.slice(0, absStart) + newRaw + source.slice(absEnd)
}

/**
 * Internal: remove an attribute and intelligently handle adjacent whitespace
 * so the element stays syntactically valid.
 *
 * Scanner contract (subtle!):
 *   - For VALUE attributes (e.g. `icon="..."`): the parser sets
 *     `attr.end` to the position right after the closing quote, so the
 *     trailing whitespace (the separator to the next attr or to `>`)
 *     is NOT included in the attr's range.
 *   - For BOOLEAN attributes (e.g. `inline-template`): the parser skips
 *     trailing whitespace while looking for `=`, so the trailing space
 *     IS included in `attr.end`.
 *   - The leading whitespace before an attr is NEVER included in its range.
 *
 * Strategy:
 *   - Detect boolean vs value attr by checking if source[absEnd-1] is
 *     whitespace (in-range trailing space = boolean attr).
 *   - For VALUE attrs, eat the leading separator (at absStart-1) so the
 *     trailing separator (at absEnd, OUTSIDE the range) becomes the new
 *     single separator.
 *   - For BOOLEAN attrs, do NOT eat the leading separator — the trailing
 *     space (which is in the range) becomes the new separator; the
 *     leading separator must be preserved to keep exactly one space.
 */
function removeAttributeWithWhitespace(
  source: string,
  el: ElementMatch,
  attr: ParsedAttr,
  absStart: number,
  absEnd: number,
): string {
  const hasLeft = hasOtherAttrBefore(el, attr)
  const hasRight = hasOtherAttrAfter(el, attr)
  const tail = el.selfClosing ? ' />' : '>'

  // Detect boolean attr: trailing space is already inside our range.
  const isBooleanAttr =
    absEnd > absStart &&
    (source[absEnd - 1] === ' ' || source[absEnd - 1] === '\t')

  // Eat the leading separator ONLY for value attrs. For boolean attrs, the
  // trailing space (in our range) becomes the new separator, so we must
  // keep the leading separator untouched.
  let removeStart = absStart
  if (
    !isBooleanAttr &&
    removeStart > el.tagNameEnd &&
    (source[removeStart - 1] === ' ' || source[removeStart - 1] === '\t')
  ) {
    removeStart--
  }

  if (hasRight) {
    return source.slice(0, removeStart) + source.slice(absEnd)
  }

  // No attr after us. Two sub-cases:
  //   - hasLeft && isBoolean: we kept the leading separator in our range
  //     (for boolean attrs), but there's nothing on the right to preserve
  //     it. Eat the leading separator too.
  //   - hasLeft && !isBoolean: removeStart is already at the leading
  //     separator (we ate it for value attrs). Just splice.
  //   - !hasLeft: this is the only attr. Eat from the tag name through `>`.
  if (hasLeft && isBooleanAttr) {
    // Eat one more leading char (the separator that we kept).
    const start = removeStart > el.tagNameEnd ? removeStart - 1 : removeStart
    return source.slice(0, start) + tail + source.slice(el.openEnd + 1)
  }
  if (hasLeft) {
    return source.slice(0, removeStart) + tail + source.slice(el.openEnd + 1)
  }
  return source.slice(0, el.tagNameEnd) + tail + source.slice(el.openEnd + 1)
}

function hasOtherAttrBefore(el: ElementMatch, attr: ParsedAttr): boolean {
  for (const a of el.attrs) {
    if (a === attr) break
    if (a.start < attr.start) return true
  }
  return false
}

function hasOtherAttrAfter(el: ElementMatch, attr: ParsedAttr): boolean {
  let seen = false
  for (const a of el.attrs) {
    if (a === attr) {
      seen = true
      continue
    }
    if (seen) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Batch edits
// ---------------------------------------------------------------------------

/**
 * A single text edit: replace source[start..end] with replacement.
 * Offsets are absolute (relative to the full source).
 */
export interface TextEdit {
  start: number
  end: number
  replacement: string
}

/**
 * Apply a list of edits to source, processing right-to-left so that
 * earlier edits don't invalidate the offsets of later ones.
 *
 * Edits with empty range and empty replacement are skipped.
 * Overlapping edits are NOT detected; the caller is responsible for
 * ensuring edits don't overlap (or sorting them right-to-left manually).
 */
export function applyEdits(source: string, edits: TextEdit[]): string {
  // Sort right-to-left (largest start first)
  const sorted = [...edits].sort((a, b) => b.start - a.start)
  let out = source
  for (const e of sorted) {
    if (e.start === e.end && e.replacement === '') continue
    if (e.start < 0 || e.end > source.length || e.start > e.end) {
      // Defensive: skip invalid edits rather than corrupt the source
      continue
    }
    out = out.slice(0, e.start) + e.replacement + out.slice(e.end)
  }
  return out
}

// ---------------------------------------------------------------------------
// High-level: "find elements matching predicate, replace each"
// ---------------------------------------------------------------------------

/**
 * Common pattern used by every rule: scan elements, filter by predicate,
 * build a replacement for each, splice all edits in one pass.
 *
 * @param source       The template source.
 * @param predicate    Returns the match to replace, or null to skip.
 * @param build        Builds the replacement string for a match.
 * @returns            { out, hits } where hits is the list of (match, replacement) pairs.
 */
export function replaceMatchingElements<T>(
  source: string,
  predicate: (el: ElementMatch) => T | null,
  build: (match: T) => string,
): { out: string; hits: Array<{ match: T; replacement: string }> } {
  // Lazy import to avoid circular dependency with template-scanner
  // scanAllElements is imported at the top of this file.
  const all = scanAllElements(source)
  const hits: Array<{ match: T; replacement: string }> = []
  const edits: TextEdit[] = []
  for (const el of all) {
    const match = predicate(el)
    if (match === null || match === undefined) continue
    const replacement = build(match)
    hits.push({ match, replacement })
    edits.push({ start: el.start, end: el.end, replacement })
  }
  if (hits.length === 0) {
    return { out: source, hits }
  }
  return { out: applyEdits(source, edits), hits }
}
