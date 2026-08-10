# Regression Suite

`vue-migrate` 持续迭代时的"金标":每次规则改动后跑一遍,统计 pass-rate 变化。
pass-rate 下降 > 5% 时整个 runner 抛 `RegressionError`,让 scheduler 知道要回滚。

## 目录结构

```
tools/regression-suite/
├── package.json
├── README.md
├── SUMMARY.md                   # 当前基线状态
└── src/
    ├── index.ts                 # CLI 入口: select | run | report
    ├── select-golden.ts         # 挑选金标
    ├── compare.ts               # 单文件 hash 比对
    ├── runner.ts                # 跑整套 + regression detection
    └── __tests__/
        └── compare.test.ts      # 16 个单测 (sha256, tag, pickFiles, diff, threshold)
```

## 三条命令

```powershell
# 1) 选 50 个金标, 跑一次 transform 记录 expected hash
node packages/cli/node_modules/tsx/dist/cli.mjs `
  tools/regression-suite/src/index.ts select `
  --examples examples/ `
  --out baselines/golden.json `
  --target 50

# 2) 跑整套, 输出 work/suite-result.json
node packages/cli/node_modules/tsx/dist/cli.mjs `
  tools/regression-suite/src/index.ts run `
  --golden baselines/golden.json

# 3) 读结果出 pretty 报告
node packages/cli/node_modules/tsx/dist/cli.mjs `
  tools/regression-suite/src/index.ts report `
  --result work/suite-result.json
```

## 关键设计

### 挑选策略 (`select-golden.ts`)

- 每个 `examples/` 一级子目录至少 5 个文件 (有内容的目录才参与)
- 按大小分桶: `small (<2KB) / medium (2-10KB) / large (>10KB)` = 30/40/30
- 优先命中特征: `el-` / `this.$` / `Vue.use` / `Vuex` / `Router` / `mounted` / `created` / `slot-scope` / `Vue.extend` / `defineComponent` 等
- 选完后对每个文件跑一次 vue-migrate 算 expected hash, 源文件 copy 到 `baselines/golden/<path>` (不污染 examples/)
- 输出 manifest 含:
  ```json
  {
    "version": 1,
    "createdAt": "...",
    "probeRuns": 50,
    "bucketStats": { "small": 13, "medium": 19, "large": 18 },
    "tagStats": { "vue2": 47, "element-ui": 40, ... },
    "files": [{ "path": "...", "expectedHash": "...", "tags": [...], "bytes": ..., "lines": ..., "bucket": "..." }]
  }
  ```

### Hash 算法

- 归一化行尾: `content.replace(/\r\n/g, '\n')` 后做 SHA-256
- "文件未被任何 plugin 改" (vue-migrate 没产出输出文件) → hash = `''` (空串)
- 两边都空串 → matches=true (这是合理语义: baseline 也没改, 这次也没改)

### Regression Detection (`runner.ts`)

- `newPassRate = matches / total` (当前轮通过率)
- `passRate` 暂时等于 `newPassRate` (保留字段, 备将来多源扩展)
- 与 `prev` (上次 suite result) 对比:
  - `wasMatch=true && cur.matches=false` → **regression** (失败文件进 failedFiles)
  - `wasMatch=false && cur.matches=true` → **improvement**
  - `wasMatch=false && cur.matches=false` → **unchanged**
  - 新文件 (prev 中没有): 通过 → improvement, 失败 → regression
- 阈值: `prev.newPassRate - newPassRate > 0.05` → 抛 `RegressionError`
- runner 抛错时仍会写一份 partial result 到 `work/suite-result.json`, 然后 exit 2

### 进程隔离

每次 transform 是 `child_process.spawn` 调用 `tsx packages/cli/src/index.ts transform`:
- 单文件 → copy 到临时目录 → transform 整个临时目录 → 读 `<out>/<basename>`
- 临时目录清理 (除 `--keep-tmp` 调试外)
- 30 秒单文件超时, 失败 kill

### 退出码

| code | 含义 |
|------|------|
| 0 | 全 pass, 无 regression |
| 1 | 内部错误 (文件读取、IO 等) |
| 2 | **RegressionError**, pass-rate 下降 > 5% |

## 测试

```powershell
node packages/cli/node_modules/tsx/dist/cli.mjs --test `
  tools/regression-suite/src/__tests__/compare.test.ts
```

16 个测试覆盖: SHA-256 归一化 / tag 检测 / pickFiles 桶+floor 逻辑 /
diffAgainstPrev (regression / improvement / unchanged / 新文件 / 无 prev) /
checkRegressionThreshold (>5% 抛 / =5% 不抛 / 改善不抛) / compareFile hash 比对.

## 已知 trade-off

- **单文件 transform 慢**: 每次 spawn node + tsx 加载 vue-migrate 全套 plugins ≈ 0.5s
  - 50 文件 ≈ 25s
  - 100 文件 ≈ 50s
  - 改进方向: 复用 in-process API, 或批量 transform
- **没处理 plugin 副作用**: vue-migrate plugin 会在 import 时注册 (vuex, router 等),
  多次 spawn 之间是干净的, 但 in-process 跑要小心重复注册
- **预期 hash = "" 的语义**: 不存源文件 hash, 只存"无变化" 标记. 万一将来 rule 让
  本来无变化的元素开始被改, 那是 improvement, 不是 regression
- **CRLF vs LF**: 归一化到 LF 解决跨平台问题. 如果 vue-migrate 内部对 source CRLF
  做了特殊处理, 这种归一化可能掩盖 case (极少见, 暂不处理)
