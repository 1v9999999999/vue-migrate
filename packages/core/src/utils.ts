/**
 * @vue-migrate/core 共享工具
 *
 * 跨插件共享的工具函数 / 状态。
 * 设计原则：
 *  - 纯函数（无副作用）放顶层导出
 *  - 跨文件共享状态（vuex-pinia 写、composition 读）通过 ProjectContext.storeNames
 *
 * P0-B 修复点：
 *  - `inferStoreNameFromPath` —— vuex-pinia 用来从 store 文件路径推断 store id
 *  - `getMainStoreExportName` / `setMainStoreExportName` —— 跨插件传递项目主 store
 *    的 export 名字, 保证 composition 插件在组件里 import 的 store 名字和
 *    vuex-pinia 在 store/index.js 里 export 的名字一致。
 */

import type { ProjectContext, TransformContext } from './types.js'

/**
 * 从文件路径推断一个"业务语义"的 store id。
 *
 * 规则:
 *  - `index.js` / `index.ts` → 用上一级目录名 (e.g. `src/store/index.js` → 'store')
 *  - 其他文件 → 用文件 basename 去后缀 (e.g. `src/store/user.js` → 'user')
 *  - 路径为空 / 解析失败 → null (让调用方决定 fallback)
 *
 * 这个函数是 "纯" 的: 同样的 path 总返回同样的结果。调用方需要的话可以再加工
 * (e.g. 把 'store' 这种过通用名字替换成 'app')。
 */
export function inferStoreNameFromPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null
  const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length === 0) return null
  const last = parts[parts.length - 1].replace(/\.(js|ts|vue|mjs|cjs|jsx|tsx)$/, '')
  if (!last) return null
  // index 文件 → 上一级目录
  if (last === 'index') {
    // 跳过 src / lib / dist 这种 "容器" 目录
    for (let i = parts.length - 2; i >= 0; i--) {
      const p = parts[i]
      if (p && p !== 'src' && p !== 'lib' && p !== 'dist' && p !== 'app') {
        return p
      }
    }
    return null
  }
  return last
}

/**
 * 把 store id 转成 export 名字 (e.g. 'app' → 'useAppStore').
 * 注意: 这是基于 id 的格式化, 不做"业务语义"判断.
 */
export function storeIdToExportName(id: string): string {
  if (!id) return 'useAppStore'
  // kebab-case / snake_case → PascalCase
  const pascal = id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  return `use${pascal}Store`
}

/**
 * P0-B: vuex-pinia 在跑完一个 store 文件后调用, 把项目的 main store export 名字
 * 写到 ctx.project.storeNames.mainExportName。composition 插件读这个名字,
 * 保证组件里 import 的 store 名字和 store 文件 export 的名字一致。
 *
 * 设计:
 *  - 第一次写进去的名字会被记住, 后续调用忽略 (假设一个项目只有一个主 store)
 *  - 如果用户传了 multiple stores, 第一个见到的 "win"
 */
export function setMainStoreExportName(ctx: TransformContext, exportName: string): void {
  if (!exportName) return
  const project: ProjectContext = ctx.project
  if (!project.storeNames) {
    ;(project as any).storeNames = {}
  }
  const sn = (project as any).storeNames as { mainExportName?: string; mainId?: string }
  if (!sn.mainExportName) {
    sn.mainExportName = exportName
  }
  if (!sn.mainId && ctx.file?.path) {
    // 同时存 file path, 方便 debug
    ;(sn as any).mainFilePath = ctx.file.path
  }
}

/**
 * P0-B: composition 插件在推断组件里要 import 的 store 名字时调用。
 * 优先返回 vuex-pinia 写下的 mainExportName, 否则回退到传入的 defaultName,
 * 都没有就返回 'useAppStore' (Vue 生态最常见的约定)。
 */
export function getMainStoreExportName(
  ctx: TransformContext,
  defaultName?: string,
): string {
  const project: ProjectContext = ctx.project
  const sn = (project as any)?.storeNames as { mainExportName?: string } | undefined
  if (sn?.mainExportName) return sn.mainExportName
  if (defaultName) return defaultName
  return 'useAppStore'
}
