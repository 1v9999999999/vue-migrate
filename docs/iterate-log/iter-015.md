# Iteration 015 — 2026-08-08 (iter-014 fix 跨 sample 验证 + multi-sample baseline)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done (验证性 iteration, 无代码改动)
- **耗时**: 8 min (跑 vue2-sample + multi-sample baseline)
- **核心成就**: 验证 iter-014 fix 在 vue2-sample 上也工作正常, multi-sample baseline 全部指标跟 iter-007 持平 (227 review, 0.996 runtimeSafe)
- **关键 delta**: 0 改动; 验证 0 regression; iter-014 multi-sample baseline 现在有独立目录

## 验证范围

### 1. vue2-sample (10 文件, 不同代码模式)

跑 `tsx packages/cli/src/index.ts transform examples/vue2-sample/src -o $env:TEMP\iter15-vue2sample`:

输出文件检查:
- `main-full.js` line 6: `import ElementPlus from "element-plus";` ✅ (default only, 没 named)
- `StressTest.vue` line 171: `import ElementPlus, { ElMessage, ElMessageBox, ElNotification, ElLoading } from "element-plus";` ✅ (merged, no duplicate)
- `App.vue`: 没 element-plus import (clean)
- 其他 vue 文件: 没 element-plus import

iter-014 fix 在 vue2-sample 也**正确工作**:
- 多 import 合并成单 import
- Message/MessageBox/Notification/Loading 自动 rename 成 El 前缀
- 没有重复声明

### 2. multi-sample baseline (171 文件, 6 sample)

跑 `tools/multi-sample-baseline.ts`:

| 指标 | iter-007 | iter-014 | vs iter-007 |
|---|---|---|---|
| avgCompileOk | 0.983 | **0.983** | 0 |
| avgAstEquivalent | 0.891 | **0.891** | 0 |
| avgSemanticDiff | 0.722 | **0.722** | 0 |
| avgRuntimeSafe | 0.996 | **0.996** | 0 |
| totalReviewDelta | 227 | **227** | 0 |
| totalFiles | 171 | **171** | 0 |

**完全一致** ✅ — iter-014 的 import 合并 fix 不会让任何 review count 变化, 因为它是**输出质量改进** (消除重复 import), 不是**新规则**。

## 关键指标

| 指标 | iter-014 | iter-015 | vs iter-014 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| vue2-sample reviewCount | 44 | 44 | 0 |
| multi-sample totalReviewDelta | n/a | 227 | (新 baseline) |
| 0 errors | ✅ | ✅ | ✅ |
| 重复 import bug | ✅ fixed | ✅ fixed (跨 sample) | ✅ |

## iter-014 multi-sample baseline 写入位置

之前所有 iter (001-013) 的 multi-sample baseline 全部写到 `baselines/iter-001/multi-sample/summary.json` (因为 ITER_ID 没传)。这次 `iter-015` 我设了 `$env:ITER_ID = "iter-014"` 重新跑, 现在 `baselines/iter-014/multi-sample/summary.json` 也有完整数据了。

(命名冲突: iter-015 的报告写了 `iter-014` 的 baseline, 因为我以为"iter-014 baseline 缺失需要补". 后面如果要分清, 看 `baselines/iter-NNN/multi-sample/summary.json` 的 mtime)

## 已知未做

- vue2-element-touzi-admin-dev-permission 没单独验证 (含 router-v4 / vuex-pinia 等复杂 plugin), 但 multi-sample baseline 跑过, 0 errors
- stress-compo / test-keep 没单独验证 (但 multi-sample 跑过)
- main.js 之类的小文件没单独验证 (但 multi-sample 跑过)

## 关键决策

- **不在本轮加新规则**: 验证阶段, 保持代码稳定
- **iter-014 fix 不需要回滚**: 跨 sample 验证通过
- **multi-sample 全部一致**: 这是"无 regression"的硬证据

## 下一步

1. **P0 composition 长期化**: 仍然 disabled, 长期任务
2. **P1 下一个简单 issue**: 看 KNOWN_ISSUES 还有什么, 但 #4/#5/#6 都跟 composition 绑
3. **P2 sample-collector 真实 GitHub**: 仍需 GITHUB_TOKEN
4. **P3 跑一次 main.js / main-full.js 单独看**: 验证简单 import 的处理

## 完整数据

- `baselines/iter-014/multi-sample/summary.json` — multi-sample aggregate (171 文件)
- `baselines/iter-014/multi-sample/work-*` — 6 sample work dirs
- `$env:TEMP\iter15-vue2sample\` — vue2-sample 输出 (10 文件, 修复正确)
- `packages/plugins/elementui/src/rules/global-methods.ts` — iter-014 fix (已稳定)
