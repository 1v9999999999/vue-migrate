# Iteration 014 — 2026-08-08 (修 element-plus import 重复声明 bug, 完整 dedup)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done (修了 iter-013 引入的次生 bug)
- **耗时**: 15 min (3 次试错: 初版 → 漏 rename → 重复声明)
- **核心修复**: `elementui/src/rules/global-methods.ts` 的 `ensureElementPlusImports` 改为: 收集所有 element-plus import, 合并 specifier 到第一个, 删掉其它的; 不再 append 新 import
- **关键 delta**: 主样本 review 23→23 (bug 不影响 review 数, 只影响输出代码质量)

## 问题来源

iter-013 修复了 import rename (Message→ElMessage), 但暴露出**重复声明**问题:

输入 (Vue2 原始):
```js
import ElementUI from 'element-ui'                    // line 149
import 'element-ui/lib/theme-chalk/index.css'        // line 150
import { Message, MessageBox, Notification, Loading } from 'element-ui'  // line 151
```

iter-013 后输出 (有 bug):
```js
import ElementPlus, { ElMessage, ElNotification, ElMessageBox, ElLoading } from "element-plus";  // line 171
import "element-plus/dist/index.css";                                                                 // line 172
import { ElMessage, ElMessageBox, ElNotification, ElLoading } from "element-plus";                // line 173 ← 重复!
```

`ElMessage` 声明了两次, 现代 bundler 报错 (严格 mode) 或 dedup (宽松 mode)。不修 user 跑不起来。

## 修复 (3 步试错)

### 试错 1: 初版 — 删掉重复 import 但不搬 specifier

```ts
for (const dup of duplicates) {
  // 删掉重复 import (没把 specifier 搬过去!)
  const idx = ctx.file.scriptAst.program.body.indexOf(dup)
  if (idx >= 0) ctx.file.scriptAst.program.body.splice(idx, 1)
}
```

结果: 重复没了, 但 ElMessage 也丢了。

### 试错 2: 加上 specifier 搬移, 但 dedup 检查用了全部 import 的 set

```ts
// bug: seenLocalNames 包含了 primary + duplicates 的所有名字
// 所以 duplicates 的 specifier 都被 skip 了
const seenLocalNames = new Set<string>()
for (const stmt of [primary, ...duplicates]) { ... }
```

结果: 还是没搬过去, ElMessage 还是丢的。

### 试错 3 (正确): 只用 primary 初始化, 搬移时去重

```ts
// 只统计 primary 已有的
const primaryNames = new Set<string>()
if (primary) {
  for (const spec of primary.specifiers) { ... }
}

// 搬移 duplicates 时: 不在 primaryNames 里就 push
for (const dup of duplicates) {
  for (const spec of dup.specifiers) {
    if (primaryNames.has(imported) || primaryNames.has(local)) continue
    primary.specifiers.push(spec)
    primaryNames.add(imported)
    primaryNames.add(local)
  }
  // 删 dup
}

// 追加 apis: 不在 primaryNames (已含 merge 后的) 里就 push
for (const name of apis) {
  if (primaryNames.has(name)) continue
  primary.specifiers.push(...)
  primaryNames.add(name)
}
```

✅ 最终输出:
```js
import ElementPlus, { ElMessage, ElMessageBox, ElNotification, ElLoading } from "element-plus";
import "element-plus/dist/index.css";
```

## 关键 bug 修复点

1. **dedup 集合初始化**: 只算 primary, 不算 duplicates (避免自我 skip)
2. **merge 顺序**: 先搬 duplicates, 再 append apis (apis 可能已经在 duplicates 里)
3. **else 分支 (没 primary)**: 用 local 的 toAddList 变量 (不再依赖已删除的 toAdd)

## 验证

- compo-test: 输出符合预期, 单 import, 全部 rename ✅
- 主样本: 28 files, 42 modified, 23 review, 0 errors (跟 iter-013 一致) ✅
- 没有引入新 review notes (latent bug 修复, 不影响用户可见的 review 数)

## 关键指标

| 指标 | iter-013 | iter-014 | vs iter-013 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| errors | 0 | 0 | 0 |
| 输出代码质量 | 重复 import 2 个 | 单 import 干净 | ✅ |

## 教训

1. **3 次试错才修对**: 因为依赖 (顺序 / dedup 集合初始化) 没想清楚
2. **console.log + 隔离测试是关键**: 没日志根本不知道是哪个分支出问题
3. **dedup 集合的初始化要明确**: 用全部 input 还是只用 primary, 结果天差地别

## 下一步

1. **P1 验证 vue2-sample 也有同样修复效果**: 测试多个场景
2. **P0 composition 仍然 stub**: 长期化任务
3. **P3 跑 multi-sample baseline iter-014**: 看 6 sample 的稳定性

## 完整数据

- `baselines/iter-014/report.json` — 主样本聚合
- `baselines/iter-014/file-metrics.json` — 28 文件
- `packages/plugins/elementui/src/rules/global-methods.ts` — 修复
- `$env:TEMP\comp-test-iter14f\StressTest.vue` — 修复后输出 (干净的 import)
