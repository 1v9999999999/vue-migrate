# Iteration 016 — 2026-08-08 (改善 $store review 文本: 加 Pinia 迁移代码示例)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 5 min
- **核心改进**: `vue3-types/src/rules/mark-todos.ts` 的 `$store` hint 从单行变多行, 包含 Pinia 迁移的具体 API 对应
- **关键 delta**: 主样本 review 23→23 (文本改进不影响数); multi-sample 维持 227

## 改进细节

### Before

```
this.$store → useXxxStore() (Pinia). 依赖 @vue-migrate/plugin-vuex-pinia
```

问题: 没说 Vuex 各种 API 怎么映射到 Pinia, 用户还得自己查。

### After

```
this.$store → const store = useXxxStore() (Pinia)  // state→store.xxx, dispatch→store.action(), commit→store.$patch({...}); 注意 Vuex 的 getter 在 Pinia 里直接当 computed 属性
```

包含完整 API 映射:
- `this.$store` → `const store = useXxxStore()`
- `this.$store.state.xxx` → `store.xxx` (state 现在是 store 的 properties)
- `this.$store.dispatch('action', payload)` → `store.action(payload)` (Pinia actions 直接调用)
- `this.$store.commit('mutation', payload)` → `store.$patch({...})` (或直接修改 state)
- Vuex getter → Pinia computed (在 setup 里直接当 computed)

## 验证

### stress-compo (4 文件, 含 StressTest.vue 用 this.$store)

跑后 review 文本 (line 102):
```
vue3-types TODO: $store usage found (×1) — this.$store → const store = useXxxStore() (Pinia)  // state→store.xxx, dispatch→store.action(), commit→store.$patch({...}); 注意 Vuex 的 getter 在 Pinia 里直接当 computed 属性
```

✅ 新文本正确应用

### multi-sample (171 文件, 6 sample)

| 指标 | iter-014 | iter-016 | vs iter-014 |
|---|---|---|---|
| avgCompileOk | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0 |
| totalReviewDelta | 227 | 227 | 0 |

✅ 全部维持 — 文本变化不影响 review 计数

## 关键指标

| 指标 | iter-015 | iter-016 | vs iter-015 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| errors | 0 | 0 | 0 |
| review note 文本长度 (平均) | ~80 字 | ~140 字 | +60 字 (更有用) |

## 决策

- **只改 $store**: 其他 review ($refs/$route/$router/$listeners/$children/$scopedSlots) 文本已经够清晰
- **不在本轮改 elementui/`:value + @input` 之类的 review**: 那些是文档化的, 没问题
- **没改 vuex-pinia 的 "import Vuex + mapState" 文本**: 那个已经清楚说明要 defineStore + actions

## 下一步

1. **P1 同样改进其他 6 个 review 文本**: 如果 $store 这个改进有效, 考虑给 $listeners / $children 加更具体的代码示例
2. **P0 composition 长期化**: 仍 stub
3. **P2 sample-collector + GITHUB_TOKEN**: 仍需

## 完整数据

- `baselines/iter-016/report.json` — 主样本聚合
- `baselines/iter-016/multi-sample/summary.json` — multi-sample aggregate
- `packages/plugins/vue3-types/src/rules/mark-todos.ts` — 改进
- `$env:TEMP\iter16-stress.log` — stress-compo 输出 (确认新文本生效)
