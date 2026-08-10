# Iteration 022 — 2026-08-08 (改善 :value + @input review 文本: 加 Vue3 v-model 注意事项)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 5 min
- **核心改动**: `vue3-directives/src/rules/template-value-input.ts` review 文本加 3 条 Vue3 v-model 注意事项 (defineModel / $event.target.value / 修饰符)
- **关键 delta**: 主样本 review 23→23; multi-sample 维持 231; 文本更可操作

## 改进细节

### Before

```
:value + @input on <input> replaced with v-model="searchText" — please verify input handler (searchText = $event.target.val...) is just an assignment
```

**问题**:
- 只说"verify input handler is just an assignment", 没解释 Vue3 注意事项
- 用户不知道 v-model 的内部机制 (modelValue + update:modelValue)
- 不知道哪些元素 v-model 行为有差异 (select/checkbox/radio)

### After

```
:value + @input on <input> replaced with v-model="searchText" — please verify input handler (searchText = $event.target.val...) is just an assignment. Vue3 注意事项: 1) v-model 默认绑定到 modelValue + emit update:modelValue, 自定义组件需 defineModel 或手动 expose modelValue/update:modelValue; 2) input 元素 $event.target.value 用法保持兼容, 但 select/checkbox/radio 行为有差异; 3) 修饰符 .lazy/.number/.trim 在 v-model 上仍然有效
```

**改进**:
1. 解释 v-model 内部机制 (modelValue + update:modelValue)
2. 提到 defineModel (Vue3.4+ 简化双向绑定)
3. 提醒 select/checkbox/radio 行为有差异
4. 确认修饰符兼容

## 验证

### compo-test (4 文件, StressTest.vue 有 :value + @input)

跑后 review (line 46):
```
✓ manual-review: :value + @input on <input> replaced with v-model="searchText" — please verify input handler (searchText = $event.target.val...) is just an assignment. Vue3 注意事项: 1) v-model 默认绑定到 modelValue + emit update:modelValue, 自定义组件需 defineModel 或手动 expose modelValue/update:modelValue; 2) input 元素 $event.target.value 用法保持兼容, 但 select/checkbox/radio 行为有差异; 3) 修饰符 .lazy/.number/.trim 在 v-model 上仍然有效
```

✅ 新文本生效

### multi-sample (171 文件, 6 sample)

| 指标 | iter-021 | iter-022 | vs iter-021 |
|---|---|---|---|
| avgCompileOk | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | 0.891 | 0 |
| avgSemanticDiff | 0.722 | 0.722 | 0 |
| avgRuntimeSafe | 0.996 | 0.996 | 0 |
| totalReviewDelta | 231 | 231 | 0 |
| main sample reviewCount | 23 | 23 | 0 |

✅ 全部维持

## 累计改进 (iter-016 + iter-017 + iter-018 + iter-020 + iter-021 + iter-022)

6 个 cron ticks 改善了 review 文本:
- iter-016: `$store` (Pinia)
- iter-017/018: `$children` (template ref) + `$attrs`/`$slots` 规则
- iter-020: `Vuex→Pinia`
- iter-021: `Vue Router mode`
- iter-022: `:value + @input` (v-model 注意事项)

## 关键决策

- **没改 `v-if + v-for` review 文本**: 已经很清晰
- **没改 `keycode` review 文本**: 转换明确
- **没改 `inline-template` review 文本**: 转换明确
- **没改 `this.$listeners`/`$scopedSlots` review 文本**: 已被 iter-018 改成 $attrs/$slots 规则

## 下一步

1. **P0 composition 仍 stub**: 长期任务
2. **P1 看 `v-for + v-if` review 文本**: 是否加更具体的 Vue3 `<template v-if>` 包裹示例
3. **P2 GITHUB_TOKEN 集成 sample-collector**: 仍需

## 完整数据

- `baselines/iter-022/report.json` — 主样本 23 review
- `baselines/iter-022/multi-sample/summary.json` — 231 totalReviewDelta
- `packages/plugins/vue3-directives/src/rules/template-value-input.ts` — 改进
- `$env:TEMP\iter22-compo.log` — compo-test 验证 (新文本生效)
