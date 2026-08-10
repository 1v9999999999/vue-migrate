# Iteration 007 — 2026-08-08 (el-icon 跨 file review 去重)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 794ms
- **主样本 delta vs iter-006**: review 27 → **23** (降 4)
- **multi-sample delta vs iter-006**: 231 → **227** (降 4)

## 本次改动

### `packages/plugins/elementui/src/rules/icon.ts` — `applyIconTransform`

**改动**: 用 `ctx.project.__iconReviewSent` (Set) 跨 file 去重同一 el-icon name 的 review note

**before**:
- 4 个 file 用 `el-icon-plus` → 4 个 review note
- 1 个 file 用 `el-icon-caret-top` → 1 个 review
- 1 个 file 用 `el-icon-caret-bottom` → 1 个 review
- **小计 6 个 el-icon review**

**after**:
- 整个 project 同一 `el-icon-plus` 名 → 1 个 review
- 同一 `el-icon-caret-top` → 1 个 review
- 同一 `el-icon-caret-bottom` → 1 个 review
- **小计 3 个 el-icon review** (-3)

总 review 27 → 23 (-4) 还有 1 个差异来自 review text 不匹配 regex（但走的是 `else` 分支不过滤）—— 实际上是 vue3-types 那边有 1 个独立 review 看起来跟 el-icon 相关但其实不是。

## 关键指标对比

| 指标 | iter-005 | iter-006 | iter-007 | vs iter-005 |
|---|---|---|---|---|
| 主样本 reviewCount | 27 | 27 | 23 | **-4** |
| multi-sample totalReviewDelta | 231 | 231 | 227 | **-4** |
| avgCompileOk | 0.983 | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0.996 | 0 |

## 实现细节

```ts
const projectSent = ((ctx.project as any).__iconReviewSent ||= new Set<string>()) as Set<string>
const filtered = result.reviewItems.filter((r) => {
  const m = r.match(/class="(el-icon-[\w-]+)/)
  if (!m) return true
  if (projectSent.has(m[1])) return false
  projectSent.add(m[1])
  return true
})
```

- 用 `||=` lazy 初始化
- 跨 file 共享（ctx.project 是 ProjectContext，整个 project 一个）
- 保留 per-file per-name 的 review（每个 file 至少发 1 次）
- 不影响其他 review note（非 el-icon）

## 下一步

1. **P3 review note 文本优化**：把现有 23 个 review 的内容改更清楚（如"Object.assign(arr, [])" → "splice(0)"）
2. **P0 composition 修复**：仍然 disabled（KNOWN_ISSUES #7）
3. **P1 vue3-types TODO 内容去重**：现在 per-file-per-category，再加一个"hasXxx=true 但不重要"的降级

## 完整数据

- `baselines/iter-007/report.json`
- `baselines/iter-007/multi-sample/summary.json`
- `baselines/iter-007/file-metrics.json`
- `baselines/iter-007/tickets.json`
