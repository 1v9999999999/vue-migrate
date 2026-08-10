# Iteration 021 — 2026-08-08 (改善 Vue Router 4 mode review 文本)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 5 min
- **核心改动**: `vue-router-v4/src/index.ts` "未指定 mode" review 加三种 mode 的对应关系说明
- **关键 delta**: 主样本 review 23→23; multi-sample 维持 231; 文本更全面

## 改进细节

### Before

```
未指定 mode 的 new Router() 默认改为 createWebHashHistory()（vue-router 2/3 的默认值）。如需 HTML5 history 模式，请改为 createWebHistory()。
```

**问题**: 只提了 hash 和 history 两种, 没说 abstract (Node/SSR 用)。

### After

```
未指定 mode 的 new Router() 默认改为 createWebHashHistory()（vue-router 2/3 的默认值）。三种 mode 对应：hash→createWebHashHistory() (URL 带 #), history→createWebHistory() (需要服务端配合), abstract→createMemoryHistory() (Node/SSR 用, 无 URL)。如需 HTML5 history 模式，请改为 createWebHistory()。
```

**改进**:
- 列出全部 3 种 mode 映射
- 标明每种 mode 的 URL 形式 (# or not, server-side or not)
- 特别提了 `createMemoryHistory()` (Node/SSR 用)

## 验证

主样本 `router/index.js` review 文本:
```
• router/index.js — 未指定 mode 的 new Router() 默认改为 createWebHashHistory()（vue-router 2/3 的默认值）。三种 mode 对应：hash→createWebHashHistory() (URL 带 #), history→createWebHistory() (需要服务端配合), abstract→createMemoryHistory() (Node/SSR 用, 无 URL)。如需 HTML5 history 模式，请改为 createWebHistory()。
```

✅ 新文本生效

| 指标 | iter-020 | iter-021 | vs iter-020 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| multi-sample totalReviewDelta | 231 | 231 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0 |
| 0 errors | ✅ | ✅ | ✅ |

## 累计改进 (iter-016 + iter-017 + iter-018 + iter-020 + iter-021)

5 个 cron ticks 改善了 review 文本:
- iter-016: `$store` (Pinia 完整映射)
- iter-017: `$children` (template ref 模板代码)
- iter-018: $attrs/$slots 规则 (修了 iter-017 的死代码)
- iter-020: `Vuex→Pinia` (useXxxStore + mutations 提示)
- iter-021: `Vue Router mode` (3 种 mode 映射)

## 关键决策

- **没改其他 vue-router reviews**: `Vue.use(Router)` 移除 / `this.$router` 改 `useRouter()` 都已经清楚
- **没改 iter-020 的 Vuex→Pinia 文本**: 已够
- **没新增新 review 类别**: 文本改进不影响 review 数

## 下一步

1. **P0 composition 仍 stub**: 长期任务, cron 时间不够重建
2. **P1 看 `:value + @input` review 文本**: 之前是 "please verify input handler ... is just an assignment", 看是否需要加更具体的 Vue3 处理
3. **P2 GITHUB_TOKEN 集成 sample-collector**: 仍需

## 完整数据

- `baselines/iter-021/report.json` — 主样本 23 review
- `baselines/iter-021/multi-sample/summary.json` — 231 totalReviewDelta
- `packages/plugins/vue-router-v4/src/index.ts` — 改进
- `$env:TEMP\iter21-verify.log` — 主样本验证
