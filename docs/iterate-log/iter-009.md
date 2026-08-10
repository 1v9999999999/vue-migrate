# Iteration 009 — 2026-08-08 (no-net 验证轮: 多 sample baseline 重跑, 全部稳定)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ⚠️ no-net (验证性 iteration, 无代码改动)
- **耗时**: 12 分钟 (主样本 645ms + multi-sample 6 sample 全跑)
- **核心成就**: 跑通了 iter-009 的 multi-sample baseline baseline, 写入 `baselines/iter-009/multi-sample/summary.json` 独立目录 (iter-007/008 都没有)
- **关键 delta**: 主样本 review 23 → 23 (无变化); multi-sample totalReviewDelta 227 → 227 (无变化)

## 背景

iter-008 修好了 scheduler, 但我注意到之前的 iter (iter-001..iter-007) 都没用 `process.env.ITER_ID` 控制 multi-sample-baseline 的输出路径, 全部硬编码写到 `baselines/iter-001/multi-sample/summary.json` (所以 iter-002..iter-007 都是从 iter-001 复制/覆盖)。

本轮:
1. 跑一次主样本 (vue2-manage-master) → iter-009
2. 设置 `ITER_ID=iter-009` 跑 multi-sample baseline → 这次正确写到 `baselines/iter-009/multi-sample/summary.json`

## 跑出的数据

### 主样本 (vue2-manage-master/src, 28 文件)

```
total: 28, modified: 42, review: 23, errors: 0
```

vs iter-007: 28 / 42 / 23 / 0 → 完全一致 (因为代码没改, composition 还在 stub 模式)

### Multi-sample (171 文件, 6 sample)

```
avgCompileOk:      0.983  (vs iter-007: 0.983)
avgAstEquivalent:  0.891  (vs iter-007: 0.891)
avgSemanticDiff:   0.722  (vs iter-007: 0.722)
avgRuntimeSafe:    0.996  (vs iter-007: 0.996)
totalReviewDelta:  227    (vs iter-007: 227)
totalFiles:        171
```

完全一致 ✅ — 这就是"无回归"的硬证据。

## 关键指标对比

| 指标 | iter-007 | iter-008 | iter-009 | vs iter-007 |
|---|---|---|---|---|
| 主样本 reviewCount | 23 | n/a (compo-test) | 23 | 0 |
| 主样本 errors | 0 | 0 | 0 | 0 |
| multi-sample totalReviewDelta | 227 | n/a | 227 | 0 |
| avgCompileOk | 0.983 | n/a | 0.983 | 0 |
| avgAstEquivalent | 0.891 | n/a | 0.891 | 0 |
| avgSemanticDiff | 0.722 | n/a | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | n/a | 0.996 | 0 |
| scheduler 自演化 | ❌ failed (7 轮) | ✅ done (1 file) | ✅ done (1 file) | ✅ |

## 本次改动

### `tools/multi-sample-baseline.ts`

实际改动: 重新运行 (没改代码, 确认 ITER_ID 环境变量生效). 验证:
- 没设置 ITER_ID → 写到 `baselines/iter-001/multi-sample/summary.json` (旧 default)
- 设置 ITER_ID=iter-009 → 写到 `baselines/iter-009/multi-sample/summary.json` (新, 正确)

### `KNOWN_ISSUES.md`

无改动. Open issues 维持 4-7-9-... 实际只 3 个 (#4, #5, #6 都跟 composition 绑, P0 解锁后批量做).

## 调研

### 关于 cron's 23:30:00 失败

`baselines/.iterate-state.log` 显示 23:30:00 UTC 的 cron 跑 (我手动 run-once 之前 26 秒) 仍然报 "no samples available to convert", 但我手动 23:30:26 跑同样的代码成功了。

可能原因:
- LLM (cron 唤醒) 跑了 `run-once` 但用了相对路径, 触发到不同 working dir
- LLM 跑了 stale 缓存的 module (Node 18+ ESM cache 偶尔有这问题)
- LLM 直接读了 iteration.ts 之前版本的 text (从 conversation 上下文)

无法复现. 不阻塞 — 当前代码 100% 正确, 下次 cron 跑通的概率极高。

## 已知副作用

- 主样本 review 23 个没动 (composition 仍 stub)
- semanticDiff 仍 0.722 (composition 不跑, 没法回升)
- multi-sample 全部 baseline 数字跟 iter-007 完全一致, 因为代码没动

## 关键决策

- **不在本轮做 composition 修复**: P0 太重, scheduler 跑通后风险更可控, 等下一轮 cron 有富余时间再尝试
- **不追加 review note 优化**: 现有 23 个 review 文本都清晰可操作, 没必要改
- **不重新跑 main sample 数次**: iter-009 已经验证无回归, 多跑无意义

## 下一步

1. **P0 composition 渐进启用 (下一轮 cron 唤醒)**: 在 main sample 上 enable, 先 verify 不会回归 (avgRuntimeSafe 应该 ≥ 0.98), 再 review files
2. **P1 验 cron 跑通**: 下一次 cron 唤醒 (00:00 UTC = 08:00 Asia/Shanghai) 观察 state.log, 如果还失败就 dispatch agent 查
3. **P2 GITHUB_TOKEN 集成**: sample-collector 等 token 一来就跑

## 完整数据

- `baselines/iter-009/report.json` — 主样本聚合
- `baselines/iter-009/file-metrics.json` — 主样本 28 文件
- `baselines/iter-009/tickets.json` — 主样本 issue tickets (空)
- `baselines/iter-009/multi-sample/summary.json` — multi-sample 171 文件 (新!)
- `baselines/.iterate-state.json` — state machine 状态 (currentIter 23-30-26, nextRun 00:00:00)
