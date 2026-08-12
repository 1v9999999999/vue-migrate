// iter-125: amp-escape plugin unit test
import { test } from 'node:test'
import assert from 'node:assert/strict'

import plugin from '../index.js'
import { registerPlugin } from '@vue-migrate/core'

test('amp-escape: 注册成功', () => {
  let registered = false
  // registerPlugin 已经被 plugin import 时调过, 验证 plugin shape
  assert.equal(plugin.name, 'amp-escape')
  assert.equal(plugin.priority, 99)
  assert.deepEqual(plugin.fileKinds, ['vue'])
})

test('amp-escape: 模板里裸 & → &amp;', async () => {
  const file: any = {
    kind: 'vue',
    source: `<template><a href="?a=1&b=2">x</a></template>`,
    sfc: { template: { content: '<a href="?a=1&b=2">x</a>' } },
  }
  const ctx: any = {
    file,
    utils: { markChanged(msg: string) { (file as any).__changed = msg } },
  }
  await plugin.transform!(ctx)
  assert.ok(file.source.includes('?a=1&amp;b=2'))
})

test('amp-escape: 保留已有 entity', async () => {
  const file: any = {
    kind: 'vue',
    source: `<template><a title="a &amp; b">&lt;c&gt;</a></template>`,
    sfc: { template: { content: '<a title="a &amp; b">&lt;c&gt;</a>' } },
  }
  const ctx: any = { file, utils: { markChanged: () => {} } }
  await plugin.transform!(ctx)
  assert.ok(file.source.includes('&amp;'))
  assert.ok(file.source.includes('&lt;c&gt;'))
})

test('amp-escape: <script> 里的 & 不动', async () => {
  const file: any = {
    kind: 'vue',
    source: `<template>x</template>\n<script>const a = 1 && 2</script>`,
    sfc: { template: { content: 'x' } },
  }
  const ctx: any = { file, utils: { markChanged: () => {} } }
  await plugin.transform!(ctx)
  assert.ok(file.source.includes('1 && 2'), '<script> 里的 && 应当保留')
})

test('amp-escape: 多个 & 都转义', async () => {
  const file: any = {
    kind: 'vue',
    source: `<template><a href="?a=1&b=2&c=3">x</a></template>`,
    sfc: { template: { content: '' } },
  }
  const ctx: any = { file, utils: { markChanged: () => {} } }
  await plugin.transform!(ctx)
  assert.ok(file.source.includes('?a=1&amp;b=2&amp;c=3'))
})

test('amp-escape: 非 .vue 跳过', async () => {
  const file: any = {
    kind: 'js',
    source: `const a = 1 && 2`,
    sfc: null,
  }
  const ctx: any = { file, utils: { markChanged: () => {} } }
  await plugin.transform!(ctx)
  assert.equal(file.source, `const a = 1 && 2`, 'JS 里的 && 不该动')
})
