/**
 * tools/common/types.ts
 *
 * 共享类型定义：贯穿整个自演化迁移系统的数据结构
 */

export type Severity = 'blocker' | 'warning' | 'minor'
export type IssueType = 'syntax' | 'semantic' | 'cosmetic' | 'runtime'

export interface FileMetrics {
  /** 文件相对路径 */
  path: string
  /** 源 Vue2 文件的语法是否合法 */
  sourceValid: boolean
  /** 转换后输出文件的语法是否合法 */
  outputValid: boolean
  /** 转换是否标记了 changed=true */
  changed: boolean
  /** review 数量（手动需 review 的项） */
  reviewCount: number
  /** 错误的字符串（如果有） */
  error?: string
  /** 文件大小字节数 */
  bytes: number
  /** 行数 */
  lines: number
}

export interface SampleMetrics extends FileMetrics {
  /** 样本元信息 */
  sample: {
    org: string
    repo: string
    framework?: string
    state?: string
    router?: boolean
    scale?: 'small' | 'medium' | 'large'
  }
}

export interface BaselineMetrics extends SampleMetrics {
  /** 与官方 @vue/codemod 输出的对比 */
  official: {
    outputValid: boolean
    reviewCount: number
    /** 我们相对官方 codemod 少了多少 review */
    deltaReview: number
  }
}

export interface IterationReport {
  /** 迭代 ID (ISO timestamp) */
  id: string
  /** 迭代开始时间 */
  startedAt: string
  /** 迭代结束时间 */
  finishedAt?: string
  /** 状态 */
  state: 'idle' | 'collecting' | 'converting' | 'diffing' | 'analyzing' | 'generating' | 'testing' | 'committing' | 'spawning_agent' | 'blocked' | 'done' | 'failed'
  /** 聚合统计 */
  stats: {
    totalSamples: number
    totalFiles: number
    errors: number
    modified: number
    reviewCount: number
    outputValid: number
  }
  /** 失败的文件列表 */
  failures: Array<{
    path: string
    error: string
    severity: Severity
    type: IssueType
  }>
  /** 与上一轮对比 */
  delta?: {
    errors: number
    modified: number
    reviewCount: number
  }
  /** 派发的 agent ticket */
  agentTickets: string[]
}

export interface ScheduleState {
  /** 状态机当前状态 */
  state: IterationReport['state']
  /** 上次完成时间 */
  lastRunAt: string
  /** 下次计划时间 */
  nextRunAt: string
  /** 当前迭代 ID */
  currentIteration: string
  /** 历史最近 50 轮统计（用于趋势分析） */
  history: Array<Pick<IterationReport, 'id' | 'state' | 'stats'>>
}

export interface RuleCandidate {
  /** 规则名（kebab-case） */
  name: string
  /** 规则作用描述 */
  description: string
  /** 规则优先级（数字越大越靠后） */
  priority: number
  /** 单元测试用例 */
  testCases: Array<{
    input: string
    expected: string
    description: string
  }>
  /** 规则实现的代码草稿 */
  codeDraft: string
}

export interface IssueTicket {
  /** Ticket ID（issue-N） */
  id: string
  /** Issue 描述 */
  description: string
  /** 问题文件路径（示例） */
  exampleFiles: string[]
  /** 输入/输出/期望 */
  payload: {
    input: string
    actualOutput: string
    expectedOutput: string
  }
  /** 严重程度 */
  severity: Severity
  /** 类型 */
  type: IssueType
  /** 状态 */
  status: 'open' | 'in_progress' | 'fixed' | 'wontfix'
  /** 创建时间 */
  createdAt: string
  /** 失败次数（连续迭代未修） */
  failedAttempts: number
}
