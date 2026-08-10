/**
 * Tests for utils/template-editor.ts
 *
 * Run: npx tsx packages/plugins/vue3-template/src/__tests__/test-editor.ts
 */
import {
  replaceElement,
  removeElement,
  insertBeforeElement,
  insertAfterElement,
  replaceAttribute,
  applyEdits,
  replaceMatchingElements,
  attrAbsStart,
  attrAbsEnd,
  type TextEdit,
} from '../utils/template-editor.js'
import { scanAllElements, findAttr } from '../utils/template-scanner.js'

let pass = 0
let fail = 0
const cases: Array<{ name: string; run: () => void }> = []

function test(name: string, run: () => void) {
  cases.push({ name, run })
}

// ===========================================================================
// replaceElement
// ===========================================================================

test('replaceElement: replace <i> with <el-icon>', () => {
  const src = '<div><i class="el-icon-search"></i></div>'
  const all = scanAllElements(src)
  const iEl = all.find(e => e.tagName === 'i')!
  const out = replaceElement(src, iEl, '<el-icon><Search /></el-icon>')
  const expected = '<div><el-icon><Search /></el-icon></div>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceElement: replace self-closing element', () => {
  const src = '<div><br /></div>'
  const all = scanAllElements(src)
  const br = all.find(e => e.tagName === 'br')!
  const out = replaceElement(src, br, '<hr />')
  const expected = '<div><hr /></div>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceElement: nested replacement preserves siblings', () => {
  const src = '<a><b /><c /></a>'
  const all = scanAllElements(src)
  const b = all.find(e => e.tagName === 'b')!
  const out = replaceElement(src, b, '<X />')
  const expected = '<a><X /><c /></a>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

// ===========================================================================
// removeElement
// ===========================================================================

test('removeElement: removes single element', () => {
  const src = '<div><span>X</span>Y</div>'
  const all = scanAllElements(src)
  const span = all.find(e => e.tagName === 'span')!
  const out = removeElement(src, span)
  const expected = '<div>Y</div>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

// ===========================================================================
// insertBeforeElement / insertAfterElement
// ===========================================================================

test('insertBeforeElement: inserts without newline', () => {
  const src = '<div><x /></div>'
  const all = scanAllElements(src)
  const x = all.find(e => e.tagName === 'x')!
  const out = insertBeforeElement(src, x, '<!-- before -->')
  const expected = '<div><!-- before --><x /></div>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('insertAfterElement: inserts after close tag', () => {
  const src = '<a><b /></a>'
  const all = scanAllElements(src)
  const a = all.find(e => e.tagName === 'a')!
  const out = insertAfterElement(src, a, '<c />')
  const expected = '<a><b /></a><c />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

// ===========================================================================
// replaceAttribute
// ===========================================================================

test('replaceAttribute: replace with new value (keeps other attrs)', () => {
  const src = '<comp v-bind.sync="x" class="foo" />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const sync = comp.attrs.find(a => a.rawName === 'v-bind.sync')!
  const out = replaceAttribute(src, comp, sync, 'v-model:x="x"')
  const expected = '<comp v-model:x="x" class="foo" />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: remove (with other attr on both sides → 1 space)', () => {
  const src = '<comp a="1" bad b="2" />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const bad = findAttr(comp, 'bad')!
  const out = replaceAttribute(src, comp, bad, null)
  const expected = '<comp a="1" b="2" />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: remove (only attr on element → eat up to >)', () => {
  const src = '<comp bad />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const bad = findAttr(comp, 'bad')!
  const out = replaceAttribute(src, comp, bad, null)
  const expected = '<comp />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: remove (left has attr, right has none)', () => {
  const src = '<comp a="1" bad />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const bad = findAttr(comp, 'bad')!
  const out = replaceAttribute(src, comp, bad, null)
  const expected = '<comp a="1" />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: remove (left has none, right has attr)', () => {
  const src = '<comp bad b="2" />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const bad = findAttr(comp, 'bad')!
  const out = replaceAttribute(src, comp, bad, null)
  const expected = '<comp b="2" />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: remove (only this attr on self-closing)', () => {
  const src = '<comp inline-template />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const it = findAttr(comp, 'inline-template')!
  const out = replaceAttribute(src, comp, it, null)
  const expected = '<comp />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: remove (self-closing with other attrs)', () => {
  const src = '<comp inline-template class="x" />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const it = findAttr(comp, 'inline-template')!
  const out = replaceAttribute(src, comp, it, null)
  const expected = '<comp class="x" />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: replace with empty string treated as remove', () => {
  const src = '<comp a="1" bad b="2" />'
  const all = scanAllElements(src)
  const comp = all.find(e => e.tagName === 'comp')!
  const bad = findAttr(comp, 'bad')!
  const out = replaceAttribute(src, comp, bad, '')
  const expected = '<comp a="1" b="2" />'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceAttribute: replaces directive on <template>', () => {
  const src = '<template slot-scope="props">x</template>'
  const all = scanAllElements(src)
  const tpl = all.find(e => e.tagName === 'template')!
  const scope = findAttr(tpl, 'slot-scope')!
  const out = replaceAttribute(src, tpl, scope, '#default="props"')
  const expected = '<template #default="props">x</template>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

// ===========================================================================
// applyEdits
// ===========================================================================

test('applyEdits: single edit', () => {
  const src = 'hello world'
  const edits: TextEdit[] = [{ start: 6, end: 11, replacement: 'there' }]
  const out = applyEdits(src, edits)
  const expected = 'hello there'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('applyEdits: multiple edits processed right-to-left', () => {
  const src = 'AAA BBB CCC'
  const edits: TextEdit[] = [
    { start: 0, end: 3, replacement: 'X' },     // AAA → X
    { start: 4, end: 7, replacement: 'Y' },     // BBB → Y
    { start: 8, end: 11, replacement: 'Z' },    // CCC → Z
  ]
  const out = applyEdits(src, edits)
  const expected = 'X Y Z'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('applyEdits: skip empty edits', () => {
  const src = 'hello'
  const edits: TextEdit[] = [
    { start: 0, end: 0, replacement: '' },
    { start: 5, end: 5, replacement: '' },
  ]
  const out = applyEdits(src, edits)
  if (out !== src) throw new Error(`should be unchanged: ${out}`)
})

test('applyEdits: skip invalid (out of range)', () => {
  const src = 'hello'
  const edits: TextEdit[] = [{ start: 10, end: 20, replacement: 'X' }]
  const out = applyEdits(src, edits)
  if (out !== src) throw new Error(`should skip invalid: ${out}`)
})

test('applyEdits: insert (zero-width edit)', () => {
  const src = 'abc'
  const edits: TextEdit[] = [{ start: 1, end: 1, replacement: 'X' }]
  const out = applyEdits(src, edits)
  const expected = 'aXbc'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

// ===========================================================================
// replaceMatchingElements
// ===========================================================================

test('replaceMatchingElements: replace every <i> with <el-icon>', () => {
  const src = '<div><i class="x" /><span><i class="y" /></span></div>'
  const { out, hits } = replaceMatchingElements(
    src,
    (el) => (el.tagName === 'i' ? el : null),
    (el) => {
      const cls = findAttr(el, 'class')?.value as string
      return `<el-icon data-old="${cls}" />`
    },
  )
  if (hits.length !== 2) throw new Error(`expected 2 hits, got ${hits.length}`)
  const expected = '<div><el-icon data-old="x" /><span><el-icon data-old="y" /></span></div>'
  if (out !== expected) throw new Error(`got: ${out}\nwant: ${expected}`)
})

test('replaceMatchingElements: no matches → unchanged', () => {
  const src = '<div>no i tags</div>'
  const { out, hits } = replaceMatchingElements(
    src,
    (el) => (el.tagName === 'i' ? el : null),
    (el) => `<el-icon />`,
  )
  if (hits.length !== 0) throw new Error(`expected 0 hits`)
  if (out !== src) throw new Error(`should be unchanged`)
})

// ===========================================================================
// attrAbsStart / attrAbsEnd
// ===========================================================================

test('attrAbsStart/End: correct conversion for nested elements', () => {
  const src = '<outer><inner attr="x" /></outer>'
  const all = scanAllElements(src)
  const inner = all.find(e => e.tagName === 'inner')!
  const attr = findAttr(inner, 'attr')!
  const absStart = attrAbsStart(inner, attr)
  const absEnd = attrAbsEnd(inner, attr)
  if (src.slice(absStart, absEnd) !== 'attr="x"') {
    throw new Error(`slice: ${src.slice(absStart, absEnd)}`)
  }
})

// ===========================================================================
// Run
// ===========================================================================

for (const c of cases) {
  try {
    c.run()
    pass++
    console.log(`✅ ${c.name}`)
  } catch (e: any) {
    fail++
    console.log(`❌ ${c.name}`)
    console.log(`   ${e.message}`)
  }
}
console.log(`\n${pass}/${pass + fail} 通过`)
process.exit(fail === 0 ? 0 : 1)
