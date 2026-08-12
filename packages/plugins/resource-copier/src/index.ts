/**
 * @vue-migrate/plugin-resource-copier
 *
 * iter-050a P0 #6/#7/#8: 扫项目文件中的"非代码资产"引用, 复制到 outDir。
 *
 * 解决问题 (全部 P0 build blocker):
 *   #6 src/views/dashboard/admin/components/TodoList/index.scss 缺失
 *      (<style lang="scss">@import './index.scss';</style> 引用的 scss 找不到)
 *   #7 src/directive/waves/waves.css 缺失
 *      (directive/waves/waves.js 里 `import './waves.css'`)
 *   #8 src/icons/svg/*.svg 47 个 svg 全缺
 *      (icons/index.js 里 `import.meta.glob('./svg/*.svg')` 返回空数组, 全部图标空白)
 *
 * 扫描方式 (扫每个 file 的 source, 不重 IO):
 *   1) `<style>` 块里的 `@import './foo.scss'`  → 解析成相对 file 路径
 *   2) `<script>` 块里的 `import './foo.css'`   → 解析成相对 file 路径
 *   3) `import.meta.glob('./svg/*.svg')`        → glob 形式, 列出所有匹配文件
 *   4) `import.meta.globEager` / `import.meta.globRaw` 同样
 *
 * 复制策略:
 *   - 只复制 outDir 缺的文件 (存在则不覆盖)
 *   - 写到 outDir 镜像的相对路径
 *   - 从 ctx.root (源项目) 读, ctx.config.outDir ?? ctx.root 写
 *   - dryRun 时只 print 不写
 *   - 失败的 file 不抛, 累计 errors 计数
 *
 * Priority: 50 (在 package-json / vite-scaffold 之后, 其他 plugin 之前)
 */

import { readFile, copyFile, mkdir } from 'node:fs/promises'
import { dirname, join, relative, resolve, basename, extname, isAbsolute } from 'node:path'
import { existsSync, statSync, readdirSync } from 'node:fs'
import {
  registerPlugin,
  type TransformPlugin,
  type ProjectContext,
} from '@vue-migrate/core'

interface ImportedAsset {
  /** 相对 file 的路径 (如 ./waves.css, ./index.scss) */
  rel: string
  /** 引用它的 file path (用于解析相对路径) */
  fromFile: string
  /** 引用形式: style-import, script-import, glob */
  kind: 'style-import' | 'script-import' | 'glob'
  /** glob 模式 (kind === 'glob' 时) */
  globPattern?: string
}

interface CopyResult {
  copied: string[]
  skipped: string[]
  errors: string[]
}

/**
 * 1) 扫 <style> 块的 @import 引用
 *  - 匹配: @import './foo.scss'; @import "./foo.css";
 *  - 匹配: @import url('./foo.css');
 */
function scanStyleImports(source: string): string[] {
  const result: string[] = []
  // 匹配 @import 'path' / "path" / url('path') - 不匹配 '~package/...' (那是 npm 包)
  const re = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const p = m[1]
    // 跳过 ~package/...  (npm alias)
    if (p.startsWith('~')) continue
    // 跳过 node_modules-like 别名 (e.g. '@/styles/...' 不是文件 import)
    if (p.startsWith('@/')) continue
    result.push(p)
  }
  return result
}

/**
 * 2) 扫 <script> 块的静态 import 引用
 *  - 匹配: import './foo.css' / import './waves.css'
 *  - 不匹配: import x from '...' (带 binding)
 */
function scanScriptStaticImports(source: string): string[] {
  const result: string[] = []
  // 匹配: import 'path' / import "path"
  // 关键: 必须是独立 import (没有 from), 且字符串是 .css / .scss / .svg / 静态资产
  const re = /^\s*import\s+['"]([^'"]+)['"]\s*;?$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const p = m[1]
    if (p.startsWith('~') || p.startsWith('@/')) continue
    // 只关心资产文件
    if (!/\.(css|scss|sass|less|styl|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$/i.test(p)) continue
    result.push(p)
  }
  return result
}

/**
 * 3) 扫 import.meta.glob 引用
 *  - 匹配: import.meta.glob('./svg/*.svg')
 *  - 匹配: import.meta.globEager('./svg/*.svg')
 *  - 匹配: import.meta.globRaw('./svg/*.svg')
 */
function scanImportMetaGlob(source: string): { pattern: string; rel: string }[] {
  const result: { pattern: string; rel: string }[] = []
  // import.meta.glob(?:Eager|Raw)?\s*\(\s*['"]([^'"]+)['"]
  const re = /import\.meta\.glob(?:Eager|Raw)?\s*\(\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const p = m[1]
    if (p.startsWith('~') || p.startsWith('@/')) continue
    result.push({ pattern: p, rel: p })
  }
  return result
}

/**
 * 3b) 扫 require.context (webpack 残留, 但 Vite 项目也常出现)
 *  - 匹配: require.context('./svg', false, /\.svg$/)
 *  - 解析 dir + ext, 列 dir 下所有 ext 文件
 */
function scanRequireContext(source: string): { dir: string; ext: string }[] {
  const result: { dir: string; ext: string }[] = []
  // 注意: 形如 require.context('./svg', false, /\.svg$/)  末尾是 /)
  //       所以 [^/]+ 之后是 /, 但 /) 整体有 ) 在 / 之后, 贪婪会出错
  //       改用非贪婪 + 显式 /) 锚定
  const re = /require\.context\s*\(\s*['"]([^'"]+)['"]\s*,\s*(?:true|false)\s*,\s*(\/[^/)]+\/)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const dir = m[1]
    const extRe = m[2]
    // extRe 形如 "/\.svg$/" → 提取 ext (source 里 /\. 是 \ + .)
    // 包含 js/ts 因为有些项目 require.context 加载 .js 模块
    const extMatch = extRe.match(/\\\.(svg|css|scss|sass|less|styl|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|js|ts|jsx|tsx)/)
    if (!extMatch) continue
    if (dir.startsWith('~') || dir.startsWith('@/')) continue
    result.push({ dir, ext: '.' + extMatch[1] })
  }
  return result
}

/**
 * 解析相对路径: 相对于 fromFile 的 dir
 * 例: fromFile = '/x/src/directive/waves/waves.js', rel = './waves.css'
 *   → '/x/src/directive/waves/waves.css'
 */
function resolveRelative(fromFile: string, rel: string): string {
  if (isAbsolute(rel)) return rel
  return resolve(dirname(fromFile), rel)
}

/**
 * 把 source 里的 glob pattern 翻译成实际文件列表
 * 简单实现: 只支持 * 通配符 (一个), 不支持 **
 * 例: './svg/*.svg' (相对 dir) → 列出 dir/svg/*.svg
 * 例: './*.svg' (相对 dir) → 列出 dir/*.svg
 */
function expandGlob(dir: string, pattern: string): string[] {
  // 通用: 匹配 'prefix*ext' 其中 prefix 可以包含 /
  // ./svg/*.svg → prefix='svg/', ext='.svg'
  // ./*.svg    → prefix='',     ext='.svg'
  const m = pattern.match(/^\.\/(.*)\*(\.[^/]+)$/)
  if (!m) return []
  const prefix = m[1]
  const ext = m[2]
  const targetDir = join(dir, prefix)
  try {
    const entries = readdirSync(targetDir)
    return entries
      .filter((n: string) => n.endsWith(ext))
      .map((n: string) => join(targetDir, n))
  } catch {
    return []
  }
}

/** iter-125: 递归 walk 一个 dir, 返回所有 file (递归, skip node_modules/dist/.git) */
function walkAll(root: string): string[] {
  const out: string[] = []
  function walk(dir: string) {
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const e of entries) {
      // skip noise
      if (e === 'node_modules' || e === 'dist' || e === '.git' || e === '.nuxt' || e === '.next') continue
      const p = join(dir, e)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) {
        walk(p)
      } else if (st.isFile()) {
        out.push(p)
      }
    }
  }
  walk(root)
  return out
}

async function copyIfMissing(src: string, dest: string, dryRun: boolean): Promise<'copied' | 'skipped' | 'planned' | 'error'> {
  try {
    if (existsSync(dest)) return 'skipped'
    if (dryRun) return 'planned'
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(src, dest)
    return 'copied'
  } catch {
    return 'error'
  }
}

const plugin: TransformPlugin = {
  name: 'resource-copier',
  description:
    'Scan source files for style @import / script static imports / import.meta.glob, then copy referenced assets (scss, css, svg, etc.) to outDir. Solves P0 #6/#7/#8 build blockers.',
  priority: 50,
  fileKinds: [],

  async analyze(ctx: ProjectContext): Promise<void> {
    if (!ctx.config.outDir) {
      // in-place 模式, 没必要复制
      return
    }
    const outDir = resolve(ctx.config.outDir)
    const dryRun = !!ctx.config.dryRun
    const result: CopyResult = { copied: [], skipped: [], errors: [] }

    for (const file of ctx.files.values()) {
      const source = file.source
      if (!source) continue

      // 1) style @import
      for (const rel of scanStyleImports(source)) {
        const src = resolveRelative(file.path, rel)
        if (!existsSync(src)) {
          // 源都没, 跳过 (不是我们的错)
          continue
        }
        // outDir 里 file.path 是相对的, 算 dest
        const fileRel = relative(ctx.root, file.path)
        const srcRel = relative(ctx.root, src)
        const dest = join(outDir, srcRel)
        const r = await copyIfMissing(src, dest, dryRun)
        if (r === 'copied' || r === 'planned') result.copied.push(dest)
        else if (r === 'skipped') result.skipped.push(dest)
        else result.errors.push(dest)
      }

      // 2) script static import (for .css/.svg/etc)
      for (const rel of scanScriptStaticImports(source)) {
        const src = resolveRelative(file.path, rel)
        if (!existsSync(src)) continue
        const srcRel = relative(ctx.root, src)
        const dest = join(outDir, srcRel)
        const r = await copyIfMissing(src, dest, dryRun)
        if (r === 'copied' || r === 'planned') result.copied.push(dest)
        else if (r === 'skipped') result.skipped.push(dest)
        else result.errors.push(dest)
      }

      // 3) import.meta.glob
      for (const { pattern } of scanImportMetaGlob(source)) {
        const dir = dirname(file.path)
        const matched = expandGlob(dir, pattern)
        for (const src of matched) {
          if (!existsSync(src)) continue
          const srcRel = relative(ctx.root, src)
          const dest = join(outDir, srcRel)
          const r = await copyIfMissing(src, dest, dryRun)
          if (r === 'copied' || r === 'planned') result.copied.push(dest)
          else if (r === 'skipped') result.skipped.push(dest)
          else result.errors.push(dest)
        }
      }

      // 3b) require.context (webpack 残留但 src 仍引用)
      for (const { dir: relDir, ext } of scanRequireContext(source)) {
        const srcDir = resolveRelative(file.path, relDir)
        if (!existsSync(srcDir)) continue
        try {
          const entries = readdirSync(srcDir)
          for (const e of entries) {
            if (!e.endsWith(ext)) continue
            const src = join(srcDir, e)
            const srcRel = relative(ctx.root, src)
            const dest = join(outDir, srcRel)
            const r = await copyIfMissing(src, dest, dryRun)
            if (r === 'copied' || r === 'planned') result.copied.push(dest)
            else if (r === 'skipped') result.skipped.push(dest)
            else result.errors.push(dest)
          }
        } catch {}
      }
    }

    // iter-125: 扫整个 src 目录, 找所有未通过 plugin 处理的 .js/.ts/.css/.scss/.svg 等静态资源
    //   - .js/.ts/.mjs: utility api/utils/store/directive/filter (Vue 2 项目里通常不通过 import 引用, 但产物必须存在)
    //   - .css/.scss/.sass/.less/.styl: 静态样式 (如 src/styles/index.scss 被 main.js @import)
    //   - .svg/.png/.jpg/.jpeg/.gif/.webp/.ico: 静态资源 (icons/svg/* 等)
    //   - .woff/.woff2/.ttf/.eot: 字体
    //   找 ctx.files 里没记录的 file, 直接 copy 到 outDir.
    const ctxFiles = new Set<string>()
    for (const f of ctx.files.values()) {
      ctxFiles.add(f.path)
    }
    const allSrcFiles = walkAll(ctx.root)
    const STATIC_EXT_RE = /\.(css|sass|scss|less|styl|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|mp3|mp4|webm|wasm)$/i
    for (const f of allSrcFiles) {
      if (ctxFiles.has(f)) continue  // 已被 plugin 处理 (会自己写)
      const lower = f.toLowerCase()
      const isCode = lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.mjs') || lower.endsWith('.cjs')
      const isStatic = STATIC_EXT_RE.test(lower)
      if (!isCode && !isStatic) continue  // 跳过 .vue / .json / .md / 其它
      // Skip node_modules, dist, test files
      if (f.includes('node_modules') || f.includes('__tests__') || f.includes('dist')) continue
      // Skip test files
      if (/\.(spec|test)\.[jt]sx?$/.test(f)) continue
      const srcRel = relative(ctx.root, f)
      const dest = join(outDir, srcRel)
      const r = await copyIfMissing(f, dest, dryRun)
      if (r === 'copied' || r === 'planned') result.copied.push(dest)
      else if (r === 'skipped') result.skipped.push(dest)
      else result.errors.push(dest)
    }

    // 报告
    if (result.copied.length === 0 && result.errors.length === 0) {
      return
    }
    if (ctx.config.dryRun) {
      console.log(`\n[resource-copier] 计划复制 ${result.copied.length} 个资产 (跳过 ${result.skipped.length}, 错 ${result.errors.length}):`)
      for (const c of result.copied.slice(0, 20)) {
        console.log(`  · 写 ${relative(outDir, c)}`)
      }
      if (result.copied.length > 20) {
        console.log(`  · ... 还有 ${result.copied.length - 20} 个`)
      }
      return
    }
    console.log(`\n[resource-copier] 已处理 (复制 ${result.copied.length}, 跳过 ${result.skipped.length}, 错 ${result.errors.length}):`)
    for (const c of result.copied.slice(0, 20)) {
      console.log(`  · 写 ${relative(outDir, c)}`)
    }
    if (result.copied.length > 20) {
      console.log(`  · ... 还有 ${result.copied.length - 20} 个`)
    }
    if (result.errors.length > 0) {
      for (const e of result.errors) console.log(`  · ✗ ${e}`)
    }
  },
}

registerPlugin(plugin)
export default plugin

// 暴露给单测
export const _testable = {
  scanStyleImports,
  scanScriptStaticImports,
  scanImportMetaGlob,
  scanRequireContext,
  resolveRelative,
  expandGlob,
}
