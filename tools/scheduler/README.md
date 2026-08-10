# vue-migrate scheduler

vue-migrate 自演化系统的"心脏"：每 30 分钟一次完整迭代，**collect → convert → diff → analyze → generate → test → commit**。如果某条 issue 连续 3 次迭代没修好，自动派发子 agent 处理。

## 安装

在 `tools/scheduler/` 目录下：

```powershell
cd D:\Projects\NB_EST\qiuzhi\vue-migrate\tools\scheduler
pnpm install
```

（依赖：`tsx`、`node-cron`、`@types/node`、`typescript`。根 `package.json` 已通过 `pnpm-workspace.yaml` 工作区解析，无需重复装。）

## 用法

```powershell
# 从 vue-migrate 根目录
cd D:\Projects\NB_EST\qiuzhi\vue-migrate

# 启动长跑调度（30 分钟一次，首次立即跑）
pnpm --filter @vue-migrate/scheduler start
# 等价于：
tsx tools/scheduler/src/index.ts start

# 只跑一次迭代
tsx tools/scheduler/src/index.ts run-once

# 打印当前 state
tsx tools/scheduler/src/index.ts status

# 重置 state
tsx tools/scheduler/src/index.ts reset

# 暂停 / 恢复
tsx tools/scheduler/src/index.ts pause
tsx tools/scheduler/src/index.ts resume

# 列出 open 的 agent tickets
tsx tools/scheduler/src/index.ts tickets
```

## 架构

```
tools/scheduler/
├── package.json
├── README.md
├── src/
│   ├── state-machine.ts      纯函数：状态转移表 + 事件路由
│   ├── persistence.ts        原子写 state + 变更日志 + pause 标志
│   ├── iteration.ts          单次迭代主流程（状态机驱动）
│   ├── agent-dispatcher.ts   shouldSpawnAgent + spawnAgentForIssue
│   ├── cron.ts               30 分钟 node-cron 调度器
│   ├── index.ts              CLI 入口
│   └── __tests__/
│       └── state-machine.test.ts
```

## 状态机

```
idle ──┬─→ collecting ──→ converting ──→ diffing ──→ analyzing ──┬─→ generating ──→ testing ──┬─→ committing ──→ done
       │                                                                │                              │
       │                                                                └─→ spawning_agent ──→ idle     └─→ spawning_agent
       │                                                                └─→ testing (regression)            
       │                                                                                                     
       ├─→ blocked (人工介入) ──→ idle                                                                       
       └─→ failed ──→ idle / blocked                                                                        
```

详细状态转移表见 `src/state-machine.ts:31`。

## 持久化

所有状态存到 `baselines/.iterate-state.json`：

- **写**：`writeFile` 到 `.tmp-{pid}-{ts}` → `rename` 到目标（POSIX 原子）
- **读**：文件不存在或损坏时返回初始 state（不抛错）
- **日志**：每次 transition 追加一行到 `baselines/.iterate-state.log`
- **暂停标志**：`baselines/.iterate-state.paused` 文件存在 = 暂停
- **报告存档**：每次完整 iteration 的 `IterationReport` 存到 `baselines/reports/{id}.json`

## 资源限制

- **单次迭代硬超时**：30 分钟（`ITERATION_TIMEOUT_MS` in `iteration.ts`）
- **单步子进程超时**：10 分钟（`STEP_TIMEOUT_MS`）
- **30 分钟 cron 调度**：`node-cron` 表达式 `"0,30 * * * *"`

## Agent 派发协议

当同一个 `IssueTicket.id` 在最近 3 轮 reports 中都出现且 `failedAttempts >= 3`：

1. `shouldSpawnAgent` 选出优先级最高的 issue
2. `spawnAgentForIssue` 写 ticket 到 `baselines/.agent-tickets/{issueId}.md`
3. **主进程**（人类 / Claude 父会话）轮询 `.agent-tickets/` 目录
4. 对每个新 ticket，用 `mavis` 工具调用 `task` 子 agent
5. Agent 完成后修改 `issue.status = 'fixed' / 'wontfix'`，scheduler 下一轮会看到

> 为什么不直接调 mavis？
> - scheduler 是长跑进程，无法用 mavis 工具（会话级工具）
> - 派发由主进程协调，scheduler 只负责"写 ticket"
> - scheduler 崩溃/重启不影响 ticket 队列

## 故障恢复

- 调度器重启时从 `.iterate-state.json` 恢复当前 `state`
- 不会重复已完成阶段（state 记录了上次停在哪）
- SIGINT / SIGTERM 时先 `saveState` 再退出

## 单测

```powershell
cd D:\Projects\NB_EST\qiuzhi\vue-migrate\tools\scheduler
pnpm test
# 等价于：
tsx --test src/__tests__/state-machine.test.ts
```

测试覆盖：

- TRANSITIONS 表完整性（每个 state 都有定义 + 目标 state 合法）
- `canTransition`：合法转移、非法转移（跳阶段）、self-loop 禁止、终态隔离
- `nextState`：完整 happy path、failure 路径、needs_agent、human_input、regression_detected
- 连续失败场景
- 终态事件隔离（done 拒绝所有非 reset 事件）
- 辅助函数：`isTerminal`、`isWorking`、`remainingSteps`
- 真实场景 trace（无 issue 完整 run、检测到 issue 派发、回归回滚）

## 验收

- [x] `tsx tools/scheduler/src/index.ts run-once` 跑完完整迭代（其他子系统未就绪时 graceful）
- [x] `tsx tools/scheduler/src/index.ts status` 打印当前 state
- [x] 单测覆盖所有 state transition
- [x] 重启后能恢复 state
