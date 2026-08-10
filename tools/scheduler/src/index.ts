#!/usr/bin/env tsx
/**
 * tools/scheduler/src/index.ts
 *
 * CLI 入口：
 *   tsx tools/scheduler/src/index.ts start                    # 启动长跑调度（30 分钟一次）
 *   tsx tools/scheduler/src/index.ts run-once                 # 只跑一次迭代
 *   tsx tools/scheduler/src/index.ts status                   # 打印当前 state
 *   tsx tools/scheduler/src/index.ts reset                    # 重置 state
 *   tsx tools/scheduler/src/index.ts pause / resume            # 暂停/恢复
 *   tsx tools/scheduler/src/index.ts tickets                  # 列出 agent tickets
 */

import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unlink } from 'node:fs/promises'
import {
  loadState,
  saveState,
  pause as markPaused,
  resume as markResumed,
  isPaused,
  DEFAULT_STATE_PATH,
  DEFAULT_PAUSE_FLAG,
  makeInitialState,
} from './persistence.js'
import { runIteration } from './iteration.js'
import { startScheduler } from './cron.js'
import { listOpenTickets } from './agent-dispatcher.js'
import type { State } from './state-machine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..', '..', '..')
const STATE_PATH = join(ROOT, DEFAULT_STATE_PATH)
const PAUSE_FLAG = join(ROOT, DEFAULT_PAUSE_FLAG)

const USAGE = `
vue-migrate scheduler CLI

Usage:
  tsx tools/scheduler/src/index.ts <command>

Commands:
  start        Start the long-running scheduler (30 min interval)
  run-once     Run a single iteration and exit
  status       Print current state
  reset        Reset state to initial (deletes .iterate-state.json)
  pause        Pause scheduler (creates .iterate-state.paused)
  resume       Resume scheduler (removes .iterate-state.paused)
  tickets      List open agent dispatch tickets
  help         Show this message
`

async function main() {
  const cmd = (process.argv[2] || 'help').toLowerCase()

  switch (cmd) {
    case 'start':
      return cmdStart()
    case 'run-once':
      return cmdRunOnce()
    case 'status':
      return cmdStatus()
    case 'reset':
      return cmdReset()
    case 'pause':
      return cmdPause()
    case 'resume':
      return cmdResume()
    case 'tickets':
      return cmdTickets()
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE)
      return
    default:
      console.error(`Unknown command: ${cmd}`)
      console.log(USAGE)
      process.exit(1)
  }
}

async function cmdStart(): Promise<void> {
  console.log('=== vue-migrate scheduler ===')
  console.log(`State path: ${STATE_PATH}`)
  console.log(`Work dir:   ${ROOT}`)
  console.log(`Interval:   30 minutes (cron: "0,30 * * * *")`)
  console.log()

  const handle = startScheduler({
    statePath: STATE_PATH,
    workDir: ROOT,
    cronExpr: '0,30 * * * *',
    runImmediately: true,
  })

  console.log('Scheduler started. Press Ctrl+C to stop.')
  // 保持进程活着
  await new Promise(() => {
    // never resolves; SIGINT/SIGTERM 触发 cron.ts 里的 shutdown
  })
}

async function cmdRunOnce(): Promise<void> {
  console.log('=== run-once ===')
  console.log(`State: ${STATE_PATH}`)
  console.log(`Work:  ${ROOT}`)

  const state = await loadState(STATE_PATH)
  console.log(`Current state: ${state.state}`)
  console.log(`Last run:      ${state.lastRunAt}`)
  console.log()

  const t0 = Date.now()
  const report = await runIteration(state, {
    statePath: STATE_PATH,
    workDir: ROOT,
  })
  const dt = Date.now() - t0

  console.log()
  console.log('=== result ===')
  console.log(`Iteration:  ${report.id}`)
  console.log(`Final state: ${report.state}`)
  console.log(`Duration:    ${dt}ms`)
  console.log(`Files:       ${report.stats.totalFiles}`)
  console.log(`Errors:      ${report.stats.errors}`)
  console.log(`Review:      ${report.stats.reviewCount}`)
  console.log(`Agent tickets: ${report.agentTickets.length}`)

  // 写回 state
  const newState = {
    ...state,
    state: report.state as State,
    currentIteration: report.id,
    lastRunAt: new Date().toISOString(),
    history: [...state.history, { id: report.id, state: report.state, stats: report.stats }].slice(-50),
  }
  await saveState(STATE_PATH, newState)
  console.log(`\nState updated. Final state: ${report.state}`)
}

async function cmdStatus(): Promise<void> {
  const state = await loadState(STATE_PATH)
  const paused = await isPaused(PAUSE_FLAG)

  console.log('=== scheduler status ===')
  console.log(`State:        ${state.state}`)
  console.log(`Current iter: ${state.currentIteration || '(none)'}`)
  console.log(`Last run:     ${state.lastRunAt}`)
  console.log(`Next run:     ${state.nextRunAt}`)
  console.log(`Paused:       ${paused}`)
  console.log(`History:      ${state.history.length} entries`)

  if (state.history.length > 0) {
    console.log('\nRecent history:')
    for (const h of state.history.slice(-5)) {
      console.log(
        `  ${h.id}  state=${h.state}  files=${h.stats.totalFiles}  errors=${h.stats.errors}  review=${h.stats.reviewCount}`,
      )
    }
  }
}

async function cmdReset(): Promise<void> {
  const initial = makeInitialState()
  await saveState(STATE_PATH, initial)
  try {
    await unlink(PAUSE_FLAG)
  } catch {
    // ignore
  }
  console.log('State reset to initial.')
  console.log(`  state:           ${initial.state}`)
  console.log(`  lastRunAt:       ${initial.lastRunAt}`)
  console.log(`  currentIteration: ""`)
  console.log(`  history:         []`)
}

async function cmdPause(): Promise<void> {
  await markPaused(PAUSE_FLAG)
  console.log(`Scheduler paused. Flag: ${PAUSE_FLAG}`)
}

async function cmdResume(): Promise<void> {
  await markResumed(PAUSE_FLAG)
  console.log('Scheduler resumed.')
}

async function cmdTickets(): Promise<void> {
  const tickets = await listOpenTickets(ROOT)
  console.log(`=== agent tickets (${tickets.length}) ===`)
  for (const t of tickets) {
    console.log(`  ${t.id}  created=${t.createdAt}`)
    console.log(`    ${t.path}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
