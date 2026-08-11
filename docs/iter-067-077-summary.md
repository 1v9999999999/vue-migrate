# iter-067 ~ iter-077: Plugin README 收官 + 用户文档沉淀

11 轮连续推进, 核心成果:

1. **18/18 plugin README 全部完成** (iter-067 ~ iter-074)
2. **2 篇 known-issue user-side fix guide** (iter-075 + iter-076)
3. **顶层 PLUGIN_GUIDE 总览** (iter-077)
4. **iter-069 顺手修 check-all-tests.mjs**: 从 598 → 619 (+21 test 计数)

## 时间线

| iter | 主题 | commit |
|------|------|--------|
| 067 | resource-copier/README.md | 9be7cf7 |
| 068 | 3rd-party-imports/README.md | 7151211 |
| 069 | vue-router-v4/README.md + check-all-tests +21 | 1c0988d |
| 070 | vxe-table/README.md | ca486cf |
| 071 | package-json/README.md | 88ca6bc |
| 072 | vue2-compat/README.md | 60cd201 |
| 073 | import-cleaner/README.md | 4b647a9 |
| 074 | vite-compat/README.md (最后 1 个) | 96e88c5 |
| 075 | docs/known-issues/C2-template-ref-fix.md | 6f595bd |
| 076 | docs/known-issues/15-render-function-fix.md | 7ff10a9 |
| 077 | docs/PLUGIN_GUIDE.md (顶层总览) | 505f49b |

## 18 Plugin README 完整列表

按 priority 排序 (越小越先跑):

| Priority | Plugin | iter | commit |
|----------|--------|------|--------|
| -1 | import-cleaner | 073 | 4b647a9 |
| 0 | composition | (iter-022) | — |
| 3 | this-replacer | (iter-051) | — |
| 5 | vite-compat | 074 | 96e88c5 |
| 5 | store-bridge | (iter-064) | — |
| 7 | 3rd-party-imports | 068 | 7151211 |
| 7 | resource-copier | 067 | 9be7cf7 |
| 8 | vxe-table | 070 | ca486cf |
| 8 | vue3-template | (iter-035) | — |
| 9 | vue-router-v4 | 069 | 1c0988d |
| 9 | vue3-entry | (iter-050) | — |
| 9 | vue3-directives | (iter-047) | — |
| 10 | vue2-compat | 072 | 60cd201 |
| 10 | vue3-types | (iter-024) | — |
| 12 | elementui | (iter-036) | — |
| 50 | vuex-pinia | (iter-065) | — |
| 80 | vite-scaffold | (iter-066) | — |
| 100 | package-json | 071 | 88ca6bc |

## 11 轮 README 模板统一

每个 plugin README 包含 6 个标准段:

1. **背景** — 为什么需要这个 plugin
2. **负责规则表** — 自动程度 + 改写形式
3. **关键实现** — 核心代码段 + 解释
4. **文件结构** — `src/` 树
5. **测试** — case 数 + 覆盖范围
6. **实测** — 真实项目触发数
7. **注册** — cli 入口
8. **跟其他 plugin 的关系** — 边界 + 协同
9. **边界 / 已知限制** — 不做什么

## iter-069 顺手修复: check-all-tests.mjs regex

| 修改 | Before | After |
|------|--------|-------|
| pass regex | `/pass (\d+)/` | `/pass[ =]+(\d+)/ \|\| /(\d+)[ ]*pass/` |
| fail regex | `/fail (\d+)/` | `/fail[ =]+(\d+)/ \|\| /(\d+)[ ]*fail/` |
| tests 总数 | 598 | **619** (+21 from test-wrapper-rename.ts) |

**根因**: vue-router-v4 的 test-wrapper-rename.ts 输出 "21 pass, 0 fail" 格式 (数字在前), 旧 regex `/pass (\d+)/` 不识别。

**修复**: 支持两种格式, 兼容 N pass / pass N。

## 2 篇 Known-Issue Fix Guide (iter-075 + iter-076)

| issue | 触发数 | fix guide | 复杂度 |
|-------|--------|-----------|--------|
| C2: template ref 与 data 字段同名 | 6 files | [C2-template-ref-fix.md](./known-issues/C2-template-ref-fix.md) | user-side 3 种情况修复 + `__refsMap` 兼容机制 |
| #15: render function | 1 file | [15-render-function-fix.md](./known-issues/15-render-function-fix.md) | user-side 简化 `createApp(App).use().mount()` 标准写法 |

**两篇都基于 iter-058 baseline 的真实触发** (master 6 个 .vue + 1 个 main.js), 不是空想。

## 顶层 PLUGIN_GUIDE.md (iter-077)

10KB 高层导览, 5 段:

1. **18 plugin 速查表** (priority 排序 + README 链接)
2. **9 组分类** (基础 / 模板 + 入口 / UI 库 / 资源 + 3rd-party / store + 兼容 / 核心 / this-replacer / 项目级 / 收尾)
3. **用户最常见问题 FAQ** (10 个 Q&A)
4. **Plugin 不做的事** (mixins / functional / 异步组件 / decorator / 复杂 render 等)
5. **怎么加新 Plugin** (9 步指南)

## 最终状态

| 指标 | 数值 |
|------|------|
| Plugin 总数 | 18 |
| Plugin README 完成度 | **18/18 (100%)** |
| 单元测试 | **619/619 pass** (iter-069 +21) |
| tsc errors | **0/18 packages** |
| Open issues | 0 (C2 + #15 都有 fix guide) |
| 顶层 PLUGIN_GUIDE | ✅ |
| known-issues fix guide | ✅ (C2 + #15) |
| GitHub 同步 | ✅ (HEAD 505f49b, 17 commits since iter-067) |

## 关联文档

- [iter-051-054-bench.md](./iter-051-054-bench.md) — 上一阶段 4 轮 review 规则沉淀
- [iter-058-regression.md](./iter-058-regression.md) — 0 regression 验证
- [PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md) — 18 plugin 总览 (iter-077)
- [CHANGELOG.md](../CHANGELOG.md) — 项目整体 changelog (iter-060)
- [EXAMPLES.md](./EXAMPLES.md) — 9 个真实 before/after (iter-061)
- [README.md](../README.md) — 项目总览
