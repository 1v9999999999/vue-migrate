# vue-migrate

Vue 2 → Vue 3 自动化迁移工具集，包含**转换引擎** + **自演化系统**。

## 这是什么

两件事：

1. **转换引擎** (`packages/`)：把 Vue 2 项目（Options API、ElementUI、Vuex、Vue Router 3）转成 Vue 3（`<script setup>`、Element Plus、Pinia、Vue Router 4）。
2. **自演化系统** (`tools/`)：每 30 分钟跑一次完整迭代——拉新样本、跑转换、和官方 `@vue/codemod` 对比、回归测试、生成新规则、自动修复——并能在某条 issue 卡住时拆出子 agent 专门处理。

## 当前状态

| 指标 | 数值 |
|---|---|
| 支持的 Vue 2 规则 | 56 |
| ElementUI → Element Plus 规则 | 40 |
| Options → Composition 规则 | 25（含 el-icon / template ref collision） |
| 已实现插件 | 9（vue2-compat / vue3-entry / vue3-template / vue3-directives / vue3-types / elementui / composition / vue-router-v4 / vuex-pinia） |
| 测试样本 | 7 个项目（50+ 文件，含 stress 1000+ 行文件 + 真实电商后台） |
| 真实项目通过率 | 28/28（vue2-manage-master） |
| 自演化系统 | Phase 1 ✅ Phase 2 搭建中 |

## 目录结构

```
vue-migrate/
├── packages/                    # 转换引擎
│   ├── core/                   #   scanner / parser / codegen / reporter / orchestrator
│   ├── cli/                    #   命令行入口
│   └── plugins/                #   9 个迁移插件
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

- `docs/TODO_Vue3_Conversion_Catalog.md` — 56 条核心 Vue 2→3 规则
- `docs/ElementUI_ElementPlus_Catalog.md` — 40 条 UI 库迁移
- `docs/Options_To_Composition_Catalog.md` — 25 条 Options→`<script setup>`
- `docs/Router_V4_Catalog.md` — Vue Router 3→4
- `docs/Vuex_Pinia_Catalog.md` — Vuex→Pinia
- `docs/iterate-log/{date}.md` — 每轮迭代的执行日志
- `KNOWN_ISSUES.md` — 当前已知未修问题
