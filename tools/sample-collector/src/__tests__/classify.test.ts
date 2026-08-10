/**
 * tools/sample-collector/src/__tests__/classify.test.ts
 *
 * Pure unit tests for the classifier. The whole point of classify.ts is to
 * be hermetic — given a package.json + a list of file paths, it returns a
 * `SampleEntry`. We never touch disk, never hit GitHub.
 *
 * Run with:
 *   tsx --test tools/sample-collector/src/__tests__/classify.test.ts
 */

import { test, describe } from 'node:test'
import { strict as assert } from 'node:assert'

import { classify, type SampleEntry } from '../classify.js'

const baseInput = {
  org: 'acme',
  repo: 'vue2-app',
  shortSha: 'abc1234',
  localPath: 'D:\\Projects\\NB_EST\\qiuzhi\\vue-migrate\\samples\\acme__vue2-app__abc1234',
  collectedAt: '2024-01-01T00:00:00.000Z',
}

describe('classify — framework detection', () => {
  test('element-ui wins over other UI libs', () => {
    const pkg = JSON.stringify({
      dependencies: { 'element-ui': '^1.2.9', vant: '^4.0.0' },
    })
    const out = classify({
      ...baseInput,
      packageJsonText: pkg,
      filePaths: ['src/main.js'],
    })
    assert.equal(out.framework, 'element-ui')
  })

  test('vant (only) is detected', () => {
    const pkg = JSON.stringify({ dependencies: { vant: '^4.0.0' } })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.framework, 'vant')
  })

  test('iview / view-design alias is detected', () => {
    const pkg = JSON.stringify({ dependencies: { 'view-design': '^4.0.0' } })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.framework, 'iview')
  })

  test('no UI lib → "none"', () => {
    const out = classify({ ...baseInput, packageJsonText: '{}', filePaths: [] })
    assert.equal(out.framework, 'none')
  })

  test('element-ui in devDependencies is still detected', () => {
    const pkg = JSON.stringify({ devDependencies: { 'element-ui': '^2.0.0' } })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.framework, 'element-ui')
  })
})

describe('classify — state management', () => {
  test('pinia wins over vuex when both present', () => {
    const pkg = JSON.stringify({
      dependencies: { vuex: '^3.0.0', pinia: '^2.0.0' },
    })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.state, 'pinia')
  })

  test('vuex alone is detected', () => {
    const pkg = JSON.stringify({ dependencies: { vuex: '^3.0.0' } })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.state, 'vuex')
  })

  test('no state lib → "none"', () => {
    const out = classify({ ...baseInput, packageJsonText: '{}', filePaths: [] })
    assert.equal(out.state, 'none')
  })
})

describe('classify — router', () => {
  test('vue-router dependency → true', () => {
    const pkg = JSON.stringify({ dependencies: { 'vue-router': '^3.0.0' } })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.router, true)
  })

  test('hand-rolled router/index.js → true even without dep', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: ['src/router/index.js'],
    })
    assert.equal(out.router, true)
  })

  test('hand-rolled src/router/index.ts → true', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: ['src/router/index.ts'],
    })
    assert.equal(out.router, true)
  })

  test('no router dep, no router file → false', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: ['src/main.js', 'src/App.vue'],
    })
    assert.equal(out.router, false)
  })
})

describe('classify — typescript', () => {
  test('typescript devDependency → true', () => {
    const pkg = JSON.stringify({ devDependencies: { typescript: '^4.0.0' } })
    const out = classify({ ...baseInput, packageJsonText: pkg, filePaths: [] })
    assert.equal(out.typescript, true)
  })

  test('.ts file present → true even without dep', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: ['src/main.ts', 'src/App.vue'],
    })
    assert.equal(out.typescript, true)
  })

  test('plain Vue2 JS project → false', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{"dependencies":{"vue":"^2.6.10"}}',
      filePaths: ['src/main.js', 'src/App.vue', 'package.json'],
    })
    assert.equal(out.typescript, false)
  })
})

describe('classify — size bucketing', () => {
  test('repoSizeKB < 100 → small', () => {
    const out = classify({ ...baseInput, packageJsonText: '{}', filePaths: [], repoSizeKB: 50 })
    assert.equal(out.size, 'small')
  })

  test('repoSizeKB in [100, 1024) → medium', () => {
    const out = classify({ ...baseInput, packageJsonText: '{}', filePaths: [], repoSizeKB: 500 })
    assert.equal(out.size, 'medium')
  })

  test('repoSizeKB >= 1024 → large', () => {
    const out = classify({ ...baseInput, packageJsonText: '{}', filePaths: [], repoSizeKB: 2048 })
    assert.equal(out.size, 'large')
  })

  test('falls back to totalBytes when repoSizeKB missing', () => {
    // 1.5 MB
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: ['x'],
      totalBytes: 1.5 * 1024 * 1024,
    })
    assert.equal(out.size, 'large')
  })

  test('falls back to totalBytes for medium range', () => {
    // 500 KB
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: ['x'],
      totalBytes: 500 * 1024,
    })
    assert.equal(out.size, 'medium')
  })
})

describe('classify — file counts', () => {
  test('counts .vue files only', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: [
        'src/App.vue',
        'src/views/Home.vue',
        'src/views/About.vue',
        'src/main.js',
        'src/router/index.js',
        'package.json',
        'README.md',
      ],
    })
    assert.equal(out.fileCount, 7)
    assert.equal(out.vueFileCount, 3)
  })

  test('empty file list → 0/0', () => {
    const out = classify({ ...baseInput, packageJsonText: '{}', filePaths: [] })
    assert.equal(out.fileCount, 0)
    assert.equal(out.vueFileCount, 0)
  })

  test('vuex-manage-master profile (real-world regression)', () => {
    // Mirrors examples/vue2-manage-master/package.json — element-ui + vuex +
    // vue-router, no TS, large-ish on disk.
    const pkg = JSON.stringify({
      dependencies: {
        'element-ui': '^1.2.9',
        vue: '^2.2.6',
        'vue-router': '^2.3.1',
        vuex: '^2.3.1',
      },
      devDependencies: { 'vue-template-compiler': '^2.2.6' },
    })
    const filePaths = [
      'src/main.js',
      'src/App.vue',
      'src/router/index.js',
      'src/store/index.js',
      'src/views/Login.vue',
      'src/views/Home.vue',
      'src/components/HeadTop.vue',
      'package.json',
    ]
    const out: SampleEntry = classify({
      ...baseInput,
      packageJsonText: pkg,
      filePaths,
      totalBytes: 2.1 * 1024 * 1024, // ~2.1 MB on disk
      stars: 0,
    })
    assert.equal(out.framework, 'element-ui')
    assert.equal(out.state, 'vuex')
    assert.equal(out.router, true)
    assert.equal(out.typescript, false)
    assert.equal(out.size, 'large')
    assert.equal(out.stars, 0)
    assert.equal(out.vueFileCount, 4) // App, Login, Home, HeadTop
    assert.equal(out.fileCount, 8)
  })
})

describe('classify — robustness', () => {
  test('null package.json text does not throw', () => {
    const out = classify({ ...baseInput, packageJsonText: null, filePaths: ['src/main.js'] })
    assert.equal(out.framework, 'none')
    assert.equal(out.state, 'none')
    assert.equal(out.router, false)
    assert.equal(out.typescript, false)
  })

  test('malformed package.json is treated as "no info"', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{ this is not json',
      filePaths: ['src/main.js'],
    })
    assert.equal(out.framework, 'none')
  })

  test('missing package.json + empty paths → all "none"/false', () => {
    const out = classify({ ...baseInput, filePaths: [] })
    assert.equal(out.framework, 'none')
    assert.equal(out.state, 'none')
    assert.equal(out.router, false)
    assert.equal(out.typescript, false)
    assert.equal(out.size, 'small') // 0 bytes < 100KB
  })

  test('collectedAt is honored when provided', () => {
    const out = classify({
      ...baseInput,
      packageJsonText: '{}',
      filePaths: [],
      collectedAt: '2023-06-15T12:34:56.000Z',
    })
    assert.equal(out.collectedAt, '2023-06-15T12:34:56.000Z')
  })
})
