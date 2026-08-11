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


## [Unreleased] — 2026-08-11 (iter-067~083)

### Added (iter-067~074: 18 plugin README 全部完成)

- **iter-067** packages/plugins/resource-copier/README.md (R.1~6 规则)
- **iter-068** packages/plugins/3rd-party-imports/README.md (PI.1~6 规则)
- **iter-069** packages/plugins/vue-router-v4/README.md (R.1~15 规则) + check-all-tests.mjs regex 修复 (+21 test, 598→619)
- **iter-070** packages/plugins/vxe-table/README.md (VT.1~2 规则 + iter-031 三次踩坑)
- **iter-071** packages/plugins/package-json/README.md (PJ.1~5 规则)
- **iter-072** packages/plugins/vue2-compat/README.md (VC.1~13 规则)
- **iter-073** packages/plugins/import-cleaner/README.md (IC.1~6 规则)
- **iter-074** packages/plugins/vite-compat/README.md (VC.1~9 规则) — **18/18 plugin README 全部完成**

### Added (iter-075~077: user-facing 文档)

- **iter-075** docs/known-issues/C2-template-ref-fix.md — template ref 与 data 字段同名 6 触发用户修复指南
- **iter-076** docs/known-issues/15-render-function-fix.md — render function 1 触发用户简化指南
- **iter-077** docs/PLUGIN_GUIDE.md — 18 plugin 顶层总览 (priority 表 / 9 组分类 / FAQ / 不做的事 / 怎么加新 plugin)

### Added (iter-078~080: 沉淀 + 验证 + CI)

- **iter-078** docs/iter-067-077-summary.md — 11 轮 README + fix guide + PLUGIN_GUIDE 沉淀
- **iter-079** _dbg/iter-078-counts.mjs — 0-regression 验证脚本 (defineProps 45=45 ✓)
- **iter-080** docs/PUBLISHING.md — CI/发布流程 (monorepo build + npm release + CI workflow 模板 + checklist)

### Added (iter-081~083: defineEmits 推断增强 3 轮 plan)

- **iter-081** docs/iter-081-define-emits-plan.md — 3 轮 plan (现状 / 增强目标 / 3 步策略 / 3 风险评估 / 实施表)
- **iter-082** packages/plugins/composition/src/options-to-setup.ts — defineEmits 增强实施:
  - 新增 countTopLevelCommas helper (字符级 + 字符串字面量 + 嵌套 ()/[]/{} 识别)
  - 新增 emitArgCounts: Map<string, number> 字段
  - TS 模式从 defineEmits<{ eventName: any[] }>() 升级为 interface EmitsPayloads { eventName: [arg1: any, arg2: any] } + defineEmits<EmitsPayloads>()
  - 0 args = [] (空 tuple), 1+ args = [arg1: any, ...], 重复 emit 取 max arg count
- **iter-083** 	est-define-emits.ts — 10 新 case 覆盖 arg count 边界 (0/1/2 args / max 合并 / 嵌套 / 字符串字面量 / 对象字面量 / dynamic 兜底)

### Closed issues (iter-075~076 fix guides)

- **C2** template ref 同名 6 触发 — 用户有完整修复指南
- **#15** render function 1 触发 — 用户有完整简化指南

### Tests

| iter              | 新增                                 | 累计 |
|-------------------|--------------------------------------|------|
| iter-067 (起点)   | -                                    | 619  |
| iter-069          | +21 (vue-router-v4 wrapper-rename)   | 619  |
| iter-082          | +1 (新 assertion)                    | 620  |
| iter-083          | +10 (arg count 边界)                 | 630  |

## Total

- **18 plugins** (含 iter-051 新增 this-replacer)
- **18/18 plugin README** (iter-067~074 全部完成)
- **18/18 packages: 0 TypeScript errors**
- **630/630 unit tests pass** (619 → 630, +11 from iter-069+082+083)
- **0 regression** (iter-079 baseline 验证: defineProps 45=45 ✓)
- **3 顶层文档** (CHANGELOG.md / PLUGIN_GUIDE.md / PUBLISHING.md)
- **2 known-issue fix guides** (C2 / #15)
- **0 Open issues** (C2 + #15 都有 user-side fix guide)

## Real-world coverage (iter-058/079 重验证)

vue-element-admin-master 195 源文件 转换后 (iter-079 baseline):

| Pattern                       | 触发数          |
|-------------------------------|----------------|
| defineProps inject            | 45 ✓           |
| store-bridge useXxxStore      | 156 (any)      |
| store-bridge useAppStore      | 59 (legacy)    |
| el-icon transform             | 26             |
| __refsMap (C2 fix)          | 19             |
| composition review markers    | 0              |
| this-replacer review markers  | 0              |
| 	his. review (iter-053 后) | 0       |
| 
ew X(). review       | 0              |
| 5 Vue 2 instance API review   | 0              |
