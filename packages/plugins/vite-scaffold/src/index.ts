/**
 * @vue-migrate/plugin-vite-scaffold
 *
 * iter-049a P0 #1/#2/#3: 当 package.json 已切到 vite 但项目根缺失 vite.config.js /
 * index.html / public/ 时, 自动生成这三样, 让 `npm run dev` / `npm run build` 至少能起.
 *
 * 同时 (P0 #5): 如果源项目同时残留 vue.config.js (Vue CLI 配置) 而 scripts 已切到 vite,
 * 删除 vue.config.js, 并标 manualReview 提示用户手改 webpack-only 配置 (mock-server 等).
 *
 * 触发条件 (任一):
 *   - package.json 的 scripts 里出现 `vite` / `vite build` / `vite xxx`
 *   - package.json 的 devDependencies 包含 `vite` 或 `@vitejs/plugin-vue`
 *   - 转换后 ctx.config.outDir 路径里有 `vite` 信号
 *
 * 行为 (analyze 阶段, 不走 per-file 流程):
 *   1) 写 vite.config.js  (如果缺失)
 *   2) 写 index.html       (如果缺失, 推断入口从 src/main.js 走, fallback /src/main.ts)
 *   3) 写 public/         (如果缺失, 拷贝原项目 public/* 到 outDir/public/)
 *   4) 写 public/favicon.ico (从原项目 public 拷, 缺失就跳过)
 *   5) 删除 vue.config.js (如果存在, 且脚本切到 vite)
 *   6) 删除 babel.config.js (如果存在, 且有 vite, 且没用 babel — P0 #4 babel 残留)
 *   7) 写 manualReview 让用户检查 webpack-only 配置
 *
 * 写入路径:
 *   - 有 ctx.config.outDir: 写到 outDir
 *   - 没有 outDir: 写到 ctx.root (in-place 模式, 慎用)
 *
 * 跨平台:
 *   - 用 node:fs/promises + node:path (PowerShell 路径用 \\ 也走得到)
 *
 * Priority: 99 (在 package-json 之后跑; package-json 先把 scripts 切到 vite, 我们再决定要不要 scaffold)
 */

import {
  readFile, writeFile, copyFile, mkdir, readdir, unlink, stat,
} from 'node:fs/promises'
import { dirname, join, resolve, basename, relative } from 'node:path'
import { existsSync } from 'node:fs'
import {
  registerPlugin,
  type TransformPlugin,
  type ProjectContext,
} from '@vue-migrate/core'

interface PkgJson {
  [key: string]: any
}

/** package.json 的 scripts 里是否包含 vite 调用 (vite / vite build / vite preview 等) */
function packageUsesVite(pkg: PkgJson): boolean {
  const scripts = pkg?.scripts
  if (!scripts || typeof scripts !== 'object') return false
  for (const v of Object.values(scripts)) {
    if (typeof v !== 'string') continue
    // 匹配 `vite` 单词 (不匹配 vitest)
    if (/(?:^|[\s|&;])(vite)(?:\s|$)/.test(v)) return true
  }
  return false
}

/** package.json devDependencies 是否包含 vite / @vitejs/plugin-vue */
function packageHasViteDeps(pkg: PkgJson): boolean {
  const dd = pkg?.devDependencies
  if (!dd || typeof dd !== 'object') return false
  return 'vite' in dd || '@vitejs/plugin-vue' in dd
}

/** 综合判断: 项目是否"在用 vite" */
function isViteProject(pkg: PkgJson | null): boolean {
  if (!pkg) return false
  return packageUsesVite(pkg) || packageHasViteDeps(pkg)
}

/** 标准 vite.config.js 模板 (Vite 5 + @vitejs/plugin-vue 5, 默认配 alias @ → src) */
function buildViteConfigTemplate(): string {
  return `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 9527,
    open: true,
    // 允许 vite 解析 .vue 文件中的 lang="ts" 块
    // (默认开启; 这里显式声明, 让 setup 里的 TS 不报 "Unknown identifier")
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
`
}

/** 标准 index.html 模板 (从 main.js 入口推断, 找不到 fallback) */
function buildIndexHtmlTemplate(mainEntry: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width,initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body>
    <noscript>
      <strong>We're sorry but this app doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
    </noscript>
    <div id="app"></div>
    <script type="module" src="${mainEntry}"></script>
  </body>
</html>
`
}

/** 推断项目主入口 (从 src/main.{js,ts} 找) */
async function inferMainEntry(root: string): Promise<{ entry: string; title: string }> {
  // 默认假设 src/main.js
  let entry = '/src/main.js'
  for (const candidate of ['src/main.js', 'src/main.ts', 'src/index.js', 'src/index.ts']) {
    if (existsSync(join(root, candidate))) {
      entry = '/' + candidate.replace(/\\/g, '/')
      break
    }
  }

  // 从 package.json name / description 推 title
  let title = 'Vue 3 App'
  const pkgPath = join(root, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
      title = pkg?.name || pkg?.description || title
    } catch {
      // ignore
    }
  }
  return { entry, title }
}

/** 递归 copy 目录, 跳过 node_modules / .git / dist */
async function copyDir(
  srcDir: string,
  destDir: string,
  skipNames: string[],
): Promise<{ files: number; errors: number }> {
  let files = 0
  let errors = 0

  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    await mkdir(dir.replace(srcDir, destDir), { recursive: true })
    for (const e of entries) {
      if (skipNames.includes(e.name)) continue
      const src = join(dir, e.name)
      const dest = src.replace(srcDir, destDir)
      if (e.isDirectory()) {
        await walk(src)
      } else if (e.isFile()) {
        try {
          await copyFile(src, dest)
          files++
        } catch (err: any) {
          errors++
          console.error(`[vite-scaffold] copy ${src} → ${dest} 失败: ${err.message}`)
        }
      }
    }
  }

  await walk(srcDir)
  return { files, errors }
}

async function existsFile(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isFile()
  } catch {
    return false
  }
}

async function existsDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p)
    return s.isDirectory()
  } catch {
    return false
  }
}

const plugin: TransformPlugin = {
  name: 'vite-scaffold',
  description:
    'Scaffold vite.config.js, index.html, public/ + favicon when package.json uses vite. Also deletes vue.config.js / babel.config.js (Vue CLI residue).',
  priority: 99,
  fileKinds: [],

  async analyze(ctx: ProjectContext): Promise<void> {
    // iter-050a fix: 读 outDir 的 package.json (已经被 package-json plugin 转换过)
    //  原项目是 vue 2 (vue-cli-service), 直接读 ctx.root 的 package.json 会 false
    //  改成: 优先 outDir, fallback ctx.root
    const outDir = ctx.config.outDir ? resolve(ctx.config.outDir) : ctx.root
    const candidatePkgPaths = [
      join(outDir, 'package.json'),
      join(ctx.root, 'package.json'),
    ]
    let pkg: PkgJson | null = null
    for (const p of candidatePkgPaths) {
      if (!existsSync(p)) continue
      try {
        pkg = JSON.parse(await readFile(p, 'utf-8'))
        break
      } catch {}
    }
    if (!pkg) return

    if (!isViteProject(pkg)) {
      // 没用 vite, 不动
      return
    }
    const writes: string[] = []
    const deletions: string[] = []
    const reviews: string[] = []

    // ============ 1) vite.config.js ============
    const viteConfigPath = join(outDir, 'vite.config.js')
    const hasViteConfig = await existsFile(viteConfigPath)
    if (!hasViteConfig) {
      if (!ctx.config.dryRun) {
        await mkdir(outDir, { recursive: true })
        await writeFile(viteConfigPath, buildViteConfigTemplate(), 'utf-8')
      }
      writes.push(`写 ${relative(ctx.root, viteConfigPath) || 'vite.config.js'}`)
    }

    // ============ 2) index.html ============
    const indexHtmlPath = join(outDir, 'index.html')
    const hasIndexHtml = await existsFile(indexHtmlPath)
    if (!hasIndexHtml) {
      const { entry, title } = await inferMainEntry(outDir)
      if (!ctx.config.dryRun) {
        await writeFile(indexHtmlPath, buildIndexHtmlTemplate(entry, title), 'utf-8')
      }
      writes.push(`写 index.html (entry: ${entry})`)
    }

    // ============ 3) public/ 目录 ============
    const publicDir = join(outDir, 'public')
    const hasPublic = await existsDir(publicDir)
    if (!hasPublic) {
      // 尝试从原项目根的 public/ 拷
      const srcPublic = join(ctx.root, 'public')
      if (await existsDir(srcPublic)) {
        if (!ctx.config.dryRun) {
          const r = await copyDir(srcPublic, publicDir, ['node_modules', '.git', 'dist'])
          writes.push(`拷 public/ (${r.files} 个文件, ${r.errors} 错)`)
        } else {
          writes.push(`[计划] 拷 public/`)
        }
      } else {
        // 原项目也没 public/ → 创建一个空的, 让 vite 不抱怨
        if (!ctx.config.dryRun) {
          await mkdir(publicDir, { recursive: true })
          // 加个 .gitkeep 防止有些工具删空目录
          await writeFile(join(publicDir, '.gitkeep'), '', 'utf-8')
        }
        writes.push(`建空 public/ (原项目也无 public/)`)
      }
    }

    // ============ 4) public/favicon.ico ============
    const faviconPath = join(publicDir, 'favicon.ico')
    if (!(await existsFile(faviconPath))) {
      // 优先从源 public/ 拷; 再从常见位置找; 都没就跳过
      const candidates = [
        join(ctx.root, 'public', 'favicon.ico'),
        join(ctx.root, 'src', 'assets', 'favicon.ico'),
        join(ctx.root, 'favicon.ico'),
      ]
      for (const c of candidates) {
        if (await existsFile(c)) {
          if (!ctx.config.dryRun) {
            await mkdir(publicDir, { recursive: true })
            await copyFile(c, faviconPath)
          }
          writes.push(`拷 ${basename(c)} → public/`)
          break
        }
      }
      // 都没就跳过, vite 会用默认 favicon (浏览器请求 404 但不阻塞 build)
    }

    // ============ 5) 删除 vue.config.js (Vue CLI 残留) ============
    const vueConfigPath = join(outDir, 'vue.config.js')
    if (await existsFile(vueConfigPath)) {
      if (!ctx.config.dryRun) {
        await unlink(vueConfigPath)
      }
    }
    // iter-050a fix: 总是从 ctx.files 移除 (防止 keepStructure 把源 vue.config.js 拷到 outDir)
    let vueCfgRemoved = 0
    for (const [k, f] of ctx.files.entries()) {
      if (f.path.endsWith('vue.config.js')) {
        ctx.files.delete(k)
        vueCfgRemoved++
      }
    }
    if (vueCfgRemoved > 0) {
      deletions.push('vue.config.js (Vue CLI 残留, vite 不读)')
      reviews.push(
        '删除 vue.config.js。源项目用的是 svg-sprite-loader + mock-server.before hook + splitChunks — 这些是 webpack 配置, vite 不兼容。' +
        '请手动迁移: (1) favicon 已拷到 public/; (2) mock-server 改 vite plugin 或写一个简易 vite mock middleware; ' +
        '(3) splitChunks 改 vite 的 build.rollupOptions.output.manualChunks。',
      )
    }

    // ============ 6) 删除 babel.config.js (Vue CLI preset 残留) ============
    const babelConfigPath = join(outDir, 'babel.config.js')
    if (await existsFile(babelConfigPath)) {
      // 检查内容是否引用 @vue/cli-plugin-babel/preset
      let babelContent = ''
      try { babelContent = await readFile(babelConfigPath, 'utf-8') } catch {}
      if (/@vue\/cli-plugin-babel\/preset/.test(babelContent)) {
        if (!ctx.config.dryRun) {
          await unlink(babelConfigPath)
        }
      }
    }
    // iter-050a fix: 总是从 ctx.files 移除 (不管 outDir 里是否已存在)
    let babelCfgRemoved = 0
    for (const [k, f] of ctx.files.entries()) {
      if (f.path.endsWith('babel.config.js')) {
        // 只删引用 @vue/cli-plugin-babel/preset 的 (vue CLI 残留)
        if (/@vue\/cli-plugin-babel\/preset/.test(f.source)) {
          ctx.files.delete(k)
          babelCfgRemoved++
        }
      }
    }
    if (babelCfgRemoved > 0) {
      deletions.push('babel.config.js (引用 @vue/cli-plugin-babel/preset, vite 不用 babel)')
      reviews.push('删除 babel.config.js (引用 @vue/cli-plugin-babel/preset, Vite 用 esbuild 原生 TS/JSX)。如需 babel 加 .babelrc + @vitejs/plugin-vue-jsx。')
    }

    // ============ 报告 ============
    if (writes.length === 0 && deletions.length === 0) return

    if (ctx.config.dryRun) {
      console.log(`\n[vite-scaffold] 计划改动 (${writes.length + deletions.length} 项):`)
      for (const w of writes) console.log(`  · 写: ${w}`)
      for (const d of deletions) console.log(`  · 删: ${d}`)
      for (const r of reviews) console.log(`  · ⚠ ${r}`)
      return
    }

    console.log(`\n[vite-scaffold] 已处理 ${writes.length + deletions.length} 项:`)
    for (const w of writes) console.log(`  · 写: ${w}`)
    for (const d of deletions) console.log(`  · 删: ${d}`)
    for (const r of reviews) console.log(`  · ⚠ ${r}`)
  },
}

registerPlugin(plugin)
export default plugin

// 暴露给单测
export const _testable = {
  packageUsesVite,
  packageHasViteDeps,
  isViteProject,
  buildViteConfigTemplate,
  buildIndexHtmlTemplate,
  inferMainEntry,
}
