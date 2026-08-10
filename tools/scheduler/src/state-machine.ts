/**
 * tools/scheduler/src/state-machine.ts
 *
 * 状态机定义：vue-migrate 自演化调度器的心脏。
 *
 * 设计原则：
 *   - 纯函数：没有 I/O、没有副作用，方便单测
 *   - 状态转移显式枚举：不依赖"时间"或"条件"自动推进
 *   - 失败总是可恢复：任何状态都可以 → failed → idle
 *   - 显式事件驱动：success / failure / needs_agent / human_input / regression_detected
 */

import type { IterationReport } from '../../common/types.js'

/** 调度器所有可能状态（与 IterationReport['state'] 共享字符串字面量） */
export type State = IterationReport['state']

/** 触发状态转移的事件 */
export type ScheduleEvent =
  | 'success'
  | 'failure'
  | 'needs_agent'
  | 'human_input'
  | 'regression_detected'
  | 'timeout'
  | 'reset'

/**
 * 状态转移表。
 *
 * 关键约束：
 *   - 只有 idle 是入口（committing/spawning_agent/blocked 都会回到 idle）
 *   - 只有 done / failed 是终态
 *   - 任何"工作中"状态都能在 failure 事件下转 failed
 *   - analyzing 阶段的 needs_agent 是关键路径：调子 agent 处理 issue
 *   - testing 阶段的 needs_agent 表明回归检测到但当前规则无法修复
 */
export const TRANSITIONS: Record<State, State[]> = {
  idle: ['collecting', 'failed', 'blocked'],
  collecting: ['converting', 'failed'],
  converting: ['diffing', 'failed'],
  diffing: ['analyzing', 'failed'],
  analyzing: ['generating', 'testing', 'spawning_agent', 'failed'],
  generating: ['testing', 'failed'],
  testing: ['committing', 'spawning_agent', 'failed'],
  committing: ['idle', 'done', 'failed'],
  spawning_agent: ['idle', 'failed'],
  blocked: ['idle', 'failed'],
  done: ['idle'],
  failed: ['idle', 'blocked'],
}

/** 所有 state 列表（用于类型推导 & 测试枚举） */
export const ALL_STATES: State[] = [
  'idle',
  'collecting',
  'converting',
  'diffing',
  'analyzing',
  'generating',
  'testing',
  'committing',
  'spawning_agent',
  'blocked',
  'done',
  'failed',
]

/**
 * 判断 from → to 是否合法。
 * 用于：防御性编程、UI 提示、单测验证。
 */
export function canTransition(from: State, to: State): boolean {
  if (from === to) return false // 状态机不允许 self-loop
  return TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * 给定当前状态和事件，计算下一状态。
 * 不可转移则返回原状态（调用方应记录为"未知事件"并视为失败）。
 *
 * 事件语义：
 *   - success            : 阶段正常完成，进入下一阶段
 *   - failure            : 阶段异常，进入 failed
 *   - needs_agent        : 需要派发子 agent 处理
 *   - human_input        : 需要人工介入
 *   - regression_detected: 测试阶段检测到回归
 *   - timeout            : 阶段超时（资源限制）
 *   - reset              : 强制回 idle（异常路径）
 */
export function nextState(current: State, event: ScheduleEvent): State {
  // 特殊：reset 永远回 idle
  if (event === 'reset') {
    return 'idle'
  }

  // timeout 等价于 failure，但强制进 failed 而不是 blocked
  if (event === 'timeout') {
    return 'failed'
  }

  switch (current) {
    case 'idle':
      if (event === 'success') return 'collecting'
      if (event === 'failure') return 'failed'
      if (event === 'human_input') return 'blocked'
      break

    case 'collecting':
      if (event === 'success') return 'converting'
      if (event === 'failure') return 'failed'
      break

    case 'converting':
      if (event === 'success') return 'diffing'
      if (event === 'failure') return 'failed'
      break

    case 'diffing':
      if (event === 'success') return 'analyzing'
      if (event === 'failure') return 'failed'
      break

    case 'analyzing':
      if (event === 'success') return 'generating'
      if (event === 'needs_agent') return 'spawning_agent'
      if (event === 'regression_detected') return 'testing'
      if (event === 'failure') return 'failed'
      // analyzing 也可能直接到 testing：发现 issues 但没新增规则
      if (event === 'human_input') return 'blocked'
      break

    case 'generating':
      if (event === 'success') return 'testing'
      if (event === 'failure') return 'failed'
      break

    case 'testing':
      if (event === 'success') return 'committing'
      if (event === 'needs_agent') return 'spawning_agent'
      if (event === 'regression_detected') return 'generating' // 回滚重新生成
      if (event === 'failure') return 'failed'
      break

    case 'committing':
      if (event === 'success') return 'done'
      if (event === 'failure') return 'failed'
      break

    case 'spawning_agent':
      if (event === 'success') return 'idle' // agent 完成后回 idle 等下一轮
      if (event === 'failure') return 'failed'
      break

    case 'blocked':
      if (event === 'human_input') return 'idle'
      if (event === 'failure') return 'failed'
      break

    case 'done':
      // done 是终态，只能 reset
      break

    case 'failed':
      if (event === 'success') return 'idle' // 恢复
      if (event === 'human_input') return 'blocked'
      break
  }

  // 不可转移：返回原状态（调用方需要处理）
  return current
}

/**
 * 判断当前状态是否是"终态"（done / failed）。
 */
export function isTerminal(state: State): boolean {
  return state === 'done' || state === 'failed'
}

/**
 * 判断当前状态是否"正在工作"（不是 idle / done / failed / blocked）。
 */
export function isWorking(state: State): boolean {
  return (
    state === 'collecting' ||
    state === 'converting' ||
    state === 'diffing' ||
    state === 'analyzing' ||
    state === 'generating' ||
    state === 'testing' ||
    state === 'committing' ||
    state === 'spawning_agent'
  )
}

/**
 * 工作阶段的预期顺序（不含分支）。
 * 供进度估算、日志输出使用。
 */
export const WORKFLOW: State[] = [
  'collecting',
  'converting',
  'diffing',
  'analyzing',
  'generating',
  'testing',
  'committing',
  'done',
]

/**
 * 给定一个状态，估算"剩余步骤数"（含当前步骤之后的所有步骤）。
 *   - idle 视为"还没开始"，返回完整流程长度
 *   - done/failed/blocked 等终态返回 0
 *   - collecting 返回 7（"collecting 之后还有 7 步"）
 */
export function remainingSteps(state: State): number {
  if (state === 'idle') return WORKFLOW.length
  const idx = WORKFLOW.indexOf(state)
  if (idx === -1) return 0
  return WORKFLOW.length - idx - 1
}
