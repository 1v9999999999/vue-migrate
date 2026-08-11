# Changelog

All notable changes to `vue-migrate` will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — 2026-08-11

### Added (iter-051~059)

- **iter-051** 新增 `@vue-migrate/plugin-this-replacer` plugin (this.$http/$axios/$api/$util/$bus 批量替换 + review)
- **iter-051** composition plugin 加 `this.$parent` review (Vue 2 隐式 API)
- **iter-051** elementui plugin 补全 100+ Element Plus icon 映射 + 跳过 ElementUI 私有 BEM class (el-icon-wrapper / el-icon--right)
- **iter-052** vue3-entry plugin 加 `new X().$mount()` 通用 review (progressBar / DetailPanel 模式)
- **iter-052** composition 递归函数验证 (setCurrentView / 互相递归 work without changes)
- **iter-053** composition `$parent` review 修 false positive (跳过 `//` 和 `/* */` 注释)
- **iter-054** composition 5 个 Vue 2 移除的 instance API 批量 review:
  - `$children` → ref 数组 + provide/inject
  - `$root` → app.config.globalProperties
  - `$vnode` → 完全移除
  - `$isServer` → import.meta.env.SSR
  - `$isDestroyed` → onUnmounted
- **iter-054** composition 加 `this.$options.componentName / .name` review + `defineOptions` 提示
- **iter-054** composition 加 `mixins: [...]` 字段 review (建议改 composables)
- **iter-055** 写 `docs/iter-051-054-bench.md` 沉淀 iter-051~054 实测数据
- **iter-058** 跑回归 baseline 验证 iter-051~057 7 commit 0 regression (14 个 review pattern 全部 delta=0)
- **iter-059** 关闭 KNOWN_ISSUES #6 (ECharts 自由变量 TODO 注释 — 实际 4 个 chart 文件已用 `const chart = ref(null)`)

### Changed

- **iter-056** README 更新: 12 → 18 plugins, 56 → 70+ 规则, 526 → 598 tests
- **iter-057** 关闭 KNOWN_ISSUES C1 (Pinia store id 0 触发)

### Tests

| iter | 新增 | 累计 |
|------|------|------|
| iter-050 (基线) | - | 526 |
| iter-051 | +25 (this-replacer) | 551 |
| iter-052 | +22 (new-x-mount + recursive) | 573 |
| iter-053 | +9 (parent-skip-comments) | 582 |
| iter-054 | +16 (removed-instance-api) | **598** |

## Total

- **18 plugins** (vue2-compat / vue3-entry / vue3-template / vue3-directives / vue3-types / elementui / composition / vue-router-v4 / vuex-pinia / vxe-table / package-json / import-cleaner / vite-compat / vite-scaffold / resource-copier / store-bridge / 3rd-party-imports / **this-replacer**)
- **18/18 packages: 0 TypeScript errors**
- **598/598 unit tests pass**
- **0 regression** (iter-058 baseline 验证)

## Real-world coverage

跑完整 `vue-element-admin-master` (195 源文件) 转换实测:

| Pattern | 触发数 |
|---------|--------|
| mixins 字段 review | 9 |
| this-replacer review | 10 |
| el-icon 转换 | 11 |
| self-ref const 重命名 | 9 |
| store-bridge (useAppStore) | 128 |
| defineProps 注入 | 45 |
| 5 个 Vue 2 instance API | 0 (master 没用) |
| this.$parent | 0 (iter-053 修后) |
| new X().$mount review | 0 (master 没用) |

## 详细 commit 历史

```
ed48cc5 iter-059: KNOWN_ISSUES #6 关闭
dae94c5 iter-058: 回归验证 0 regression
9fbc356 iter-057: KNOWN_ISSUES C1 关闭
cd42e78 iter-056: README 更新
286465e iter-055: docs/iter-051-054-bench.md
fd27b64 iter-054: composition 5 instance API + mixins
09c8cfe iter-053: composition $parent 跳注释
782d094 iter-052: new X().$mount + 递归验证
3c84e81 iter-051: plugin-this-replacer + $parent + el-icon
```

## 历史累积 (iter-001~050)

详见 `docs/iterate-log/` 目录 (26+ iter-001~iter-026 + bench / regression 报告).
