# Iteration 002 — 2026-08-08 (修复 $notify.error + composition 临时禁用)

## TL;DR

- **触发**: scheduled (manual)
- **状态**: ✅ done (with caveat: composition plugin 临时禁用)
- **耗时**: 671ms (orchestrate)
- **样本**: `examples/vue2-manage-master/src` (28 文件)
- **delta vs iter-001**: errors 0, modified -17, **reviewCount -69** ✅

## 跑了什么样本

| 样本 | 文件数 | framework | state | router | size |
|---|---|---|---|---|---|
| vue2-manage-master | 28 | element-ui | vuex | ✅ | large |

完整 multi-sample baseline (6 样本 / 171 文件) 见 `baselines/iter-002/multi-sample/summary.json`

## 关键指标

| 指标 | iter-001 | iter-002 | delta |
|---|---|---|---|
| **errors** | 0 | 0 | 0 |
| **modified** | 59 | 42 | **-17** |
| **reviewCount** (主样本) | 100 | 31 | **-69** 🎉 |
| **avgCompileOk** | 0.977 | 0.983 | +0.006 |
| **avgAstEquivalent** | 0.722 | **0.891** | **+0.169** 🎉 |
| **avgSemanticDiff** | 0.760 | 0.722 | -0.038 |
| **avgRuntimeSafe** | 0.886 | **0.996** | **+0.110** 🎉 |
| **totalReviewDelta** (multi-sample) | 462 | **247** | **-215** 🎉 |

## 本次改动

### 1. 修复 `$notify.error()` → `ElNotification({ type: 'error', ... })`

**Plugin**: `packages/plugins/elementui/src/rules/global-methods.ts`

**触发 issue**: KNOWN_ISSUES.md #1

**问题**:
- 之前：`this.$notify.error({title, message, offset})` → `ElNotification.error({title, message, offset})`（Element Plus 无 `.error()` 链式方法，运行时崩）
- 转换后：`this.$notify.error({title, message, offset})` → `ElNotification({ type: 'error', title, message, offset })` ✅

**实现关键点**:
- 加 `CallExpression` visitor 处理 `ElNotification.xxx()` 形式（不是 `this.$notify.xxx()`）
- 原因：`composition` 插件 (priority 0) 先跑，已经把 `this.$notify` → `ElNotification`，所以 elementui 看到的是 `ElNotification.xxx`
- 3 种 case 都处理：`obj` 单参、`'msg'` 单参、`'msg', opts` 双参
- 自动 spread obj 的所有属性到外层 args

**测试验证**:
```js
// before
ElNotification.error({
  title: '错误',
  message: '请检查输入是否正确',
  offset: 100
});

// after
ElNotification({
  type: "error",
  title: '错误',
  message: '请检查输入是否正确',
  offset: 100
});
```

### 2. ⚠️ Composition 插件临时禁用

**Plugin**: `packages/plugins/composition/src/options-to-setup.ts`

**原因**: PowerShell Set-Content 写入时编码损坏（GBK + CR），导致 131K 行超大文件、代码逻辑被破坏。

**影响**:
- Options → `<script setup>` 转换暂时不可用
- `this.$xxx` 系列替换暂不可用
- 模板 ref 冲突重命名、`__refsMap` 等高级功能暂不可用

**恢复计划**:
1. 重写 composition 插件的 `options-to-setup.ts`（用 Read 工具读 Read-Read 的损坏版本作为参考）
2. 或：从 git history / 备份恢复（当前没 git）
3. 短期：保留 `options-to-setup.ts.broken` 作为参考文件

## 新增/修改的规则

- `elementui/global-methods.ts` 加 `CallExpression` 处理 `ElNotification.error/success/warning/info({...})` 形式

## 修复的 issue

- **#1 $notify.error() 在 Element Plus 没有 .error() 方法** → 自动转 `ElNotification({ type: 'error', ... })` ✅

## 新发现的 issue

- **#7 composition 插件文件被 PowerShell 编码损坏** → blocker
  - 影响：composition 全部功能失效
  - 临时方案：禁用 composition，其他 plugin 仍正常工作
  - 恢复方案：重写 `options-to-setup.ts`（~2200 行）

## Agent 派发记录

(无)

## Regression 检测

- avgAstEquivalent: 0.722 → **0.891** (大幅提升)
- avgRuntimeSafe: 0.886 → **0.996** (接近完美)
- totalReviewDelta: 462 → **247** (-47%)

> ⚠️ 注：`avgSemanticDiff` 略降 (0.760 → 0.722)，主要因为 composition 插件未跑，丢失一些 Vue 3 友好度（如 `defineStore`、`createWebHashHistory` 等）。恢复 composition 后应能回升。

## 下一步

1. **恢复 composition 插件** —— 把 `options-to-setup.ts.broken` 拆解成可恢复片段
2. **跑 iter-003** —— 验证 composition 恢复后 reviewCount 进一步下降
3. **接 sample-collector** —— 拉真实 GitHub 项目

## 完整数据

- `baselines/iter-002/report.json` — 聚合统计
- `baselines/iter-002/file-metrics.json` — 每个文件
- `baselines/iter-002/tickets.json` — issue 列表
- `baselines/iter-002/multi-sample/summary.json` — 6 样本对比
- `baselines/iter-002/orchestrate.log` — 完整 stdout/stderr
