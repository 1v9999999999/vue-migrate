// iter-125: html-entity-escape rule unit test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtmlEntitiesInTemplates } from '../rules/html-entity-escape.js'

function makeVue(source: string): any {
  const tplMatch = source.match(/<template>([\s\S]*?)<\/template>/)
  return {
    kind: 'vue',
    source,
    sfc: {
      template: tplMatch ? { content: tplMatch[1] } : null,
    },
  }
}

test('html-entity-escape: 模板里裸 & → &amp;', () => {
  const f = makeVue(`<template><a href="?a=1&b=2">x</a></template>`)
  const r = escapeHtmlEntitiesInTemplates(f)
  assert.equal(r.changed, true)
  assert.equal(r.count, 1)
  assert.ok(f.source.includes('?a=1&amp;b=2'), `expected &amp;, got: ${f.source}`)
})

test('html-entity-escape: 保留已有 entity (&amp; &lt; &gt; &quot; &apos;)', () => {
  const f = makeVue(`<template><a title="a &amp; b">&lt;c&gt; &quot;d&quot; &apos;e&apos;</a></template>`)
  const r = escapeHtmlEntitiesInTemplates(f)
  assert.equal(r.changed, false, '不应当改已转义的 entity')
  assert.equal(r.count, 0)
})

test('html-entity-escape: 保留数字 entity (&#NNN; &#xHHH;)', () => {
  const f = makeVue(`<template><p>&#65;&#x41;</p></template>`)
  const r = escapeHtmlEntitiesInTemplates(f)
  assert.equal(r.changed, false)
})

test('html-entity-escape: <script> 里的 & 不动', () => {
  // <script> 块里的 & 不该被转义 (JS 里的 & 是合法)
  const f = makeVue(`<template><div>x</div></template>\n<script>export default { data() { return { a: 1 && 2 } } }</script>`)
  const r = escapeHtmlEntitiesInTemplates(f)
  assert.equal(r.changed, false, 'JS 里的 && 是合法, 不该转义')
  assert.ok(f.source.includes('1 && 2'), '<script> 里的 && 应当保留')
})

test('html-entity-escape: <style> 里的 & 不动', () => {
  const f = makeVue(`<template><div>x</div></template>\n<style>.a { content: "a & b"; }</style>`)
  const r = escapeHtmlEntitiesInTemplates(f)
  assert.equal(r.changed, false, 'CSS 里的 & 不该转义')
})

test('html-entity-escape: <template> 里多个 & 都转义', () => {
  const f = makeVue(`<template><a href="?a=1&b=2&c=3">x</a></template>`)
  const r = escapeHtmlEntitiesInTemplates(f)
  assert.equal(r.changed, true)
  assert.equal(r.count, 2)
  assert.ok(f.source.includes('?a=1&amp;b=2&amp;c=3'))
})

test('html-entity-escape: 非 .vue 文件返回 noop', () => {
  const f = { kind: 'js', source: 'const a = 1 && 2', sfc: null }
  const r = escapeHtmlEntitiesInTemplates(f as any)
  assert.equal(r.changed, false)
  assert.equal(r.count, 0)
})

test('html-entity-escape: 同步更新 sfc.template.content', () => {
  const f = makeVue(`<template><a href="?a=1&b=2">x</a></template>`)
  escapeHtmlEntitiesInTemplates(f)
  assert.ok(f.sfc.template.content.includes('&amp;'), 'sfc.template.content 应当同步')
  assert.ok(!f.sfc.template.content.includes('&b=2'), '旧的裸 & 不应还在')
})
