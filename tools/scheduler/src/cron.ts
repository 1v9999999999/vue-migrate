/**
 * tools/scheduler/src/cron.ts
 *
 * 30 分钟定时调度：
 *   - 第一次立即跑（不等 30 分钟）
 *   - 之后每 30 分钟
 *   - SIGINT / SIGTERM 时先 saveState 再退出
 *   - pause 时跳过本次 tick（不丢失 tick 计数）
 *
 * 用 node-cron 而不是裸 setInterval：
 *   - cron 表达式可读：每 30 分钟 = "0,30 * * * *"
 *   - 自带错误处理
 */

import cron from 'node-cron'
import { loadState, saveState, isPaused, DEFAULT_STATE_PATH, appendHistory, makeInitialState } from './persistence.js'
import { runIteration } from './iteration.js'
import type { ScheduleState } from '../../common/types.js'
import { dirname } from 'node:path'

export interface SchedulerHandle {
  stop: () => void
  triggerNow: () => Promise<void>
  isPaused: () => Promise<boolean>
}

export interface StartOptions {
  /** 状态文件路径 */
  statePath?: string
  /** 间隔（毫秒），默认 30 分钟。仅在 useNodeCron=false 时生效 */
  intervalMs?: number
  /** 使用 node-cron 表达式（默认 "0,30 * * * *"） */
  cronExpr?: string
  /** 使用 node-cron 还是裸 setInterval */
  useNodeCron?: boolean
  /** 工作目录 */
  workDir?: string
  /** 第一次是否立即跑（默认 true） */
  runImmediately?: boolean
}

/**
 * 启动调度器。返回 handle 可用于手动 stop / triggerNow。
 */
export function startScheduler(opts: StartOptions = {}): SchedulerHandle {
  const statePath = opts.statePath || DEFAULT_STATE_PATH
  const intervalMs = opts.intervalMs || 30 * 60 * 1000
  const cronExpr = opts.cronExpr || '0,30 * * * *'
  const useNodeCron = opts.useNodeCron ?? true
  const runImmediately = opts.runImmediately ?? true

  let running = false
  let stopped = false
  let timer: NodeJS.Timeout | null = null
  let cronTask: cron.ScheduledTask | null = null

  /**
   * 跑一次迭代（带并发保护）。
   * 如果前一次还在跑，本次 tick 跳过。
   */
  async function tick(): Promise<void> {
    if (running) {
      console.log('[cron] previous iteration still running, skipping this tick')
      return
    }
    if (stopped) return

    // 检查暂停标志
    if (await isPaused()) {
      console.log('[cron] scheduler is paused, skipping tick')
      return
    }

    running = true
    try {
      const state = await loadState(statePath)
      const workDir = opts.workDir || process.cwd()
      const report = await runIteration(state, { statePath, workDir })

      // 更新 state.history
      const newState: ScheduleState = appendHistory(
        { ...state, state: report.state, currentIteration: report.id },
        { id: report.id, state: report.state, stats: report.stats },
      )
      newState.lastRunAt = new Date().toISOString()
      newState.nextRunAt = new Date(Date.now() + intervalMs).toISOString()
      await saveState(statePath, newState)
      console.log(`[cron] iteration ${report.id} done (state=${report.state})`)
    } catch (err) {
      console.error(`[cron] iteration failed: ${(err as Error).message}`)
    } finally {
      running = false
    }
  }

  // 优雅退出
  const shutdown = async (signal: string) => {
    console.log(`[cron] received ${signal}, saving state and shutting down`)
    stopped = true
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    if (cronTask) {
      cronTask.stop()
      cronTask = null
    }
    try {
      const state = await loadState(statePath)
      await saveState(statePath, {
        ...state,
        lastRunAt: new Date().toISOString(),
      })
      console.log(`[cron] state saved to ${statePath}`)
    } catch (err) {
      console.error(`[cron] failed to save state on shutdown: ${(err as Error).message}`)
    }
    // 给 in-flight runIteration 一点时间
    setTimeout(() => process.exit(0), 500)
  }

  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGBREAK', () => shutdown('SIGBREAK'))

  // 启动调度
  if (useNodeCron) {
    cronTask = cron.schedule(cronExpr, () => {
      tick().catch((err) => console.error('[cron] tick error:', err))
    })
    console.log(`[cron] node-cron started: "${cronExpr}"`)
  } else {
    timer = setInterval(() => {
      tick().catch((err) => console.error('[cron] tick error:', err))
    }, intervalMs)
    console.log(`[cron] setInterval started: ${intervalMs}ms`)
  }

  // 第一次立即跑
  if (runImmediately) {
    console.log('[cron] running first iteration immediately')
    tick().catch((err) => console.error('[cron] initial tick error:', err))
  }

  return {
    stop: () => {
      stopped = true
      if (timer) clearInterval(timer)
      if (cronTask) cronTask.stop()
    },
    triggerNow: () => tick(),
    isPaused: () => isPaused(),
  }
}
