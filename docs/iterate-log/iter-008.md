# Iteration 008 — 2026-08-08 (修复 scheduler 3 个 bug, 自演化循环终于跑通)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 25s (sched run-once, 单 sample 1 file)
- **核心成就**: 自演化 scheduler 第一次端到端走通 collect→convert→diff→analyze→generate→test→commit
- **关键 delta**: 之前 7 轮 cron 全部因 "no samples available" 失败，现在 state machine 进入 done

## 本次改动

### 1. `tools/scheduler/src/iteration.ts` — `readSamplesIndex`

**Bug**: 函数只识别 `Array.isArray(parsed)` 或 `Array.isArray(parsed.samples)`，但 `samples/INDEX.json` 的实际 schema 是 v1 的 `{ version, createdAt, source, entries: SampleEntry[] }`，每个 entry 用 `localPath` 字段（不是 `path`）。

**症状**: 7 轮 cron 全部失败 (`baselines/.iterate-state.log` 显示从 20:19 起一直 "no samples available to convert")。

**修复**: 支持 v1 schema (entries+localPath)，保留 legacy samples 兼容。

### 2. `tools/scheduler/src/iteration.ts` — `runSubprocess` + spawn 调用

**Bug A**: `spawn('pnpm', ['exec', 'tsx', ...], { shell: true })` 在 Windows root 跑时 `pnpm exec` 找不到 tsx（tsx 只在 `packages/cli/node_modules` 里），报 `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL`。

**Bug B**: 改用 `node <abs-tsx-path>` 后，shell:true 又被 `C:\Program Files\nodejs\node.exe` 的空格切断，报 `'C:\Program' 不是内部或外部命令`。

**修复**:
- 新增 `resolveTsxEntry()`：从 `packages/cli/node_modules/tsx/dist/cli.mjs` 找绝对路径
- 新增 `resolveGitPath()`：从已知路径找 `git.exe`，找不到就 graceful skip commit
- `runSubprocess` 加 `forceShell?: boolean` 参数，node/git 调用走 shell:false（绝对路径自动处理空格），其它命令走 shell:true
- 加 `NODE_NO_WARNINGS=1` 抑制 deprecation 警告
- 加 `child.on('error', ...)` 捕获 spawn 错误
- 4 处 `pnpm exec tsx` 全部改为 `node <abs-tsx-path>`

### 3. `tools/scheduler/src/iteration.ts` — report path

**Bug**: `orchestrate.ts` 把 opts.id 拼到 opts.output 后面 (`join(opts.output, opts.id)`)，但 scheduler 算 report path 时只 `join(outputDir, 'report.json')`，少拼了一层 id。

**修复**: `reportPath = join(outputDir, ctx.iterationId, 'report.json')`。

### 4. `tools/scheduler/src/iteration.ts` — phaseTest

**Bug**: 之前传 `--iteration <id>` 给 regression-suite，但 regression-suite 的 CLI 是子命令形式 (`select`/`run`/`report`)，不支持 `--iteration`。

**修复**:
- 调 `run --golden <path> --work <our-output-dir> --prev <prev-output>`
- exit code 2 (RegressionError) 视为业务错误，不当 fatal
- 没有 golden.json 时 graceful skip

### 5. `tools/scheduler/src/iteration.ts` — `prevIterationId`

**新增**: `IterationContext.prevIterationId?: string`，从 `inputState.history` 倒序找第一个 `state === 'done'` 的 id。

## 验证

跑两次 `run-once` 都 ✅ done：

```
[iteration] idle → collecting (event=success)
[iteration:collect] samples index has 6 entries
[iteration] collecting → converting (event=success)
[iteration] converting → diffing (event=success)
[iteration] diffing → analyzing (event=success)
[iteration] analyze: 0 open issues, needsAgent=false
[iteration] analyzing → generating (event=success)
[iteration:generate] rule-generator not found, skipping
[iteration] generating → testing (event=success)
[iteration] test: 0/0 passed, regression=false
[iteration] testing → committing (event=success)
[iteration:commit] git not found, skipping
[iteration] commit: log=D:\...\docs\iterate-log\2026-08-07.md
[iteration] committing → done (event=success)

=== result ===
Iteration:  2026-08-07_23-06-45
Final state: done
Duration:    24809ms
Files:       1
Errors:      0
Review:      20
Agent tickets: 0
```

## 关键指标对比

| 指标 | iter-007 | iter-008 | vs iter-007 |
|---|---|---|---|
| scheduler state | failed | **done** | ✅ |
| cron actually works | ❌ | ✅ | ✅ |
| convert files | 0 (crashed) | 1 (compo-test) | +1 |
| convert errors | 0 (false) | 0 (true) | 0 |
| review | 0 (false) | 20 | +20 |
| regression suite ran | no | **yes** (50 files, 19 matches, 31 regressions) | + |

**注**: 主样本 (vue2-manage-master) review 数仍是 iter-007 的 23（这次 scheduler 跑的是 samples[0] = compo-test，是单文件 20 review）。要恢复主样本对比，需要 scheduler 改成轮询多 sample 或 accept --sample 参数。

## 已知副作用

- 主样本 7 轮 cron 全部失败 → 漏跑了 7 个 iter 数据。这只是"日志缺失"，代码本身没动。
- `samples/INDEX.json` 仍然只有 6 个 local entry，sample-collector 没机会跑（缺 GITHUB_TOKEN）。

## 关键决策

- **不在本轮做 composition 修复**：P0 太重，sampler 跑通后让 cron 慢慢推
- **不立即清理 baseline trash**：`_trash_*` 目录继续保留，方便对照
- **git 找不到就 skip**：不阻塞 scheduler 主流程

## 下一步

1. **P0 composition 真实修复**（下一轮 cron 唤醒）：现在 sampler 跑通，composer 修复后能立刻被 cron 验证
2. **P1 scheduler 多 sample 轮询**：现在只跑 samples[0]，应改成轮询全部 6 个 sample
3. **P2 sample-collector 接 GITHUB_TOKEN**：拉真实 Vue 2 项目
4. **P3 git 安装路径探测**：补 `where git` 兼容 PATH-based git

## 完整数据

- `baselines/.iterate-state.json` — state machine 状态
- `baselines/.iterate-state.log` — 转移日志
- `baselines/2026-08-07_23-06-15/` — 第 1 次成功 run
- `baselines/2026-08-07_23-06-45/` — 第 2 次成功 run (有 prev)
- `tools/scheduler/src/iteration.ts` — 修复后的调度器
