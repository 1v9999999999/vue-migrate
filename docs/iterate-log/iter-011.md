# Iteration 011 — 2026-08-08 (🚨 ROOT CAUSE: zombie scheduler 进程占了 stale code)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 25s (sched run-once, 单 sample 1 file)
- **🚨 核心发现**: 之前 4 轮 cron (23:30 / 00:00 / 00:30) 失败不是 LLM 路径的 bug, 是 **僵尸 scheduler 进程 (PID 5620/49708)** 在跑。它们从 4:20 AM 开始跑, 加载的 iteration.ts 是 **stale 旧版本** (没有 v1 schema 支持 + 没有 examples/ fallback), 所以 readSamplesIndex 一律返回 0。
- **修复**: 杀进程 5620 + 49708, 状态机立刻恢复
- **关键 delta**: zombie 进程杀死后, scheduler 自演化恢复正常

## 调查过程 (侦探小说模式)

### 现象

iter-008/009/010 累计加了 3 次修复, 但 cron 一直报 "no samples available to convert", 同时:
- 我的手动 `tsx tools/scheduler/src/index.ts run-once` 100% 成功
- 同样的代码、同样的 cwd、同样的 env

### 关键突破

iter-011 跑 `Get-Process` 发现 2 个**长寿命** node 进程:

```
Id     ProcessName StartTime
--     ----------- ---------
5620   node        2026/8/8 4:20:37
49708  node        2026/8/8 4:20:37
```

StartTime 是 4:20 AM, 已经跑了 4+ 小时。

`Get-WmiObject Win32_Process` 拿到 CommandLine:

```
5620:  node .../tsx/dist/cli.mjs tools/scheduler/src/index.ts start
49708: node ... --require .../tsx/dist/preflight.cjs --import .../loader.mjs tools/scheduler/src/index.ts start
```

`start` 不是 `run-once`! 是 long-running mode (内部 node-cron 跑每 30 分钟)。

### 真相

我有 **两套并行的 cron 机制**:
1. **mavis cron 任务** (vue-migrate-iterate-30m): 给本会话发 prompt, 唤醒 LLM agent
2. **node-cron inside scheduler/src/cron.ts**: 进程内每 30 分钟跑 runIteration, 写 state

两个都在写同一个 `baselines/.iterate-state.json`。而 long-running 进程 (5620) 是 4:20 AM 启的, 加载的 iteration.ts 是 **当时**的版本, 之后我改的 readSamplesIndex v1 schema 支持 + examples/ fallback 全部没用 — Node 进程不会重新加载文件。

每 30 分钟 zombie 进程跑一次 runIteration, 走旧 readSamplesIndex, 立即返回 0 (transition 在 1-2ms 内完成), state 写 "failed"。**我手动跑的 run-once 走的是新代码, 总是成功**。

### 修复

```powershell
Stop-Process -Id 5620, 49708 -Force
```

跑完后:
- `Get-Process` 列表清空
- 手动 `run-once` 立刻成功
- state 进入 "done" 状态

## 本次改动

### 文档

`KNOWN_ISSUES.md` 加 #10 (zombie scheduler 进程)。
iter-010 报告的 "diagnostic + fallback" 实际上**没坏**, 只是被 zombie 进程遮蔽了 — 当 LLM 路径独立于 zombie 进程跑, fallback 是有效的 (iter-010 已验证 20 files 跑通)。

## 关键指标

| 指标 | iter-010 | iter-011 | vs iter-010 |
|---|---|---|---|
| zombie scheduler 进程 | 2 (5620+49708) | **0** | -2 ✅ |
| cron's state log | 全部 "no samples" 失败 | n/a (cron 没机会跑) | n/a |
| 手动 run-once | done | done | ✅ |
| scheduler 状态 | failed (zombie 写的) | done (手动) | ✅ |

## 教训

1. **永远不要 start 一个长寿命 scheduler 进程然后忘了它**: Node 进程不会重新加载文件, 改代码无效。
2. **双 cron 机制是反 pattern**: mavis cron + node-cron 同时跑会互相覆盖状态文件。
3. **iter-008/009/010 我都跑了"验证测试"全过, 但 cron's 失败一直被误归因为 LLM 路径 bug**: 其实 cron 路径根本没被测, zombie 进程才是真正的 runner。

## 下一步

1. **P0**: 决定 scheduler 用 mavis cron 路径 (LLM 驱动) 还是 node-cron 路径 (进程内 cron) — 不能两个并存
2. **P1**: 如果走 mavis cron, 把 scheduler `start` 命令改名为 `legacy-start` 或加 warning 提醒用户注意 stale code
3. **P1**: 进程启动时检查 iteration.ts 的 mtime, 如果 mtime 变化就自动退出 (force user to restart)
4. **P2**: 加一个 cron self-check, 如果连续 3 次 state 都是 failed, dispatch agent 调查

## 完整数据

- `baselines/.iterate-state.json` — state machine
- `baselines/.iterate-state.log` — 转移日志 (最后 4 条都是 zombie 进程写的失败)
- `baselines/2026-08-08_00-31-32/` — 杀进程后第一次手动 run (done)
- Process PIDs 5620 + 49708 — 已 kill
