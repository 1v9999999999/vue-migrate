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
 *
 * 实现策略：
 *   - 用 `analyze` 钩子（跨文件分析阶段）一次性处理 + 写盘
 *   - 直接调 fs.writeFile，不走 ctx.files 流程（package.json 不会被 scanner 扫到）
 *   - 写到 ctx.config.outDir ?? ctx.root
 *   - dry-run 时跳过写盘
 *
 * Priority: 100（最高，最后跑，让 vue3-entry / vue-router-v4 / vuex-pinia / elementui
 *                  先完成所有代码侧转换，这样 package.json 里 vuex 已经被 pinia 替代，
 *                  我们再处理包文件不会跟代码侧冲突）
 */

import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
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

function isVue2Project(pkg: PkgJson): boolean {
  const vue = pkg?.dependencies?.['vue']
  if (typeof vue !== 'string') return false
  return /^[\^~]?2\./.test(vue) || /^2\./.test(vue)
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

const plugin: TransformPlugin = {
  name: 'package-json',
  description:
    'Migrate package.json from Vue 2 (vue-cli-service, vuex, element-ui, vue-router 3) to Vue 3 (vite, pinia, element-plus, vue-router 4, @vue/compiler-sfc).',
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
    if (!result.changed) {
      return
    }

    // 序列化（保留 2 空格缩进 + 尾部 newline）
    const out = JSON.stringify(pkg, null, 2) + '\n'

    // dry-run: 只打印不写
    if (ctx.config.dryRun) {
      console.log(`\n[package-json] 计划改动 (${result.changes.length} 项):`)
      for (const c of result.changes) console.log(`  · ${c}`)
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
  },
}

registerPlugin(plugin)
export default plugin
