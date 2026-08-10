/**
 * tools/scheduler/src/__tests__/state-machine.test.ts
 *
 * 覆盖每个状态转移、边界 case（同一状态、非法转移、连续失败等）。
 *
 * 运行：
 *   tsx --test src/__tests__/state-machine.test.ts
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_STATES,
  TRANSITIONS,
  canTransition,
  isTerminal,
  isWorking,
  nextState,
  remainingSteps,
  WORKFLOW,
  type State,
  type ScheduleEvent,
} from '../state-machine.js'

/* -------------------------------------------------------------------------- */
/* TRANSITIONS 表完整性                                                        */
/* -------------------------------------------------------------------------- */

test('TRANSITIONS covers all states', () => {
  for (const s of ALL_STATES) {
    assert.ok(TRANSITIONS[s], `state ${s} missing from TRANSITIONS`)
    assert.ok(Array.isArray(TRANSITIONS[s]), `TRANSITIONS[${s}] must be an array`)
  }
})

test('TRANSITIONS keys are subset of ALL_STATES', () => {
  for (const k of Object.keys(TRANSITIONS)) {
    assert.ok(
      ALL_STATES.includes(k as State),
      `TRANSITIONS has unknown state: ${k}`,
    )
  }
})

test('TRANSITIONS values only reference valid states', () => {
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    for (const to of tos) {
      assert.ok(
        ALL_STATES.includes(to as State),
        `${from} → ${to}: target state not in ALL_STATES`,
      )
    }
  }
})

/* -------------------------------------------------------------------------- */
/* canTransition                                                              */
/* -------------------------------------------------------------------------- */

test('canTransition: legal transitions', () => {
  assert.equal(canTransition('idle', 'collecting'), true)
  assert.equal(canTransition('collecting', 'converting'), true)
  assert.equal(canTransition('converting', 'diffing'), true)
  assert.equal(canTransition('diffing', 'analyzing'), true)
  assert.equal(canTransition('analyzing', 'generating'), true)
  assert.equal(canTransition('generating', 'testing'), true)
  assert.equal(canTransition('testing', 'committing'), true)
  assert.equal(canTransition('committing', 'done'), true)
  // 分支
  assert.equal(canTransition('analyzing', 'spawning_agent'), true)
  assert.equal(canTransition('analyzing', 'testing'), true)
  assert.equal(canTransition('testing', 'spawning_agent'), true)
  // 失败路径
  assert.equal(canTransition('collecting', 'failed'), true)
  assert.equal(canTransition('failed', 'idle'), true)
  // 人工介入
  assert.equal(canTransition('idle', 'blocked'), true)
  assert.equal(canTransition('blocked', 'idle'), true)
})

test('canTransition: illegal transitions (skip stages)', () => {
  assert.equal(canTransition('idle', 'converting'), false)
  assert.equal(canTransition('idle', 'testing'), false)
  assert.equal(canTransition('collecting', 'diffing'), false)
  assert.equal(canTransition('converting', 'analyzing'), false)
  assert.equal(canTransition('diffing', 'generating'), false)
  assert.equal(canTransition('analyzing', 'committing'), false)
  assert.equal(canTransition('generating', 'committing'), false)
  assert.equal(canTransition('testing', 'done'), false) // 必须经 committing
})

test('canTransition: self-loops are forbidden', () => {
  for (const s of ALL_STATES) {
    assert.equal(canTransition(s, s), false, `self-loop ${s} → ${s} should be illegal`)
  }
})

test('canTransition: done 只能转 idle（spec 明确定义）', () => {
  // 严格按 spec：done → idle 合法（进入下一轮），其他都非法
  assert.equal(canTransition('done', 'idle'), true)
  for (const s of ALL_STATES) {
    if (s === 'idle') continue
    assert.equal(canTransition('done', s), false, `done → ${s} should be illegal`)
  }
})

test('canTransition: failed can recover', () => {
  assert.equal(canTransition('failed', 'idle'), true)
  assert.equal(canTransition('failed', 'blocked'), true)
})

/* -------------------------------------------------------------------------- */
/* nextState: happy path                                                      */
/* -------------------------------------------------------------------------- */

test('nextState: happy path idle → done', () => {
  let s: State = 'idle'
  const sequence: State[] = [s]

  s = nextState(s, 'success') // → collecting
  sequence.push(s)
  assert.equal(s, 'collecting')

  s = nextState(s, 'success') // → converting
  sequence.push(s)
  assert.equal(s, 'converting')

  s = nextState(s, 'success') // → diffing
  sequence.push(s)
  assert.equal(s, 'diffing')

  s = nextState(s, 'success') // → analyzing
  sequence.push(s)
  assert.equal(s, 'analyzing')

  s = nextState(s, 'success') // → generating
  sequence.push(s)
  assert.equal(s, 'generating')

  s = nextState(s, 'success') // → testing
  sequence.push(s)
  assert.equal(s, 'testing')

  s = nextState(s, 'success') // → committing
  sequence.push(s)
  assert.equal(s, 'committing')

  s = nextState(s, 'success') // → done
  sequence.push(s)
  assert.equal(s, 'done')

  assert.deepEqual(sequence, [
    'idle',
    'collecting',
    'converting',
    'diffing',
    'analyzing',
    'generating',
    'testing',
    'committing',
    'done',
  ])
})

/* -------------------------------------------------------------------------- */
/* nextState: failure paths                                                   */
/* -------------------------------------------------------------------------- */

test('nextState: failure at any working state → failed', () => {
  const working: State[] = [
    'collecting',
    'converting',
    'diffing',
    'analyzing',
    'generating',
    'testing',
    'committing',
  ]
  for (const s of working) {
    assert.equal(nextState(s, 'failure'), 'failed', `${s} + failure should → failed`)
  }
})

test('nextState: timeout always → failed', () => {
  for (const s of ALL_STATES) {
    assert.equal(nextState(s, 'timeout'), 'failed')
  }
})

test('nextState: reset always → idle', () => {
  for (const s of ALL_STATES) {
    assert.equal(nextState(s, 'reset'), 'idle', `${s} + reset should → idle`)
  }
})

/* -------------------------------------------------------------------------- */
/* nextState: needs_agent                                                     */
/* -------------------------------------------------------------------------- */

test('nextState: needs_agent from analyzing → spawning_agent', () => {
  assert.equal(nextState('analyzing', 'needs_agent'), 'spawning_agent')
})

test('nextState: needs_agent from testing → spawning_agent', () => {
  assert.equal(nextState('testing', 'needs_agent'), 'spawning_agent')
})

test('nextState: spawning_agent success → idle', () => {
  assert.equal(nextState('spawning_agent', 'success'), 'idle')
})

test('nextState: needs_agent from illegal states → original state (no-op)', () => {
  // idle 上 needs_agent 没意义
  assert.equal(nextState('idle', 'needs_agent'), 'idle')
  // done 上 needs_agent 也不该发生
  assert.equal(nextState('done', 'needs_agent'), 'done')
})

/* -------------------------------------------------------------------------- */
/* nextState: human_input                                                     */
/* -------------------------------------------------------------------------- */

test('nextState: human_input on idle → blocked', () => {
  assert.equal(nextState('idle', 'human_input'), 'blocked')
})

test('nextState: human_input on blocked → idle (resume)', () => {
  assert.equal(nextState('blocked', 'human_input'), 'idle')
})

test('nextState: human_input on failed → blocked', () => {
  assert.equal(nextState('failed', 'human_input'), 'blocked')
})

/* -------------------------------------------------------------------------- */
/* nextState: regression_detected                                             */
/* -------------------------------------------------------------------------- */

test('nextState: regression_detected on analyzing → testing (直接验证现有规则)', () => {
  assert.equal(nextState('analyzing', 'regression_detected'), 'testing')
})

test('nextState: regression_detected on testing → generating (回滚重新生成)', () => {
  assert.equal(nextState('testing', 'regression_detected'), 'generating')
})

/* -------------------------------------------------------------------------- */
/* nextState: 连续失败                                                        */
/* -------------------------------------------------------------------------- */

test('nextState: 连续失败 sequence', () => {
  // 模拟一个真实场景：collecting 失败 → failed → 恢复 → collecting → converting 失败
  let s: State = 'idle'
  s = nextState(s, 'success') // → collecting
  assert.equal(s, 'collecting')
  s = nextState(s, 'failure') // → failed
  assert.equal(s, 'failed')
  s = nextState(s, 'success') // → idle
  assert.equal(s, 'idle')
  s = nextState(s, 'success') // → collecting
  assert.equal(s, 'collecting')
  s = nextState(s, 'success') // → converting
  assert.equal(s, 'converting')
  s = nextState(s, 'failure') // → failed
  assert.equal(s, 'failed')
  s = nextState(s, 'human_input') // → blocked
  assert.equal(s, 'blocked')
  s = nextState(s, 'human_input') // → idle
  assert.equal(s, 'idle')
})

/* -------------------------------------------------------------------------- */
/* nextState: 非法事件在终态                                                  */
/* -------------------------------------------------------------------------- */

test('nextState: done 上大多数事件都保持 done（除 reset → idle）', () => {
  // 业务事件（success/failure/needs_agent/human_input/regression_detected）保持 done
  const businessEvents: ScheduleEvent[] = [
    'success',
    'failure',
    'needs_agent',
    'human_input',
    'regression_detected',
  ]
  for (const e of businessEvents) {
    assert.equal(nextState('done', e), 'done', `done + ${e} should stay at done`)
  }
  // reset 永远回 idle（包括 done）
  assert.equal(nextState('done', 'reset'), 'idle')
  // timeout 视为"全局陷阱"→ failed（即使在 done 状态也进入失败态以触发恢复）
  assert.equal(nextState('done', 'timeout'), 'failed')
})

test('nextState: failed 的 success 恢复 idle（不是 collecting）', () => {
  // 这是设计选择：失败恢复后需要 idle 等下一次 tick 触发 collecting
  assert.equal(nextState('failed', 'success'), 'idle')
})

/* -------------------------------------------------------------------------- */
/* 辅助函数                                                                   */
/* -------------------------------------------------------------------------- */

test('isTerminal: done 和 failed 是终态', () => {
  assert.equal(isTerminal('done'), true)
  assert.equal(isTerminal('failed'), true)
  assert.equal(isTerminal('idle'), false)
  assert.equal(isTerminal('collecting'), false)
  assert.equal(isTerminal('blocked'), false)
})

test('isWorking: 工作状态', () => {
  assert.equal(isWorking('idle'), false)
  assert.equal(isWorking('done'), false)
  assert.equal(isWorking('failed'), false)
  assert.equal(isWorking('blocked'), false)
  assert.equal(isWorking('collecting'), true)
  assert.equal(isWorking('converting'), true)
  assert.equal(isWorking('diffing'), true)
  assert.equal(isWorking('analyzing'), true)
  assert.equal(isWorking('generating'), true)
  assert.equal(isWorking('testing'), true)
  assert.equal(isWorking('committing'), true)
  assert.equal(isWorking('spawning_agent'), true)
})

test('remainingSteps: 工作流进度估算', () => {
  assert.equal(remainingSteps('idle'), WORKFLOW.length)
  assert.equal(remainingSteps('collecting'), WORKFLOW.length - 1)
  assert.equal(remainingSteps('done'), 0)
  assert.equal(remainingSteps('failed'), 0)
  assert.equal(remainingSteps('spawning_agent'), 0) // 不在 WORKFLOW 中
})

/* -------------------------------------------------------------------------- */
/* 真实场景 trace                                                             */
/* -------------------------------------------------------------------------- */

test('scenario: 一次完整 run-once（无 issue）', () => {
  // 模拟 run-once 的完整路径
  let s: State = 'idle'
  const trace: Array<{ from: State; event: ScheduleEvent; to: State }> = []

  const step = (from: State, event: ScheduleEvent) => {
    const to = nextState(from, event)
    trace.push({ from, event, to })
    return to
  }

  s = step(s, 'success') // → collecting
  assert.equal(s, 'collecting')
  s = step(s, 'success') // → converting
  assert.equal(s, 'converting')
  s = step(s, 'success') // → diffing
  assert.equal(s, 'diffing')
  s = step(s, 'success') // → analyzing
  assert.equal(s, 'analyzing')
  s = step(s, 'success') // → generating
  assert.equal(s, 'generating')
  s = step(s, 'success') // → testing
  assert.equal(s, 'testing')
  s = step(s, 'success') // → committing
  assert.equal(s, 'committing')
  s = step(s, 'success') // → done
  assert.equal(s, 'done')

  // 8 次转移，从 idle 到 done
  assert.equal(trace.length, 8)
  assert.equal(trace[0].from, 'idle')
  assert.equal(trace[trace.length - 1].to, 'done')
})

test('scenario: 检测到持久 issue 派发 agent', () => {
  let s: State = 'idle'

  s = nextState(s, 'success') // → collecting
  s = nextState(s, 'success') // → converting
  s = nextState(s, 'success') // → diffing
  s = nextState(s, 'success') // → analyzing
  s = nextState(s, 'needs_agent') // → spawning_agent
  assert.equal(s, 'spawning_agent')
  s = nextState(s, 'success') // → idle (agent 完成后)
  assert.equal(s, 'idle')
})

test('scenario: 回归检测导致回到 generating', () => {
  let s: State = 'idle'

  s = nextState(s, 'success') // collecting
  s = nextState(s, 'success') // converting
  s = nextState(s, 'success') // diffing
  s = nextState(s, 'success') // analyzing
  s = nextState(s, 'success') // generating
  s = nextState(s, 'success') // testing
  s = nextState(s, 'regression_detected') // → generating
  assert.equal(s, 'generating')
  s = nextState(s, 'success') // testing
  assert.equal(s, 'testing')
  s = nextState(s, 'success') // committing
  s = nextState(s, 'success') // done
  assert.equal(s, 'done')
})
