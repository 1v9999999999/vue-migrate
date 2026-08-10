/**
 * @vue-migrate/core 核心类型定义
 * 
 * 设计原则：
 * - FileNode 是整个管道流转的"通用语言"
 * - 每个阶段产出的东西都挂在这个对象上向下游传递
 * - 插件通过 ProjectContext 共享跨文件信息
 */

import type { Node } from '@babel/types'

/** 支持的文件类型 */
export type FileKind = 'vue' | 'js' | 'ts' | 'jsx' | 'tsx' | 'json' | 'unknown'

/** 源代码语言 */
export type Lang = 'js' | 'ts' | 'jsx' | 'tsx' | 'vue-template' | 'css' | 'scss' | 'less'

/** 单个文件在管道中的统一表示 */
export interface FileNode {
  /** 源文件绝对路径 */
  path: string
  /** 相对工作区的路径，用于输出 */
  relativePath: string
  /** 文件类型 */
  kind: FileKind
  /** 原始源码 */
  source: string
  /** SFC 解析结果（仅 .vue 文件） */
  sfc?: SfcInfo
  /** Babel AST（script 部分） */
  scriptAst?: Node
  /** template AST（仅 .vue） */
  templateAst?: any
  /** 收集到的元信息 */
  metadata: FileMetadata
  /** 转换历史（每个插件跑过的痕迹） */
  transforms: TransformRecord[]
  /** 是否被修改（决定是否写回） */
  changed: boolean
  /**
   * 如果为 true，codegen 直接用 file.source 输出，跳过 AST generator。
   * 适用于"插件自己接管了整文件源码"的场景（如 composition 插件重写整个 script）。
   */
  useRawSource?: boolean
}

export interface SfcInfo {
  template: SfcBlock | null
  script: SfcBlock | null
  style: SfcBlock | null
  /** 自定义块 */
  customBlocks: SfcBlock[]
  /** SFC 描述符 @vue/compiler-sfc 解析结果 */
  descriptor: any
}

export interface SfcBlock {
  /** 块类型（template/script/style/i18n/docs/...） */
  type?: string
  /** 块内容 */
  content: string
  lang?: string
  src?: string
  attrs: Record<string, string | true>
  /** 该块在源文件中的起止位置（用于 codegen 重组） */
  loc: { start: { offset: number; line: number; column: number }; end: { offset: number; line: number; column: number } }
}

export interface FileMetadata {
  /** Vue 版本特征 */
  vueVersion?: 2 | 3
  /** 脚本语言 */
  lang?: Lang
  /** 检测到的 Vue2 特性（如 'options-api', 'filters', 'slot-scope'） */
  features: string[]
  /** 该文件依赖的其他文件路径（import 解析得到） */
  dependencies: string[]
  /** 是否 entry 文件 */
  isEntry?: boolean
}

export interface TransformRecord {
  /** 哪个插件 */
  plugin: string
  /** 插件说明 */
  message: string
  /** 是否修改了文件 */
  changed: boolean
  /** 错误（如果有，不致命） */
  error?: string
}

/** 全局项目上下文 —— 所有插件共享 */
export interface ProjectContext {
  /** 工作区根 */
  root: string
  /** 所有文件节点（path -> FileNode） */
  files: Map<string, FileNode>
  /** 文件之间的依赖图（path -> imports） */
  dependencyGraph: Map<string, string[]>
  /** 类型推断结果缓存（后续 ts-infer 插件用） */
  typeCache: Map<string, Map<string, string>>
  /** 注册的插件 */
  plugins: TransformPlugin[]
  /** 全局统计 */
  stats: MigrationStats
  /** 用户传入的配置 */
  config: MigrationConfig
  /**
   * 跨插件共享的命名信息 (P0-B 修复):
   *  - vuex-pinia 在 store/index.js 上写 mainExportName (e.g. 'useAppStore')
   *  - composition 在组件里读 mainExportName, 避免 import 名 / export 名对不上
   * 类型在 utils.ts 里扩展; 此处用 optional 保持向后兼容.
   */
  storeNames?: ProjectStoreNames
}

/** P0-B: 跨插件共享的 store 命名信息, 由 vuex-pinia 写、composition 读 */
export interface ProjectStoreNames {
  /** 项目的 "主" store 的 export 名字 (e.g. 'useAppStore') */
  mainExportName?: string
  /** 项目的 "主" store 的 store id (defineStore 的第一个字符串参数) */
  mainId?: string
  /** 触发 mainExportName 设置的 store 文件路径 (debug 用) */
  mainFilePath?: string
}

export interface MigrationStats {
  totalFiles: number
  modifiedFiles: number
  newTypesInferred: number
  manualReviewRequired: number
  errors: number
}

export interface MigrationConfig {
  /** 是否 dry-run（不写文件） */
  dryRun?: boolean
  /** 要跑的插件（默认全部） */
  plugins?: string[]
  /** 是否生成备份 */
  backup?: boolean
  /** 输出目录（默认原地覆盖） */
  outDir?: string
  /** 是否保留完整目录结构（未改的文件从 src 拷贝到 dst） */
  keepStructure?: boolean
  /**
   * iter-037: JS 解析失败时是否 fallback 试 TS 解析
   *   - false (默认): 严格按文件扩展名 / `<script lang>` 解析, TS 语法会报错
   *   - true: 遇到 .vue 解析失败时试 TS, 成功就当 TS 处理
   * 用法: vue-migrate transform --ts <src>
   */
  fallbackToTs?: boolean
}

/** 单个文件处理时的上下文 */
export interface TransformContext {
  file: FileNode
  project: ProjectContext
  /** 工具集 */
  utils: TransformUtils
  /** 日志（每个插件独立 tag） */
  log: (msg: string) => void
  /** iter-038: 顶层 syncScriptAstToSource — 跟 utils.syncScriptAstToSource 是同一个,
   *  顶层提供方便 plugin 直接 ctx.syncScriptAstToSource() 调用 */
  syncScriptAstToSource(): void
  /** 内部状态：是否已修改（由 utils.markChanged 设置） */
  __changed?: boolean
  /** 内部状态：最后一条 markChanged 消息 */
  __lastMessage?: string
}

export interface TransformUtils {
  /** 重新解析 script（插件改完源码后调用） */
  reparse(): void
  /** iter-038: 反向 sync — 把 file.scriptAst 重新 generate 写回 file.source。
   * 用于 plugin 改了 scriptAst 但没写回 file.source 时 (e.g. elementui 改
   * import 但 composition 后面会用 raw source 路径覆盖掉)。 */
  syncScriptAstToSource(): void
  /** 标记文件已修改，可选 msg 描述本次改动 */
  markChanged(msg?: string): void
  /** 添加一个手动 review 项 */
  manualReview(reason: string): void
}

/** 插件接口 —— 这是扩展性的核心 */
export interface TransformPlugin {
  /** 插件名（唯一） */
  name: string
  /** 插件描述 */
  description?: string
  /** 优先级，数字越大越先执行，默认 0 */
  priority?: number
  /** 只处理哪些文件类型，默认全处理 */
  fileKinds?: FileKind[]
  /**
   * 主转换钩子
   * - 改 AST 即可，不要直接操作 source 字符串
   * - 改完调 utils.markChanged() 和 utils.reparse()
   */
  transform?(ctx: TransformContext): void | Promise<void>
  /** 可选：扫描阶段钩子 */
  scan?(ctx: ProjectContext): void | Promise<void>
  /** 可选：分析阶段钩子（跨文件分析） */
  analyze?(ctx: ProjectContext): void | Promise<void>
}

/** 报告项 */
export interface ReportItem {
  file: string
  plugin: string
  type: 'transform' | 'manual-review' | 'warning' | 'error'
  message: string
}
