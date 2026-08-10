# Iteration 006 — 2026-08-08 (#3 标记修 / #5 试探失败 / 撤回)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ⚠️ 撤回 (no net change)
- **耗时**: 658ms (撤回后)
- **主样本 delta vs iter-005**: review 27 → **27** (0)
- **multi-sample delta**: 231 → **231** (0)

## 本次改动

### 1. 标记 issue #3 已实现（文档更新）

- `KNOWN_ISSUES.md` issue #3 标记为 ✅ 已实现
- `vue-router-v4/src/index.ts` line 214-217 已经有 `mode: 'abstract'` 处理
- 当前样本无 `mode: 'abstract'` 案例，但代码就位
- 加入"已修"区 A13

### 2. ⚠️ 尝试 issue #5 reactive 数组重置 — 撤回

- 在 `vue2-compat/src/index.ts` 加 `AssignmentExpression` visitor 检测 `this.xxx = []/{}` 模式
- 加 review note "在 Vue3 中如果 xxx 是 reactive 字段，重新赋值会丢失响应性"
- **效果**: 主样本 review 27 → **40** (+13，涨了 49%)
- **问题**: 
  1. 涨 review 不是改进（用户没看到自动转换）
  2. 简单给所有 `this.x = ...` 加 review 太宽泛
  3. 应该等 composition 修复后，识别 data() 返回的字段再针对性加 review
- **撤回**: 恢复 iter-005 状态

## 关键指标对比

| 指标 | iter-004 | iter-005 | iter-006 | vs iter-005 |
|---|---|---|---|---|
| 主样本 reviewCount | 27 | 27 | 27 | 0 |
| multi-sample totalReviewDelta | 231 | 231 | 231 | 0 |
| avgCompileOk | 0.983 | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0.996 | 0 |

**本轮无 net change**。这是 cron 节奏的一部分 —— 不是每轮都必须有突破。

## 教训

1. **不要随便加 review note** — 涨 review 不是改进（除非真帮助用户）
2. **加 review 必须配合自动转换** — 否则用户看到"需人工"但不知道怎么处理
3. **跨 plugin 知识共享是难题** — vue2-compat 不知道 data() 字段，需要 composition 或 vue3-types 协作

## 下一步

1. **P0 composition 修复（重新尝试）**：把 broken 文件的关键部分（reactive 数组 splice 优化）提取出来，写一个真正能跑的 composition
2. **P2 sample-collector 拉新样本**：让多 sample 覆盖更广（但需要 GITHUB_TOKEN）
3. **P1 review note 文本优化**：把现有 27 个 review 的内容改更清楚（不需要加数量，只改质量）

## 完整数据

- `baselines/iter-006/report.json` (与 iter-005 相同)
- `baselines/iter-006/multi-sample/summary.json`
- `baselines/iter-006/file-metrics.json`
- `baselines/iter-006/tickets.json`
