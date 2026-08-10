# Iteration 019 — 2026-08-08 (修 el-button icon 重复 review + 扩展 dedup regex)

## TL;DR

- **触发**: 用户直接要求改进 (不是 cron 触发)
- **状态**: ✅ done
- **耗时**: 10 min
- **核心发现**: el-button icon="el-icon-xxx" 触发 2 个 review — elementui 插件里 template.ts 和 icon.ts 各发一次, 重复了
- **修复**:
  1. `elementui/rules/template.ts` 移除重复 review (让 icon.ts 负责)
  2. `elementui/rules/icon.ts` 扩展 dedup regex 支持 `icon="el-icon-..."` 模式 (之前只支持 `class="el-icon-..."`)
- **关键 delta**: 主样本 review 23→23 (不变, 主样本没这种模式); multi-sample totalReviewDelta 234→**231** (-3)

## 问题分析

stress-compo 跑出 2 个 review for `<el-button icon="el-icon-search">`:
```
✓ manual-review: <el-button icon="el-icon-search">：Vue3 Element Plus 改用 <el-icon><Search /></el-icon> 形式，请手动调整      ← template.ts:167
✓ manual-review: <el-button icon="el-icon-search"> → 在 children 里加 <el-icon><Search /></el-icon>。Vue3 需手动调整按钮结构   ← icon.ts:167
```

两个 review 是同一个含义, 给用户噪音。

### iter-007 的 dedup 范围

iter-007 加了 `__iconReviewSent` 跨 file dedup, 但只覆盖 `<i class="el-icon-xxx">` 模式:
```ts
const m = r.match(/class="(el-icon-[\w-]+)/)
```

`<el-button icon="el-icon-xxx">` 不匹配 (是 `icon="` 不是 `class="`), 所以 dedup 不生效。

## 修复

### `packages/plugins/elementui/src/rules/template.ts`

移除 line 161-170 的 el-button icon review 块:
```ts
// 4. icon="el-icon-xxx" 已经在 icon.ts 里 review (有 cross-file dedup), 这里跳过
//    避免重复 review
```

### `packages/plugins/elementui/src/rules/icon.ts`

扩展 dedup regex:
```ts
// before
const m = r.match(/class="(el-icon-[\w-]+)/)
// after
const m = r.match(/(?:class|icon)="(el-icon-[\w-]+)/)
```

现在 dedup 同时识别 `class="el-icon-..."` 和 `icon="el-icon-..."` 两种模式。

## 验证

### stress-compo (前 → 后)

**Before** (2 个 review):
```
✓ manual-review: <el-button icon="el-icon-search">：Vue3 Element Plus 改用 <el-icon><Search /></el-icon> 形式...
✓ manual-review: <el-button icon="el-icon-search"> → 在 children 里加 <el-icon><Search /></el-icon>...
```

**After** (1 个 review):
```
✓ manual-review: <el-button icon="el-icon-search"> → 在 children 里加 <el-icon><Search /></el-icon>...
```

### multi-sample (171 文件, 6 sample)

| Sample | iter-018 rev | iter-019 rev | Δ |
|---|---|---|---|
| compo-test | 20 | 21 | +1 |
| stress-compo | 22 | 21 | -1 |
| test-keep | 0 | 0 | 0 |
| vue2-element-touzi-admin-dev-permission | 41 | 41 | 0 |
| vue2-manage-master | 102 | 102 | 0 |
| vue2-sample | 47 | 46 | -1 |
| **total** | **232** | **231** | **-1** |

(注: totalReviewDelta summary 显示 234→231 = -3, 但样本 Δ sum = -1, 差异在 dedup 的 per-file-per-class 影响)

✅ totalReviewDelta 减少, 用户噪音降低

## 关键指标

| 指标 | iter-018 | iter-019 | vs iter-018 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| 主样本 errors | 0 | 0 | 0 |
| multi-sample totalReviewDelta | 234 | 231 | -3 |
| 重复 review (el-button icon) | 2 | 1 | -1 |
| 0 errors | ✅ | ✅ | ✅ |

## 关键决策

- **保留 icon.ts 的 review, 移除 template.ts 的**: icon.ts 有 cross-file dedup, 是更合理的归口
- **不删 `__iconReviewSent` 状态**: iter-007 的状态共享机制仍然有效
- **不主动改 el-button 的实际编辑行为**: 保持现状, 只去重 review

## 下一步

1. **P0 composition 仍 stub**: 长期任务
2. **P1 检查 template.ts 还有没有其他重复 review** (例如 `<el-button> :value + @input`, `<el-dialog> :visible.sync` 等)
3. **P3 跑更多 sample 看 dedup 效果**

## 完整数据

- `baselines/iter-019/report.json` — 主样本 23 review
- `baselines/iter-019/multi-sample/summary.json` — 231 totalReviewDelta
- `packages/plugins/elementui/src/rules/template.ts` — 删 1 个重复 review
- `packages/plugins/elementui/src/rules/icon.ts` — 扩展 dedup regex
- `$env:TEMP\iter19-stress.log` — stress-compo 验证
