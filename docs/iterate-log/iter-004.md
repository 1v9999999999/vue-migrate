# Iteration 004 — 2026-08-08 (review note 去重优化)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 711ms
- **主样本 delta vs iter-003**: review 31 → **27** (降 4)
- **multi-sample delta vs iter-003**: totalReviewDelta 247 → **231** (降 16)

## 跑了什么样本

| 样本 | 文件数 | iter-003 review | iter-004 review | delta |
|---|---|---|---|---|
| compo-test | 1 | 21 | 20 | -1 |
| stress-compo | 4 | 21 | 20 | -1 |
| test-keep | 2 | 0 | 0 | 0 |
| vue2-element-touzi-admin | 50 | 50 | 41 | **-9** |
| vue2-manage-master (主) | 28 | 31 | 27 | **-4** |
| vue2-sample | 30 | 45 | 44 | -1 |
| **TOTAL** | 171 | 247 | 231 | **-16** |

## 本次改动

### 1. `packages/plugins/elementui/src/rules/icon.ts`

- 加 `seenIconClasses` Set 做 per-file 内的 el-icon class 去重
- 一个文件多个 `el-icon-plus` 现在只发 1 个 review note（"class 已合并到 el-icon 上"）
- 影响最大的是 addShop.vue（3 个 el-icon-plus → 1 个 review）

### 2. `packages/plugins/vue3-types/src/rules/mark-todos.ts`

- 之前是 per-enclosing-function 发 review note（一个 method 用 3 次 this.$router 就 3 个 review）
- 改为 per-file-per-category 一次（同一 file 里 5 个 method 用 this.$router 只发 1 个 review）
- 影响：`$router/$route/$refs/$store/$listeners/$children/$scopedSlots` 7 个类别都去重

### 3. `packages/plugins/composition/src/options-to-setup.ts`

- stub 模式下 `replaceThisInBody` 仍跑，会误加 `Object.assign` review note
- 注释掉 reactive 数组 `Object.assign` 替换（等 composition 真正恢复后再启用）

## 关键指标对比

| 指标 | iter-002 | iter-003 | iter-004 | vs iter-002 |
|---|---|---|---|---|
| 主样本 reviewCount | 31 | 31 | 27 | **-4** |
| multi-sample totalReviewDelta | 247 | 247 | 231 | **-16** |
| avgCompileOk | 0.983 | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0.996 | 0 |

AST/Semantic/RuntimeSafe 指标没变（改动只去重 review，不改转换逻辑）。

## 下一步

1. **继续 review note 去重**：vuex-pinia 那个 "import Vuex but no new Vuex.Store" review 仍然有 3 个（每个 import Vuex 的 file 一个），可以接受
2. **P0 composition 修复**：仍然 disabled，下次 cron 唤醒尝试重写更完整版
3. **P1 修下一个 issue**：#2 Pinia mutation merge 边缘 case（影响小）

## 完整数据

- `baselines/iter-004/report.json`
- `baselines/iter-004/multi-sample/summary.json` (totalReviewDelta 231)
- `baselines/iter-004/file-metrics.json`
- `baselines/iter-004/tickets.json` (空)
