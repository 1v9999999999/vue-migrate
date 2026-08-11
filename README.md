# vue-migrate

Vue 2 → Vue 3 自动化迁移工具集，包含**转换引擎** + **自演化系统**。

## 这是什么

两件事：

1. **转换引擎** (`packages/`)：把 Vue 2 项目（Options API、ElementUI、Vuex、Vue Router 3）转成 Vue 3（`<script setup>`、Element Plus、Pinia、Vue Router 4）。
2. **自演化系统** (`tools/`)：每 30 分钟跑一次完整迭代——拉新样本、跑转换、和官方 `@vue/codemod` 对比、回归测试、生成新规则、自动修复——并能在某条 issue 卡住时拆出子 agent 专门处理。

## 当前状态

| 指标 | 数值 |
|---|---|
| 支持的 Vue 2 规则 | 70+（含 iter-051~055 新增 this.$X 批量 review / Vue 2 移除的 5 个 instance API / mixins 字段 / 100+ el-icon 映射） |
| ElementUI → Element Plus 规则 | 140+（含 100+ Element Plus icon 映射） |
| Options → Composition 规则 | 25+（含 el-icon / template ref collision / 自引用 const 重命名） |
| 已实现插件 | **18**（vue2-compat / vue3-entry / vue3-template / vue3-directives / vue3-types / elementui / composition / vue-router-v4 / vuex-pinia / vxe-table / package-json / import-cleaner / vite-compat / vite-scaffold / resource-copier / store-bridge / 3rd-party-imports / **this-replacer**） |
| TypeScript 编译 | 18/18 packages 0 errors |
| 单元测试 | 598/598 pass（从 iter-050 的 526 → iter-054 的 598, +72 测试） |
| 测试样本 | 7 个项目（50+ 文件，含 stress 1000+ 行文件 + 真实电商后台 vue-element-admin-master 195 文件） |
| 真实项目实测 | vue-element-admin-master 195 源文件 → 212 输出文件, 命中 9 mixins / 9 el-icon / 59 store-bridge / 45 defineProps / 9 self-ref |
| 自演化系统 | Phase 1 ✅ Phase 2 搭建中 |

### 最新进展 (iter-051~055)

- **iter-051**: 新增 `@vue-migrate/plugin-this-replacer` (this.$http/$axios/$api 自动替换 + review) / composition `this.$parent` review / elementui 100+ icon 映射
- **iter-052**: vue3-entry `new X().$mount()` review (progressBar 模式) / composition 递归函数验证
- **iter-053**: composition `$parent` review 修 false positive (跳过注释)
- **iter-054**: composition 5 个 Vue 2 移除的 instance API ($children/$root/$vnode/$isServer/$isDestroyed) + $options.componentName + mixins 字段批量 review
- **iter-055**: 沉淀 doc — `docs/iter-051-054-bench.md`

## 目录结构

```
vue-migrate/
├── packages/                    # 转换引擎
│   ├── core/                   #   scanner / parser / codegen / reporter / orchestrator
│   ├── cli/                    #   命令行入口
│   └── plugins/                #   18 个迁移插件
├── examples/                   # 测试样本
│   ├── vue2-sample/            #   10 文件，单元测试级
│   ├── vue2-manage-master/     #   28 文件，真实电商后台
│   ├── stress-compo/           #   1000+ 行压力测试
│   └── ...
├── tools/                      # 自演化系统
│   ├── orchestrate.ts          #   单次迭代主流程
│   ├── common/types.ts         #   共享类型
│   ├── sample-collector/       #   GitHub 样本采集
│   ├── baseline-comparator/    #   官方 @vue/codemod 对比
│   ├── regression-suite/       #   100 文件金标 + 回归检测
│   ├── scheduler/              #   状态机 + 30min cron + agent 派发
│   └── rule-generator/         #   LLM 生成新规则
├── samples/                    # 采集来的真实项目（gitignored）
├── baselines/                  # 每轮迭代产物（gitignored）
│   └── {iter-id}/
│       ├── report.json
│       ├── tickets.json
│       ├── file-metrics.json
│       └── .iterate-state.json
├── docs/
│   ├── TODO_Vue3_Conversion_Catalog.md
│   ├── ElementUI_ElementPlus_Catalog.md
│   ├── Options_To_Composition_Catalog.md
│   ├── Router_V4_Catalog.md
│   ├── Vuex_Pinia_Catalog.md
│   ├── iterate-log/            # 每轮迭代的 markdown 报告
│   └── KNOWN_ISSUES.md
└── README.md (本文件)
```

## 快速上手

### 转换一个项目

```bash
cd D:\Projects\NB_EST\qiuzhi\vue-migrate
pnpm install
pnpm run dev:cli -- transform <input-dir> -o <output-dir>
# 只输出改过的文件
pnpm run dev:cli -- transform <input-dir> -o <output-dir> --only-changed
```

例：
```bash
pnpm run dev:cli -- transform examples/vue2-manage-master/src -o examples/222 --only-changed
```

输出报告示例：
```
总文件: 28
已修改: 54
需人工: 95
错误: 0
```

### 跑一次自演化迭代

```bash
# 单次迭代
pnpm run dev:cli
tsx tools/orchestrate.ts --input examples/vue2-manage-master/src --id iter-001

# 长跑调度（每 30 分钟一次）
tsx tools/scheduler/src/index.ts start
```

## 自演化系统怎么工作

```
                          ┌────────── 30 min cron ──────────┐
                          ▼                                  │
   ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐  │
   │ collect │─▶│  convert   │─▶│   diff   │─▶│ analyze │  │
   │ (GitHub │  │ (orchestr- │  │ (baseline│  │ (issue  │  │
   │ mining) │  │  ate.ts)   │  │  -comp.) │  │  parse) │  │
   └─────────┘  └────────────┘  └──────────┘  └────┬────┘  │
                                                     │       │
       ┌─────────────────────────────────────────────┘       │
       ▼                                                     │
   ┌─────────┐  ┌─────────────┐  ┌──────────┐               │
   │ generate│─▶│   testing   │─▶│ commit   │───────────────┘
   │ (LLM    │  │ (regression │
   │  rules) │  │  -suite)    │
   └─────────┘  └──────┬──────┘
                       │ regression detected
                       ▼
              ┌────────────────┐
              │ spawn agent for│
              │ stuck issue    │
              │ (3 fails)      │
              └────────────────┘
```

详细架构见 `docs/SELF_EVOLVING_ARCHITECTURE.md`（待补充）。

## 5 个子系统的接口

| 子系统 | 路径 | 职责 | 输入 | 输出 |
|---|---|---|---|---|
| sample-collector | `tools/sample-collector/` | 从 GitHub 拉真实 Vue 2 项目 | `GITHUB_TOKEN` | `samples/{org}__{repo}__<sha>/` + `samples/INDEX.json` |
| baseline-comparator | `tools/baseline-comparator/` | 跑官方 `@vue/codemod` 做对比 | 样本目录 | `ComparisonMetrics{compileOk, astEquivalent, semanticDiff, reviewCount, runtimeSafe}` |
| regression-suite | `tools/regression-suite/` | 100 文件金标 + passRate 回归检测 | `baselines/golden.json` + vue-migrate output | `SuiteResult{passRate, regressions, improvements}` |
| scheduler | `tools/scheduler/` | 状态机 + cron + agent 派发 | `.iterate-state.json` | 下一轮 state + history |
| rule-generator | `tools/rule-generator/` | LLM 生成新规则代码 | Issue tickets + 历史 patterns | `RuleCandidate[]` |

详细类型见 `tools/common/types.ts`。

## 添加新规则

1. 选合适的插件目录（`packages/plugins/<X>/`）
2. 写新规则文件 `src/rules/<rule>.ts`
3. 在 `src/index.ts` 注册（`priority` 决定执行顺序）
4. 在 `docs/<X>_Catalog.md` 加一条文档
5. 写一个测试用例（5 行 Vue 2 → 5 行 Vue 3 的 before/after）
6. 跑 `pnpm run dev:cli -- transform examples/.../X.vue -o /tmp/test --only-changed` 验证
7. 更新 `baselines/golden.json`（让 regression-suite 接纳新规则）

## 调试

```bash
# 看 codegen 内部 AST 转换
DEBUG=codegen pnpm run dev:cli -- transform ...

# 跑单个文件
pnpm run dev:cli -- transform examples/stress-compo/StressTest.vue -o /tmp/out

# 看所有插件列表
pnpm run dev:cli
```

## 关键文档

- `docs/TODO_Vue3_Conversion_Catalog.md` — 70+ 条核心 Vue 2→3 规则
- `docs/ElementUI_ElementPlus_Catalog.md` — 140+ 条 UI 库迁移
- `docs/Options_To_Composition_Catalog.md` — 25+ 条 Options→`<script setup>`
- `docs/Router_V4_Catalog.md` — Vue Router 3→4
- `docs/Vuex_Pinia_Catalog.md` — Vuex→Pinia
- `docs/iter-051-054-bench.md` — iter-051~054 优化报告 (this-replacer / instance API / mixins 实测数据)
- `docs/iterate-log/{date}.md` — 每轮迭代的执行日志
- `KNOWN_ISSUES.md` — 当前已知未修问题
