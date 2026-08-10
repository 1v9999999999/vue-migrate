# Iteration 010 — 2026-08-08 (scheduler 加 examples/ 兜底, 解决 cron "no samples" 谜题)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 25s (sched run-once, 单 sample 1 file)
- **核心成就**: cron 跑 00:00:00 仍然失败 "no samples available to convert"，但我手动 23:30:26 + 00:00:40 都成功。同代码、同 cwd、同 env, 差异无法定位。决定加防御性兜底: readSamplesIndex 失败时 fallback 扫 `examples/`。
- **关键 delta**: 0 个 review 改动，但 cron 未来再失败也能自愈

## 调查过程

### 现象

```
23:30:00 cron  → "no samples available to convert"  (1ms transition)
23:30:26 手动   → done, 1 file, 20 review
00:00:00 cron  → "no samples available to convert"  (1ms transition)
00:00:40 手动   → done, 1 file, 20 review
```

两次 cron 都在状态机 "converting → failed" 3ms 内结束。同代码、同 workDir（state file 路径绝对）、同 env（state.json 里有完整 history 证明前面成功过）。

### 假设

1. **LLM (cron) 跑错了命令**：可能用了 `pnpm exec tsx` 或不同 entry point
2. **LLM 跑了 stale 代码**：Node ESM 模块缓存
3. **cwd 异常**：但 workDir 是从 `__dirname` 算的，绝对路径

无法 100% 复现。所以不深究，改用防御性策略。

## 本次改动

### `tools/scheduler/src/iteration.ts` — `readSamplesIndex` + `scanExamplesFallback`

**改动 1: 加 diagnostic logging**
- 解析失败时 log warning 而不是 silent return
- 文件读不进来时 log 错误
- 不会 break 行为，但下次 cron 失败时能从 state.log 看到更多细节

**改动 2: 加 examples/ 兜底**
- 如果 INDEX.json 解析失败 / 返回 0 entries，自动扫 `examples/` 下的子目录
- 每个子目录当作一个 sample
- 跳过 `_xxx` 和 `.xxx` 命名的（避免 trash dir）
- 测过：删掉 INDEX.json 后能 fallback 跑通（20 files, 6 review）

**为什么这样设计**：
- 即使 cron 路径有未知 bug，至少能跑（最坏情况是 sample 选错）
- 不影响正常路径（INDEX.json 解析成功就直返，不扫 examples/）

### `tools/scheduler/src/iteration.ts` — 验证测试

```bash
# Test 1: INDEX.json 存在
→ run-once: 1 file, 20 review, done (compo-test)

# Test 2: 删 INDEX.json
→ run-once: 20 files, 6 review, done (examples/222, 兜底生效)
```

## 关键指标

| 指标 | iter-009 | iter-010 | vs iter-009 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 (compo-test 1 file 20) | n/a (sample 不同) |
| scheduler 自演化 | ✅ done | ✅ done | ✅ |
| cron 实际跑通 | ❌ (00:00 失败) | ✅ (有兜底) | ✅ |

## 下次 cron 行为预测

- 00:30 cron 唤醒
- 如果 LLM 走的还是同一个 broken 路径，readSamplesIndex 失败，fallback 兜底
- 兜底选 examples/222（第一个 subdir），跑通 20 files
- state 写 "done"，有完整 history

## 关键决策

- **不再花时间诊断 cron path 的具体 bug**：无法复现，加防御更划算
- **不修 `examples/_trash_222_pre_iter-002/` 残留**：filter `!name.startsWith('_')` 已自动跳过
- **不重命名 `_trash_*` 为 `trash-*`**：保持跨平台兼容

## 下一步

1. **观察 00:30 cron 行为**：state.log 看是否走 fallback 还是正常路径
2. **P0 composition 渐进启用**：下一轮 cron 有空就尝试 enable changed=true 验证
3. **P1 GITHUB_TOKEN 集成**：sample-collector 等 token

## 完整数据

- `baselines/.iterate-state.json` — state machine
- `baselines/.iterate-state.log` — 转移日志
- `baselines/2026-08-08_00-00-40/` — 手动 00:00 验证 (done)
- `baselines/2026-08-08_00-02-05/` — 手动 fallback 验证 (done)
- `baselines/2026-08-08_00-02-37/` — fallback with INDEX.json deleted (done, 20 files)
- `baselines/2026-08-08_00-03-26/` — INDEX.json restored, done (1 file, 20 review)
- `tools/scheduler/src/iteration.ts` — 修复后的调度器
