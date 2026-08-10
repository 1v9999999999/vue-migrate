# Iteration 020 — 2026-08-08 (改善 Vuex→Pinia 迁移 review 文本)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 5 min
- **核心改动**: `vuex-pinia/src/index.ts` 改 review 文本 — 之前的 `useStoreStore()` 占位符改成具体的 `useXxxStore()` + 提示 Pinia 没有 mutations
- **关键 delta**: 主样本 review 23→23 (文本变化不影响数); multi-sample 维持 231; 文本更有指导性

## 改进细节

### Before

```
Vuex Store 已转 Pinia。组件中的 `this.$store` 由 composition 插件处理；使用 `useStoreStore()` 替代 `useStore()`。
```

**问题**:
1. `useStoreStore()` 是 placeholder 文本, 用户复制粘贴会报错
2. 没说 Vuex 的 `mutations` 在 Pinia 里怎么处理
3. 没说 `useStore()` 和 `useXxxStore()` 的命名约定

### After

```
Vuex Store 已转 Pinia。组件中的 `this.$store` 由 composition 插件处理；用 `useXxxStore()` (Xxx 是你的 store 名字) 替代 `this.$store`。注意 Pinia 没有 mutations — 把原 Vuex mutations 改成 actions (或直接修改 state)。
```

**改进**:
1. `useXxxStore()` 明确告诉用户用 `Xxx` 替换为 store 名字 (e.g. `useUserStore()`, `useAuthStore()`)
2. 提示 Pinia 没有 mutations, 引导迁移到 actions
3. 也提到"直接修改 state"作为另一个选项 (Pinia 允许)

## 验证

### main sample (vue2-manage-master)

`store/index.js` review 文本更新:
```
• store/index.js — Vuex Store 已转 Pinia。组件中的 `this.$store` 由 composition 插件处理；用 `useXxxStore()` (Xxx 是你的 store 名字) 替代 `this.$store`。注意 Pinia 没有 mutations — 把原 Vuex mutations 改成 actions (或直接修改 state)。
```

✅ 新文本生效

### multi-sample (171 文件, 6 sample)

| 指标 | iter-019 | iter-020 | vs iter-019 |
|---|---|---|---|
| avgCompileOk | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0 |
| totalReviewDelta | 231 | 231 | 0 |
| main sample reviewCount | 23 | 23 | 0 |

✅ 全部维持

## 累计改进 (iter-016 + iter-017 + iter-020)

总共通关了 4 个 review 文本:
- iter-016: `$store` 文本 (state/dispatch/commit/getter 完整映射)
- iter-017: `$listeners` / `$children` 文本 (代码示例) — 后来发现 $listeners 是死代码, iter-018 改成 $attrs/$slots 规则
- iter-020: `Vuex→Pinia` 文本 (useXxxStore + mutations 提示)

## 关键决策

- **没改其他 Vuex reviews**: `import Vuex + mapState` 文本已经清楚, 不动
- **没改 `Vue.use without new Vue` 文本**: 已说"请检查是否真的是入口文件", 清楚
- **没改 `Vue.config.productionTip` 文本**: 单行说明, 已够

## 下一步

1. **P0 composition 仍 stub**: 长期任务, 本轮跳过
2. **P1 看 Vue Router 4 mode review 文本**: 是否需要加 `createWebHashHistory` vs `createWebHistory` vs `createMemoryHistory` 详细说明
3. **P2 GITHUB_TOKEN 集成 sample-collector**: 仍需

## 完整数据

- `baselines/iter-020/report.json` — 主样本 23 review
- `baselines/iter-020/multi-sample/summary.json` — 231 totalReviewDelta
- `packages/plugins/vuex-pinia/src/index.ts` — 改进
- `$env:TEMP\iter20-verify.log` — 主样本验证 (新文本生效)
