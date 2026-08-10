/**
 * Reporter —— 给人看的转换报告
 */

import chalk from 'chalk'
import type { ProjectContext, ReportItem } from './types.js'

export function reportProject(ctx: ProjectContext, items: ReportItem[] = []): void {
  console.log()
  console.log(chalk.bold.cyan('━'.repeat(60)))
  console.log(chalk.bold.cyan('  Vue Migrate Report'))
  console.log(chalk.bold.cyan('━'.repeat(60)))
  console.log()

  // 基础统计
  console.log(chalk.bold('  📊 统计'))
  console.log(`     总文件:    ${chalk.cyan(ctx.stats.totalFiles)}`)
  console.log(`     已修改:    ${chalk.green(ctx.stats.modifiedFiles)}`)
  console.log(`     需人工:    ${chalk.yellow(ctx.stats.manualReviewRequired)}`)
  console.log(`     新增类型:  ${chalk.cyan(ctx.stats.newTypesInferred)}`)
  console.log(`     错误:      ${chalk.red(ctx.stats.errors)}`)
  console.log()

  // Vue2 特性分布
  const featureMap = new Map<string, number>()
  for (const file of ctx.files.values()) {
    for (const f of file.metadata.features) {
      featureMap.set(f, (featureMap.get(f) || 0) + 1)
    }
  }
  if (featureMap.size) {
    console.log(chalk.bold('  🔍 识别到的 Vue2 特性'))
    for (const [feat, count] of [...featureMap.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${chalk.gray(feat.padEnd(28))} ${count}`)
    }
    console.log()
  }

  // 修改明细
  const modified = [...ctx.files.values()].filter((f) => f.transforms.length > 0)
  if (modified.length) {
    console.log(chalk.bold('  ✏️  修改明细'))
    for (const file of modified.slice(0, 20)) {
      console.log(`     ${chalk.gray(file.relativePath)}`)
      for (const t of file.transforms) {
        if (t.error) {
          console.log(`        ${chalk.red('✗')} ${t.plugin}: ${t.message} ${chalk.gray(t.error)}`)
        } else {
          console.log(`        ${chalk.green('✓')} ${t.plugin}: ${t.message}`)
        }
      }
    }
    if (modified.length > 20) {
      console.log(chalk.gray(`     ... 还有 ${modified.length - 20} 个文件`))
    }
    console.log()
  }

  if (items.length) {
    console.log(chalk.bold('  👀  需人工 Review'))
    for (const item of items) {
      console.log(`     ${chalk.yellow('•')} ${chalk.gray(item.file)} — ${item.message}`)
    }
    console.log()
  }

  console.log(chalk.cyan('━'.repeat(60)))
  console.log()
}
