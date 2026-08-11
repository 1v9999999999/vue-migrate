/**
 * @vue-migrate/plugin-package-json
 *
 * 把项目的 package.json 从 Vue 2 时代（vue-cli-service + vuex + element-ui + vue-router 3 + vue-template-compiler）
 * 转换到 Vue 3 时代（vite + pinia + element-plus + vue-router 4 + @vue/compiler-sfc）。
 *
 * 改动：
 *   PJ.1  dependencies / devDependencies  按 DEP_MAP 重命名 / 删除 / 升版本
 *   PJ.2  scripts                       `serve`→`dev`、`vue-cli-service X`→vite 等价命令
 *   PJ.3  devDependencies 注入 vite + @vitejs/plugin-vue（如果原 devDep 没有）
 *   PJ.4  iter-048a F5: src/styles/ 目录自动复制 — main.js / settings.js 引用 styles 目录
 *        但 scanner 不会扫 .scss/.css。如果原项目有 src/styles/，我们把整个目录
 *        copy 到 outDir。缺失的 styles 文件会导致 build 即挂（P0 build blocker）。
 *
 * 实现策略：
 *   - 用 `analyze` 钩子（跨文件分析阶段）一次性处理 + 写盘
 *   - 直接调 fs.writeFile/copyFile，不走 ctx.files 流程（package.json / styles 不会被 scanner 扫到）
 *   - 写到 ctx.config.outDir ?? ctx.root
 *   - dry-run 时跳过写盘
 *
 * Priority: 100（最高，最后跑，让 vue3-entry / vue-router-v4 / vuex-pinia / elementui
 *                  先完成所有代码侧转换，这样 package.json 里 vuex 已经被 pinia 替代，
 *                  我们再处理包文件不会跟代码侧冲突）
 */

import { readFile, writeFile, copyFile, mkdir, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { existsSync, statSync } from 'node:fs'
import {
  registerPlugin,
  type TransformPlugin,
  type ProjectContext,
} from '@vue-migrate/core'
import { applyDepMap } from './rules/dependencies.js'
import { applyDevDepMap } from './rules/devDependencies.js'
import { applyScriptMap } from './rules/scripts.js'

interface PkgJson {
  [key: string]: any
}

/**
 * iter-050a: P0 #4 — 扫所有 file 找 import 引用了 @element-plus/icons-vue, 自动注入到 dependencies
 *  - 不依赖 package.json 里是否有 element-plus (一些项目可能没装但 import 了, 我们仍注入)
 *  - 扫 import 语句 + import.meta.glob 模式
 *  - 用 ctx.files 缓存(已经 parse 过 source), 不重新 IO
 *
 *  注意: 用 String.includes 而不是 /.../g, 避免全局 regex lastIndex 跨调用残留
 */
function projectImportsElementPlusIcons(ctx: ProjectContext): boolean {
  for (const file of ctx.files.values()) {
    if (!file.source) continue
    if (file.source.includes('@element-plus/icons-vue')) {
      return true
    }
  }
  return false
}

function isVue2Project(pkg: PkgJson): boolean {
  const vue = pkg?.dependencies?.['vue']
  if (typeof vue !== 'string') return false
  return /^[\^~]?2\./.test(vue) || /^2\./.test(vue)
}

/**
 * iter-050a P0 #4: 项目迁移到 element-plus 后, 需要 @element-plus/icons-vue (用于 el-icon 组件)
 *  - 源项目是 element-ui (没这个包), 转换后才有 element-plus
 *  - transform 阶段会把 el-icon-name 改成 <el-icon><Name /></el-icon>, Name 来自 icons-vue
 *  - 所以: 一旦 deps 有 element-plus, 就注入 icons-vue
 *  - 这个比 projectImportsElementPlusIcons 更稳 (后者看不到 transform 后的代码)
 */
function projectNeedsElementPlusIcons(pkg: PkgJson): boolean {
  if (!pkg.dependencies) return false
  return 'element-plus' in pkg.dependencies
}

function transformPackageJson(pkg: PkgJson): { changes: string[]; changed: boolean } {
  const allChanges: string[] = []

  // PJ.1 + PJ.3: dependencies & devDependencies
  if (pkg.dependencies) {
    const r = applyDepMap(pkg.dependencies)
    pkg.dependencies = r.deps
    allChanges.push(...r.changes)
  }
  if (pkg.devDependencies) {
    const r = applyDevDepMap(pkg.devDependencies, true)
    pkg.devDependencies = r.deps
    allChanges.push(...r.changes)
  } else {
    // 没有 devDependencies 时也注入
    const r = applyDevDepMap({}, true)
    if (r.deps && Object.keys(r.deps).length > 0) {
      pkg.devDependencies = r.deps
      allChanges.push(...r.changes)
    }
  }

  // PJ.2: scripts
  if (pkg.scripts) {
    const r = applyScriptMap(pkg.scripts)
    pkg.scripts = r.scripts
    allChanges.push(...r.changes)
  }

  return { changes: allChanges, changed: allChanges.length > 0 }
}

/**
 * iter-048a F5: 递归复制目录
 * - 跳过 node_modules / .git / dist
 * - 出错不抛,只 console.error (best-effort)
 */
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
          console.error(`[package-json] copy ${src} → ${dest} 失败: ${err.message}`)
        }
      }
    }
  }

  await walk(srcDir)
  return { files, errors }
}

const plugin: TransformPlugin = {
  name: 'package-json',
  description:
    'Migrate package.json from Vue 2 (vue-cli-service, vuex, element-ui, vue-router 3) to Vue 3 (vite, pinia, element-plus, vue-router 4, @vue/compiler-sfc). Also copies non-code assets (src/styles/) to outDir.',
  priority: 100,
  fileKinds: [],  // 不走 per-file 流程

  async analyze(ctx: ProjectContext): Promise<void> {
    const pkgPath = join(ctx.root, 'package.json')
    if (!existsSync(pkgPath)) {
      return  // 没有 package.json 就跳过
    }

    let original: string
    try {
      original = await readFile(pkgPath, 'utf-8')
    } catch (e: any) {
      console.error(`[package-json] 读取 ${pkgPath} 失败: ${e.message}`)
      return
    }

    let pkg: PkgJson
    try {
      pkg = JSON.parse(original)
    } catch (e: any) {
      console.error(`[package-json] 解析 ${pkgPath} 失败: ${e.message}`)
      return
    }

    if (!isVue2Project(pkg)) {
      // 不是 Vue 2 项目，不动
      return
    }

    const result = transformPackageJson(pkg)

    // iter-050a P0 #4: 注入 @element-plus/icons-vue (在 transform 之后, 因为 transform 会重写 pkg.dependencies)
    const iconsDepsAdded: string[] = []
    if (projectNeedsElementPlusIcons(pkg) || projectImportsElementPlusIcons(ctx)) {
      if (!pkg.dependencies) pkg.dependencies = {}
      if (!pkg.dependencies['@element-plus/icons-vue']) {
        pkg.dependencies['@element-plus/icons-vue'] = '^2.3.0'
        iconsDepsAdded.push(`@element-plus/icons-vue@^2.3.0`)
      }
    }
    // F5: 即使 package.json 没改,也可能要 copy styles
    const stylesCopied = await this_maybeCopyStyles(ctx)

    if (!result.changed && stylesCopied.files === 0 && iconsDepsAdded.length === 0) {
      return
    }

    // 序列化（保留 2 空格缩进 + 尾部 newline）
    const out = JSON.stringify(pkg, null, 2) + '\n'

    // dry-run: 只打印不写
    if (ctx.config.dryRun) {
      console.log(`\n[package-json] 计划改动 (${result.changes.length} 项):`)
      for (const c of result.changes) console.log(`  · ${c}`)
      if (stylesCopied.files > 0) {
        console.log(`  · [F5] 计划复制 ${stylesCopied.files} 个 styles 文件到 outDir`)
      }
      for (const d of iconsDepsAdded) console.log(`  · [P0#4] 注入 dependencies.${d}`)
      return
    }

    // 写到 outDir（如果指定）或 root
    const outDir = ctx.config.outDir ? resolve(ctx.config.outDir) : ctx.root
    const target = join(outDir, 'package.json')
    await mkdir(dirname(target), { recursive: true })

    // 备份（如果启用且是原地模式）
    if (ctx.config.backup && !ctx.config.outDir) {
      const backupDir = join(ctx.root, '.vue-migrate-backup', String(Date.now()))
      const backupPath = join(backupDir, 'package.json')
      await mkdir(backupDir, { recursive: true })
      await copyFile(pkgPath, backupPath)
    }

    await writeFile(target, out, 'utf-8')

    // 记录到任意一个 file 的 transforms 里以便报告
    // 因为 package.json 不在 ctx.files 里, 我们 console.log 输出
    console.log(`\n[package-json] 已写 ${target} (${result.changes.length} 项改动):`)
    for (const c of result.changes) console.log(`  · ${c}`)
    if (stylesCopied.files > 0) {
      console.log(`  · [F5] 已复制 ${stylesCopied.files} 个 styles 文件到 outDir/src/styles/`)
    }
    for (const d of iconsDepsAdded) console.log(`  · [P0#4] 注入 dependencies.${d}`)
  },
}

/**
 * iter-048a F5: 如果原项目有 src/styles/ 目录, copy 到 outDir/src/styles/
 *  解决: main.js / settings.js 引用 @/styles/xxx.scss 但 scanner 不会复制 scss 文件,
 *       导致 build 找不到文件。
 */
async function this_maybeCopyStyles(
  ctx: ProjectContext,
): Promise<{ files: number; errors: number }> {
  const srcStyles = join(ctx.root, 'src', 'styles')
  if (!existsSync(srcStyles) || !statSync(srcStyles).isDirectory()) {
    return { files: 0, errors: 0 }
  }

  // 只在指定了 outDir 时复制 (in-place 模式没必要复制)
  if (!ctx.config.outDir) {
    return { files: 0, errors: 0 }
  }

  const outDir = resolve(ctx.config.outDir)
  const destStyles = join(outDir, 'src', 'styles')

  // 跳过敏感目录
  const skipNames = ['node_modules', '.git', 'dist', '.cache']

  return copyDir(srcStyles, destStyles, skipNames)
}

registerPlugin(plugin)
export default plugin

// 暴露给单测
export const _testable = {
  isVue2Project,
  transformPackageJson,
  projectImportsElementPlusIcons,
  projectNeedsElementPlusIcons,
}
