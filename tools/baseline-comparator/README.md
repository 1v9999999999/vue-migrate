# vue-migrate / baseline-comparator

> 客观标准子系统：用官方 Vue 团队维护的 codemod 作为对照，量化"我们比官方好在哪 / 差在哪"。

## 作用

vue-migrate 自身是迁移工具，要持续改进质量。我们需要一个**客观基线**：

- 拿一个标准样本（比如 `examples/vue2-manage-master/src/`，28 个 .vue/.js 文件的真实项目）
- 我们的工具跑一遍 → 输出 A
- 官方 codemod 跑一遍 → 输出 B
- 对比 A vs B，得出 5 个量化指标

把这些指标放进 `IterationReport.stats`，scheduler 就能据此判断"这轮改进有没有真效果"。

## 关于包名（重要）

任务原文写的官方 codemod 是 `@vue/codemod`。**但这个包在 npm 上不存在**——Vue 团队实际发布的包叫 `vue-codemod`（GitHub: `vuejs/vue-codemod`，npm: `vue-codemod@0.0.5`）。

本工具的处理：
1. `package.json` 里声明的是 `vue-codemod`（确保 install 真的能成功）
2. CLI 的 `install` 命令会按任务字面意思先试 `@vue/codemod`，失败后 fallback 到 `vue-codemod`
3. 内部统一用 `vue-codemod` 这个 CLI 名字调用（`npx vue-codemod`）

## 安装

```bash
cd tools/baseline-comparator
npm install
```

或在 vue-migrate 根目录：

```bash
tsx tools/baseline-comparator/src/index.ts install
```

会按 `@vue/codemod` → `vue-codemod` 的顺序尝试。

## 使用

### 1. 单个 sample

```bash
tsx tools/baseline-comparator/src/index.ts run \
  --sample examples/vue2-manage-master/src \
  --work baselines/test-work
```

输出：
- 人类可读的对比报告（中文）
- 末尾有完整 JSON

### 2. 批量 sample

```bash
tsx tools/baseline-comparator/src/index.ts run-all \
  --samples examples \
  --work baselines/run-all
```

会扫描 `examples/` 下每个子目录作为样本。

### 3. 帮助

```bash
tsx tools/baseline-comparator/src/index.ts --help
```

### 4. 单元测试

```bash
cd tools/baseline-comparator
npm test
# 或：tsx --test src/__tests__/metrics.test.ts
```

## 5 个指标

| 指标 | 范围 | 含义 | 越高代表 |
|---|---|---|---|
| `compileOk` | (0,1] | 双方输出都能被 babel-parser 解析的文件比例 | 我们的输出越接近合法 JS |
| `astEquivalent` | (0,1] | AST 结构（Jaccard）相似度 | 我们和官方在结构上越接近 |
| `semanticDiff` | (0,1] | Vue3 友好度（good pattern / total pattern） | 我们用 Vue3 API 越多 |
| `runtimeSafe` | (0,1] | import 路径 / 注册方式合法率 | 我们的 import 越能直接跑起来 |
| `reviewDelta` | 整数 | 我们的 review 数 - 官方 review 数 | 越低越好；负数代表我们更省人工 |

`reviewCount` / `officialReviewCount` 是配套的原始计数。

## 文件结构

```
tools/baseline-comparator/
├── package.json                独立 npm 包，声明 vue-codemod / @babel/parser / etc.
├── tsconfig.json
├── README.md                   本文件
├── SUMMARY.md                  跑 examples/vue2-manage-master/src 的实际数据
├── node_modules/
└── src/
    ├── index.ts                CLI 入口（commander-like 手写 parser）
    ├── run-official.ts         封装 vue-codemod 的 spawn 调用 + 文件读写
    ├── metrics.ts              5 个对比指标的实现
    ├── runner.ts               跑一个完整 sample：copy → 双跑 → 对比
    └── __tests__/
        └── metrics.test.ts     node:test 单元测试
```

## 关键设计决策

1. **保护原样本不被污染**：`compareOneSample` 会把样本复制到 `<workDir>/our/` 和 `<workDir>/official/`，对副本分别跑 vue-migrate 和 vue-codemod。原样本始终只读。

2. **graceful degradation**：
   - 官方 codemod 没装 → `officialRun.ok = false`，跳过这步，其它照跑
   - 官方 codemod 超时 → 同上
   - 我们的 vue-migrate 跑挂 → `ourRun.ok = false`，但官方数据仍然有效
   - 顶层 catch 永远不抛出：所有异常都被记录

3. **超时控制**：单个 sample 默认 10 分钟超时（`runOneSample` 的 `timeoutMs`）。子步骤独立计时。

4. **review 概念统一**：vue-migrate 的 review 来自插件的 `utils.manualReview()` 累加；vue-codemod 没有 review 概念，它的 `reviewCount` 默认 0，从 stdout 里的 "warning" 提及次数推断。

5. **AST hash 策略**：用 `Map<结构化key, count>` 做 multiset，然后 Jaccard。结构化 key = `NodeType|attr1=v1,attr2=v2`，属性走白名单（name / value / operator 等）避免被注释/位置干扰。

6. **为什么不直接 import @vue-migrate/core**：因为 baseline-comparator 是 `tools/` 下的独立子系统，不在 pnpm workspace 里，import workspace 依赖会很麻烦。改用 `npx tsx packages/cli/src/index.ts transform …` 走 CLI 方式更稳，跨平台一致。代价是：要解析中文报告文本。

## 给后续 agent 的建议

- 跑样本时建议先用 `--work baselines/test-work` 试一个，确认能跑通再批跑
- 想让 metrics 更准，可以扩展 `metrics.ts` 里的 `BAD_PATTERNS` / `GOOD_PATTERNS` 列表
- `astEquivalent` 目前是 multiset Jaccard，对属性顺序不敏感。如果需要更严格的结构对比，可以换成 tree edit distance（但更慢）
- vue-codemod 不支持 in-place 行为定制（不支持 --dry-run），所以"备份"这步要靠我们自己：在 runner 里复制样本
- 想把 metrics 接入 `IterationReport`，参见 `tools/common/types.ts` 的 `BaselineMetrics`

## 验收

```bash
# 1. install
tsx tools/baseline-comparator/src/index.ts install

# 2. 单个 sample
tsx tools/baseline-comparator/src/index.ts run \
  --sample examples/vue2-manage-master/src \
  --work baselines/test-work

# 3. 单元测试
cd tools/baseline-comparator && npm test
```

任何一条失败都不会让其它跑挂（graceful degradation）。
