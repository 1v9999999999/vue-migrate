# Iteration 005 — 2026-08-08 (vuex-pinia 动态 commit 检测 + mapState 门控)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 687ms
- **主样本 delta vs iter-004**: review 27 → **27** (无变化，但代码质量改进)
- **multi-sample delta vs iter-004**: 231 → **231** (无变化)

## 本次改动（防御性代码改进）

### 1. `packages/plugins/vuex-pinia/src/index.ts`

#### 1a. 动态 commit 名检测

- `replaceCommitCallsInBody` 现在支持 `dynamicCommits?: string[]` 参数
- 检测 `commit('xxx' + var, ...)` 这种非字符串字面量 commit（之前直接忽略，留在 action body 里）
- 收集表达式到 `dynamicCommits` 数组
- `convertVuexAction` caller 收到后，遍历 dynamicCommits 加 review note "动态 commit 名需手动迁移"

**为什么之前没生效**: vue2-manage-master 的 `commit('saveAdminInfo', ...)` 全是字符串字面量，没有动态 commit 案例。

**实际效果**: 未来遇到 `commit('save' + name, payload)` 会自动给 review。这是**装弹**改进。

#### 1b. mapState/mapActions 门控

- 之前：`import Vuex from 'vuex'` 但没 `new Vuex.Store` → 每个 file 加 1 review
- 现在：只在 file 实际用了 `mapState/mapActions/mapMutations/mapGetters` 时才加 review
- vue2-manage-master 三个 file（headTop/adminSet/login）都用了 `mapActions/mapState`，所以 review 仍然发

**为什么之前没生效**: 当前样本里 3 个 file 都用了 mapState，触发条件都满足。

### 2. 更新 KNOWN_ISSUES.md

- 标记 issue #2 已修（部分）
- 加入"已修"区 A12

## 关键指标对比

| 指标 | iter-002 | iter-003 | iter-004 | iter-005 | vs iter-002 |
|---|---|---|---|---|---|
| 主样本 reviewCount | 31 | 31 | 27 | 27 | -4 |
| multi-sample totalReviewDelta | 247 | 247 | 231 | 231 | -16 |
| avgCompileOk | 0.983 | 0.983 | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0.996 | 0.996 | 0 |

**纯防御性改进**：所有指标不动，但代码能处理之前不能处理的边界 case。

## 下一步

1. **P0 composition 修复**：仍然是 disabled，下次 cron 唤醒尝试重写更完整版
2. **P1 修下一个 issue**：#3 Vue Router 4 `mode: 'abstract'`（不在当前样本，但加个 review note 简单）
3. **P1 #5 reactive 数组 splice**：把 disabled 的 reactive 赋值检测挪到 vue3-types 或 vue2-compat，让 composition 不跑也能 detect

## 完整数据

- `baselines/iter-005/report.json`
- `baselines/iter-005/multi-sample/summary.json`
- `baselines/iter-005/file-metrics.json`
- `baselines/iter-005/tickets.json`
