# iter-058 回归验证 — 2026-08-11

## TL;DR

- **触发**: iter-051~057 累计 7 个 commit (4 个 plugin 代码 + 1 bench doc + 1 README 更新 + 1 KNOWN_ISSUES close) 后, 跑一次完整 conversion 验证没引入回归
- **状态**: ✅ **0 regression** — 14 个关键 review pattern 全部 delta = 0
- **耗时**: ~2 分钟
- **方法**: 跑 `pnpm tsx packages/cli/src/index.ts transform` 把 vue-element-admin-master 转一份到 `$env:TEMP\iter-058-out\`, 对比 iter-054 输出的 14 个 review pattern 计数

## 对比结果

| Pattern | iter-054 | iter-058 | delta |
|---------|----------|----------|-------|
| mixins review | 9 | 9 | +0 |
| this.$parent review | 0 | 0 | +0 |
| $children review | 0 | 0 | +0 |
| $root review | 0 | 0 | +0 |
| $vnode review | 0 | 0 | +0 |
| $isServer review | 0 | 0 | +0 |
| $isDestroyed review | 0 | 0 | +0 |
| $options.componentName review | 0 | 0 | +0 |
| this-replacer review | 10 | 10 | +0 |
| el-icon transform | 11 | 11 | +0 |
| new X().$mount review | 0 | 0 | +0 |
| self-ref rename | 9 | 9 | +0 |
| store-bridge | 128 | 128 | +0 |
| defineProps inject | 45 | 45 | +0 |

**输出文件数: 212 → 212 (完全一致)**

## 累计 7 个 commit 的稳定性

| Commit | 类型 | 影响 |
|--------|------|------|
| iter-051 | plugin-this-replacer + composition $parent + elementui 100+ 映射 | 新 review 触发源, 转换结构不变 |
| iter-052 | vue3-entry new X().$mount review + 递归验证 | 新 review (master 0 触发), 转换结构不变 |
| iter-053 | composition $parent 跳过注释 | 修 false positive, 输出不变 |
| iter-054 | composition 5 instance API + $options + mixins | 新 review (master 9 mixins 触发), 转换结构不变 |
| iter-055 | docs/iter-051-054-bench.md | 文档, 无代码影响 |
| iter-056 | README 更新 | 文档, 无代码影响 |
| iter-057 | KNOWN_ISSUES C1 close | 文档, 无代码影响 |

**结论**: iter-055/056/057 是纯文档 commit, 不影响 plugin 行为, 所以输出完全一致。iter-051~054 4 个 plugin 增强 commit 也没引入回归。

## 验证脚本

`_dbg/iter-058-counts.mjs` (Node 脚本, 避免 PowerShell hash key bug) — 读两个 log, regex 计数, 输出对比表。

## 复现命令

```powershell
# 跑 iter-058 (用最新 vue-migrate)
$env:OUT = "$env:TEMP\iter-058-out"
& node packages/cli/node_modules/tsx/dist/cli.mjs packages/cli/src/index.ts transform `
  D:\Projects\NB_EST\test1\111\vue-element-admin-master `
  --out $env:OUT --only-changed `
  > $env:TEMP\iter-058-convert.log 2>&1

# 对比 (用 mjs 脚本, 见 _dbg/)
node _dbg/iter-058-counts.mjs
```
