/**
 * tools/scheduler/src/persistence.ts
 *
 * 状态持久化：原子写、损坏恢复、变更日志。
 *
 * 关键不变量：
 *   1. 写文件：先写 .tmp，再 rename（POSIX 原子，Windows 上也保证成功）
 *   2. 读文件：损坏时返回初始 state 而不是 throw
 *   3. 任何 transition 追加一行到 .iterate-state.log
 *   4. 同时维护 .iterate-state.paused 标志文件（pause/resume 用）
 */

import { readFile, writeFile, rename, mkdir, appendFile, access, unlink } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname } from 'node:path'
import type { ScheduleState, State } from './state-machine.js'

/** 持久化文件的 schema 版本号（破坏性变更时 +1） */
export const STATE_SCHEMA_VERSION = 1

/** 默认 state 文件路径 */
export const DEFAULT_STATE_PATH = 'baselines/.iterate-state.json'

/** 变更日志路径 */
export const DEFAULT_LOG_PATH = 'baselines/.iterate-state.log'

/** 暂停标志文件 */
export const DEFAULT_PAUSE_FLAG = 'baselines/.iterate-state.paused'

/** 报告存档目录（按 iteration id） */
export const DEFAULT_REPORTS_DIR = 'baselines/reports'

/**
 * 构造一个干净的初始 state。
 */
export function makeInitialState(): ScheduleState {
  const now = new Date().toISOString()
  return {
    state: 'idle',
    lastRunAt: now,
    nextRunAt: now,
    currentIteration: '',
    history: [],
  }
}

/**
 * 加载 state。文件不存在或损坏时返回初始 state。
 */
export async function loadState(path: string): Promise<ScheduleState> {
  try {
    await access(path, constants.F_OK)
  } catch {
    return makeInitialState()
  }

  try {
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw)

    // 基础 schema 校验
    if (!parsed || typeof parsed !== 'object') {
      console.warn(`[persistence] ${path} is not an object, using initial state`)
      return makeInitialState()
    }
    if (typeof parsed.state !== 'string') {
      console.warn(`[persistence] ${path} has invalid state field, using initial state`)
      return makeInitialState()
    }
    if (!Array.isArray(parsed.history)) {
      parsed.history = []
    }

    // 字段补全（向后兼容老 state）
    return {
      state: parsed.state as State,
      lastRunAt: parsed.lastRunAt || new Date().toISOString(),
      nextRunAt: parsed.nextRunAt || new Date().toISOString(),
      currentIteration: parsed.currentIteration || '',
      history: parsed.history.slice(-50), // 最多保留 50 轮
    }
  } catch (err) {
    console.warn(
      `[persistence] failed to load ${path}: ${(err as Error).message}. Falling back to initial state.`,
    )
    return makeInitialState()
  }
}

/**
 * 原子写 state：
 *   1. 写 .tmp
 *   2. rename 到目标路径
 *
 * rename 在同一个文件系统下是原子操作。即使中途断电，也只会出现
 * "旧文件"或"新文件"，不会出现半写状态。
 */
export async function saveState(path: string, state: ScheduleState): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  const payload = JSON.stringify(
    {
      ...state,
      _schemaVersion: STATE_SCHEMA_VERSION,
      _savedAt: new Date().toISOString(),
    },
    null,
    2,
  )
  try {
    await writeFile(tmp, payload, 'utf8')
    await rename(tmp, path)
  } catch (err) {
    // 清理 tmp 文件
    try {
      await unlink(tmp)
    } catch {
      // ignore
    }
    throw err
  }
}

/**
 * 追加一条 transition 日志。
 * 每次状态变化都打点，方便事后审计 & 调优。
 */
export async function appendTransitionLog(
  logPath: string,
  entry: {
    from: State
    to: State
    iterationId?: string
    event?: string
    message?: string
  },
): Promise<void> {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  })
  await mkdir(dirname(logPath), { recursive: true })
  await appendFile(logPath, line + '\n', 'utf8')
}

/**
 * 检查是否处于暂停状态（通过标志文件存在与否判断）。
 */
export async function isPaused(flagPath: string = DEFAULT_PAUSE_FLAG): Promise<boolean> {
  try {
    await access(flagPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 暂停调度器：创建标志文件。
 */
export async function pause(flagPath: string = DEFAULT_PAUSE_FLAG): Promise<void> {
  await mkdir(dirname(flagPath), { recursive: true })
  const stamp = new Date().toISOString()
  await writeFile(flagPath, stamp, 'utf8')
}

/**
 * 恢复调度器：删除标志文件。
 */
export async function resume(flagPath: string = DEFAULT_PAUSE_FLAG): Promise<void> {
  try {
    await unlink(flagPath)
  } catch {
    // 已经不存在，OK
  }
}

/**
 * 把一次完整迭代结果追加到 history。
 * 自动裁剪到最近 50 条。
 */
export function appendHistory(
  state: ScheduleState,
  iteration: Pick<ScheduleState['history'][number], 'id' | 'state' | 'stats'>,
): ScheduleState {
  const history = [...state.history, iteration].slice(-50)
  return { ...state, history }
}

/**
 * 持久化一个完整的 IterationReport 到 baselines/reports/{id}.json。
 * 供事后分析、回放、跨迭代对比。
 */
export async function saveReport(
  reportsDir: string,
  reportId: string,
  report: unknown,
): Promise<string> {
  await mkdir(reportsDir, { recursive: true })
  const path = `${reportsDir}/${reportId}.json`
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, JSON.stringify(report, null, 2), 'utf8')
  await rename(tmp, path)
  return path
}

/**
 * 读取最近的 N 个报告。
 * 用于 shouldSpawnAgent 的"近 3 轮"判断。
 */
export async function loadRecentReports(
  reportsDir: string,
  n: number,
): Promise<unknown[]> {
  try {
    const { readdir } = await import('node:fs/promises')
    const entries = await readdir(reportsDir)
    const jsonFiles = entries
      .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
      .sort()
      .reverse()
      .slice(0, n)
    const reports: unknown[] = []
    for (const f of jsonFiles) {
      try {
        const raw = await readFile(`${reportsDir}/${f}`, 'utf8')
        reports.push(JSON.parse(raw))
      } catch {
        // 跳过损坏的
      }
    }
    return reports
  } catch {
    return []
  }
}
