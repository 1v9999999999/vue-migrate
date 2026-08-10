/**
 * Scanner —— 发现文件、分类、构建依赖图
 */

import fg from 'fast-glob'
import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve } from 'node:path'
import { parse as parseSfc } from '@vue/compiler-sfc'
import type { FileKind, FileNode, Lang, ProjectContext } from './types.js'

const SUPPORTED_EXTS = new Set(['.vue', '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'])

/** 入口文件特征 */
const ENTRY_PATTERNS = [/^main\.(js|ts)$/, /index\.(js|ts)$/, /app\.(js|ts)$/]

/** 识别文件类型 */
function detectKind(path: string): FileKind {
  if (path.endsWith('.vue')) return 'vue'
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return path.endsWith('.tsx') ? 'tsx' : 'ts'
  if (path.endsWith('.jsx')) return 'jsx'
  if (path.endsWith('.js') || path.endsWith('.mjs') || path.endsWith('.cjs')) return 'js'
  return 'unknown'
}

/** 从 SFC 描述符里识别 Vue2 特征 */
function detectVue2Features(source: string, descriptor: any): string[] {
  const features: string[] = []
  const features_def: Array<[RegExp, string]> = [
    [/\bVue\s*\.\s*extend\s*\(/, 'options-api'],
    [/\bnew\s+Vue\s*\(/, 'options-api'],
    [/\bdata\s*\(\s*\)\s*\{/, 'options-data'],
    [/\bcomputed\s*:\s*\{/, 'options-computed'],
    [/\bmethods\s*:\s*\{/, 'options-methods'],
    [/\bmounted\s*\(/, 'options-lifecycle'],
    [/\bbeforeDestroy\s*\(/, 'vue2-before-destroy'],
    [/\bdestroyed\s*\(/, 'vue2-destroyed'],
    [/\|\s*\w+\s*\}/, 'filters-in-template'],
    [/<slot\s+name=/, 'named-slot'],
    [/slot-scope\s*=/, 'slot-scope'],
    [/slot\s*=\s*"/, 'slot-attr'],
    [/\bnew\s+Vuex\.Store/, 'vuex'],
    [/\bnew\s+Router\s*\(/, 'vue-router-v3'],
    [/\$on\s*\(\s*['"`]/, 'event-bus'],
    [/\$children\b/, 'this-children'],
    [/\.\$scopedSlots\b/, 'scoped-slots'],
  ]

  for (const [pattern, name] of features_def) {
    if (pattern.test(source)) features.push(name)
  }
  return [...new Set(features)]
}

/** 从 script 源码里粗略提取 import 路径，构建依赖 */
function extractDependencies(source: string): string[] {
  const deps: string[] = []
  // 匹配 import ... from '...'
  const importRe = /(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]/g
  // 匹配 require('...')
  const requireRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  // 匹配动态 import('...')
  const dynamicRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  let m: RegExpExecArray | null
  while ((m = importRe.exec(source))) deps.push(m[1])
  while ((m = requireRe.exec(source))) deps.push(m[1])
  while ((m = dynamicRe.exec(source))) deps.push(m[1])
  return deps
}

export async function scanProject(ctx: ProjectContext): Promise<void> {
  const patterns = ['**/*.vue', '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx']
  const ignore = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**']

  const entries = await fg(patterns, {
    cwd: ctx.root,
    ignore,
    absolute: true,
    dot: false,
  })

  for (const absPath of entries) {
    const source = await readFile(absPath, 'utf-8')
    const kind = detectKind(absPath)
    const rel = relative(ctx.root, absPath).replace(/\\/g, '/')

    // iter-038-fix: Only files DIRECTLY in the project root (or `src/`) are
    // considered entry points. Nested `index.js` files (e.g. `store/index.js`,
    // `router/index.js`) are modules, not entry — they're imported by main.js.
    // Before this fix, every `index.js` anywhere in the tree was flagged
    // as an entry, causing vue3-entry plugin to spam
    // "Vue2 entry file 未找到 new Vue(...)" reviews on store/router.
    const isRootEntry = ENTRY_PATTERNS.some((p) => p.test(basename(absPath))) &&
      (rel === basename(rel) || /^(src|app)\//.test(rel))

    const fileNode: FileNode = {
      path: absPath,
      relativePath: rel,
      kind,
      source,
      metadata: {
        features: [],
        dependencies: extractDependencies(source),
        isEntry: isRootEntry,
      },
      transforms: [],
      changed: false,
    }

    // 解析 SFC
    if (kind === 'vue') {
      try {
        const { descriptor, errors } = parseSfc(source, { filename: absPath })
        if (errors.length === 0) {
          fileNode.sfc = {
            template: descriptor.template ? blockToInfo(descriptor.template) : null,
            script: descriptor.scriptSetup
              ? blockToInfo(descriptor.scriptSetup)
              : descriptor.script
                ? blockToInfo(descriptor.script)
                : null,
            style: descriptor.styles[0] ? blockToInfo(descriptor.styles[0]) : null,
            customBlocks: (descriptor.customBlocks || []).map(blockToInfo),
            descriptor,
          }
          fileNode.metadata.lang =
            (descriptor.scriptSetup?.lang as Lang) || (descriptor.script?.lang as Lang) || 'js'
        }
      } catch (e) {
        // SFC 解析失败，标记但不阻塞
        fileNode.metadata.features.push('parse-error')
      }
      fileNode.metadata.features = detectVue2Features(source, fileNode.sfc?.descriptor)
      // 根据 features 推断 Vue 版本
      if (fileNode.metadata.features.length > 0) {
        fileNode.metadata.vueVersion = 2
      } else if (/<script\s+setup>/.test(source)) {
        fileNode.metadata.vueVersion = 3
      }
    } else {
      // 普通 JS/TS：从源码特征判断
      if (/\bnew\s+Vue\s*\(/.test(source) || /\bVue\s*\.\s*extend\s*\(/.test(source)) {
        fileNode.metadata.vueVersion = 2
        fileNode.metadata.features.push('options-api')
      }
      if (/defineComponent\s*\(/.test(source)) {
        fileNode.metadata.vueVersion = 3
      }
    }

    ctx.files.set(absPath, fileNode)
  }

  ctx.stats.totalFiles = ctx.files.size

  // Build dep graph (only record relative-path imports)
  for (const file of ctx.files.values()) {
    const deps: string[] = []
    for (const dep of file.metadata.dependencies) {
      // 仅记录相对路径的依赖（./xxx, ../xxx）
      if (dep.startsWith('.')) {
        const abs = resolve(dirname(file.path), dep)
        deps.push(abs)
      }
    }
    ctx.dependencyGraph.set(file.path, deps)
  }

  // 跑插件的 scan 钩子
  for (const plugin of ctx.plugins) {
    if (plugin.scan) await plugin.scan(ctx)
  }
}

function blockToInfo(block: any) {
  return {
    content: block.content,
    lang: block.lang,
    src: block.src,
    attrs: block.attrs || {},
    loc: block.loc,
  }
}
