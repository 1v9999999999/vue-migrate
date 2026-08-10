# Iteration {NNN} — {YYYY-MM-DD}

## TL;DR

- **触发**: scheduled | manual | regression-detected | agent-spawn-completed
- **状态**: ✅ done | ⚠️ partial | ❌ failed
- **耗时**: {mm}:{ss}
- **delta vs iter-{NNN-1}**: errors {+/-x}, modified {+/-x}, reviewCount {+/-x}

## 跑了什么样本

- 主样本: `examples/{X}/src/` ({N} 文件)
- 增量样本: `samples/{org}__{repo}/` ({N} 文件)
- 金标: `baselines/golden.json` ({N} 文件)

## 关键指标

| 指标 | 数值 | vs 上轮 |
|---|---|---|
| total files |  |  |
| errors |  |  |
| modified |  |  |
| reviewCount |  |  |
| outputValid (passRate) |  |  |
| baseline.comparison.compileOk |  |  |
| baseline.comparison.astEquivalent |  |  |
| baseline.comparison.runtimeSafe |  |  |

## 新增/修改的规则

(列出本轮由 rule-generator 生成、由人 commit 的所有规则)

- `core/<plugin>/<rule>` — 描述 — 影响 N 个文件 — 关联 issue

## 修复的 issue

(从 KNOWN_ISSUES.md 的 Open 移过来的)

- issue #N: <标题> → fixed | wontfix

## 新发现的 issue

(从本次转换中分析出的新问题，加到 KNOWN_ISSUES.md)

- issue #M: <标题> — 严重度 — 文件

## Agent 派发记录

(如果有 issue 连续 3 次未修，触发 agent 派发)

- ticket: issue-{id}
- agent: mavis task
- result: success | failed
- 改动: <files>

## Regression 检测

(如果 passRate 比上轮降低 > 5%)

- 之前: {N}%
- 现在: {M}%
- 回滚动作: <是/否> — 原因

## 下一步

- 下一轮要做的: ...
- 需要人工 review 的: ...
- 需要 spawn agent 的: ...

## 完整数据

- `baselines/{iter-id}/report.json` — 聚合统计
- `baselines/{iter-id}/file-metrics.json` — 每个文件
- `baselines/{iter-id}/tickets.json` — issue 列表
- `baselines/.iterate-state.json` — 状态机快照
