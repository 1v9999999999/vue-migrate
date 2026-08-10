# Regression Suite — Current State

> 任何修改 vue-migrate 规则后, 先看这个文件确认基线没漂移.

## 当前金标规模

- **金标总数**: 50 (target=50)
- **文件位置**: `baselines/golden.json` (元信息) + `baselines/golden/<path>` (源文件副本)
- **桶分布** (small <2KB / medium 2-10KB / large >10KB):
  - small: 13
  - medium: 19
  - large: 18
- **目录覆盖**: 7 个 examples/ 一级子目录全部包含, 每目录 ≥ 5

## 初始 pass-rate 基线

- **newPassRate**: 100.00% (50 / 50)
- **regressions / improvements / unchanged**: 0 / 0 / 0
- **耗时**: ≈24.5s (50 次 spawn transform, 平均 0.49s/文件)

## 哪些文件目前没有 expected output

> 这 16 个文件跑了 vue-migrate 但没产出输出 (--only-changed 模式下视为"无任何 plugin 改它").
> `expectedHash = ""` 跟 `actualHash = ""` 对齐 → matches=true.
> **如果将来有 rule 开始改这些文件, 这是 improvement, 不是 regression.**

```
222/page/vueEdit.vue
222/page/login.vue
222/page/adminList.vue
222/page/userList.vue
222/page/addGoods.vue
222/page/shopList.vue
222/page/addShop.vue
stress-compo/_old_023102/LineChart.vue
stress-compo/_old_023102/StressTest.vue
test-keep/src/views/About.vue
test-keep/src/utils/helper.js
vue2-sample/_old_023103/StressTest.vue
vue2-sample/_old_020014/StressTest.vue
vue2-sample/_old_023033/StressTest.vue
vue2-sample/_old_dist_015852/StressTest.vue
vue2-element-touzi-admin-dev-permission/src/layout/leftMenu.vue
```

观察:
- 这些文件主要是纯模板或纯 import, 没有任何 plugin 关心的 vue2 特征
- `test-keep/` 全是 vue3 风格, vue-migrate 跳过它们符合预期
- `_old_*/StressTest.vue` 是 stress test fixture, 没触发任何 plugin 是 plugin 覆盖盲区

## 当前 fail 列表

**0 个 fail.** 所有 50 个金标都通过.

## Tag 覆盖

```
vue2                 47
element-ui           40
options-data         37
options-methods      36
this-dollar          35
created              27
mounted              25
composition          19
options-computed     18
slot-scope           8
vue2-before-destroy  5
vuex                 2
vue-use              1
```

## 给后续 agent 的建议

### 加规则前必看

1. **跑一次干净基线** 确认 50/50 通过 (这是金标准则, 别让旧 drift 干扰新判断)
   ```powershell
   node packages/cli/node_modules/tsx/dist/cli.mjs `
     tools/regression-suite/src/index.ts run --golden baselines/golden.json
   ```

2. **改 rules** (`packages/plugins/*`), 然后重跑上面命令
   - 全部 50/50 → 提交
   - 部分 fail → 看 report, 确认是新规则带来的预期变化还是 regression
     - 改 `baselines/golden.json` 的 expected hash **只在确认变化是预期时**, 然后 commit
   - RegressionError 抛出 (下降 > 5%) → 回滚规则改动, 重新设计

3. **加新规则后** 想提升金标:
   - 先看 SUMMARY 里 16 个"无 expected output"的文件, 选 1-2 个能体现新规则的更新 expected hash
   - 增量: `select --target 60` 重新跑 (会先看现有 50 个 + 挑 10 个新的)

### 维护 tips

- **金标文件不要手动改** `baselines/golden/<path>`, select 阶段会重新覆盖
- **如果想加新目录**: 直接放文件到 `examples/<new-dir>/`, 下次 select 会自动包含 (只要 ≥ 5 个 vue/js 文件)
- **如果想换 50 → 100**: `select --target 100`, 跑完会写新 manifest, 旧的 `baselines/golden.json` 被覆盖. 注意先备份 prev
- **CRLF/LF 归一化**: compare.ts 已经先 `replace(/\r\n/g, '\n')` 再 hash, 跨平台 git checkout 不会引入假回归
- **新增/删除 gold 文件** 不算 regression: 走 `diffAgainstPrev` 里 "新文件" 路径, 单独算 improvement 或 regression

### 不要碰

- `tools/common/types.ts` (共享类型, 改前先讨论)
- `tools/regression-suite/src/__tests__/compare.test.ts` 里的 16 个测试是合同, 改前先确认行为
- `passRate` 字段当前等于 `newPassRate`, 留作将来扩展 (例如混合多 baseline)

### 当前限制

- 50 文件 / 24s: 100 文件会 ~50s, 没问题; 但 500+ 文件需要换成 in-process 调用
- vuex / router / vue-use 命中很少 (各 1-2), 跟 examples/ 实际样本分布一致; 后续可手动注入金标

### 失败诊断 cheat sheet

| 输出 | 含义 | 处理 |
|------|------|------|
| `[OK] hash=...` | 跟 baseline 一致 | 正常 |
| `[DIFF] expected=... actual=...` | 输出了, 但 hash 变了 | 看 vue-migrate 实际输出 diff, 决定是更新 baseline 还是回滚规则 |
| `[ERR] exit=N` | 进程非 0 退出, stderr 有错 | 可能是 transform 本身崩了, 看 stderr 段 |
| `[ERR] no output produced` | 之前实现遗留 (现版本不再出现) | 无 |
| `RegressionError` (exit 2) | pass-rate 下降 > 5% | 必须回滚, 阈值不能改 |

---

> 最后一次基线建立: 2026-08-07 (与 `baselines/golden.json` 的 createdAt 同步)
