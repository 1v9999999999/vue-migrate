# Iteration 003 — 2026-08-08 (composition 恢复尝试 + 回退)

## TL;DR

- **触发**: manual
- **状态**: ⚠️ partial（composition 暂保持 disabled，跟 iter-002 状态一致）
- **耗时**: 691ms
- **delta vs iter-002**: **0**（composition 跑不动，新简化版 regress）

## 本次尝试

### 1. 恢复 composition 插件

- 原始 `options-to-setup.ts` 被 PowerShell 损坏（CR 行尾 + 575 个 \ufffd + 注释与代码挤在一行 + 字符串未结束）
- 我做了 2 步恢复：
  1. **Python 自动 fix loop**：用 `errors='replace'` 读，用 `??→空格`/`'??,→','` 等 pattern 修复
  2. **重写 800 行简化版**：用 Read 工具读 broken 残片，保留关键 API（data → ref/reactive、this.$emit/route/router/store/...、template ref 冲突、__refsMap）

### 2. ⚠️ 新简化版 regressions

iter-003（带简化版 composition）vs iter-002（composition stub）：

| 指标 | iter-002 | iter-003 | delta |
|---|---|---|---|
| avgCompileOk | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | **0.737** | **-0.154** ❌ |
| avgSemanticDiff | 0.722 | 0.648 | -0.074 |
| avgRuntimeSafe | **0.996** | **0.878** | **-0.118** ❌ |
| totalReviewDelta | 247 | 255 | +8 |

**主样本**:
- iter-002: reviewCount=31
- iter-003: reviewCount=34（多 3 个来自简化版不严谨的 review note）

**regression 原因**:
1. 简化版丢失了 el-icon class 合并逻辑
2. 简化版 reactive 数组 `Object.assign(x, [])` 转 `splice` 的优化没做
3. 简化版 `import` path 处理（`element-ui → element-plus`）可能没原版好
4. 简化版有 bug：`computed` body 里的 `this.xxx` 没被 `replaceThisInBody` 处理（部分修复后仍可能不完整）

### 3. 决定：回退到 stub 状态

为避免 regression，**composition 仍保持 disabled**（result.changed = false，stub 行为），等后续迭代从备份恢复原版再启用。

## 当前 best 状态（iter-002）

| 指标 | 值 |
|---|---|
| 主样本 reviewCount | 31 |
| avgCompileOk | 0.983 |
| avgAstEquivalent | 0.891 |
| avgRuntimeSafe | 0.996 |
| totalReviewDelta | 247 |

## 下一步

1. **重写更完整的 composition** —— 修 bug，恢复 reactivity 数组 splice 优化，恢复 import path 智能处理
2. **或者从备份恢复** —— broken 文件保留在 `packages/plugins/composition/src/options-to-setup.ts.broken`，可能有部分代码可提取
3. **iter-004 目标** —— 让 composition 跑得比 stub 更好

## 完整数据

- `baselines/iter-003/report.json`
- `baselines/iter-003/multi-sample/summary.json`
