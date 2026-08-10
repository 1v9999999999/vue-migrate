# vue-migrate 自演化系统架构

## 一、设计目标

让 vue-migrate 能够**自动**：
1. 发现新的测试样本（GitHub 上真实的 Vue 2 项目）
2. 跑转换并和"客观标准"对比
3. 找出转换中的不足
4. 生成新规则或修 bug
5. 验证不回归
6. 沉淀文档和提交
7. 遇到卡住的问题时派子 agent 专门处理

整个系统每 30 分钟跑一次，**不间断**地提升转换质量。

## 二、5 个子系统

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  sample-collector│    │baseline-comparator│    │ regression-suite │
│  GitHub mining   │    │ 官方 codemod 对比 │    │ 100 文件金标     │
│  多样性矩阵       │    │  5 个 metric      │    │ passRate 追踪    │
└────────┬─────────┘    └────────┬──────────┘    └────────┬─────────┘
         │                       │                        │
         ▼                       ▼                        ▼
    ┌─────────────────────────────────────────────────────────┐
    │                       orchestrator                       │
    │              单次迭代的主流程（tsx tools/orchestrate.ts） │
    └────────────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────┐
              │           scheduler              │
              │  状态机 + 30min cron + 派发协议   │
              └──────────────────┬───────────────┘
                                 │ 失败/卡住
                                 ▼
              ┌──────────────────────────────────┐
              │        rule-generator            │
              │  LLM 生成新规则代码 + 单元测试    │
              └──────────────────────────────────┘
```

## 三、单次迭代的 7 阶段状态机

```
        ┌────┐
        │idle│◄────────────────────────────────────────┐
        └──┬─┘                                         │
           │ cron 触发 / 手动 / agent 完成              │
           ▼                                            │
   ┌──────────────┐  sample-collector 失败?             │
   │  collecting  │──┐                                  │
   └──────┬───────┘  │ skip                             │
          │ ✓         ▼                                  │
   ┌──────┴────────────┐  convert 失败?                  │
   │    converting     │──┐                              │
   └──────┬────────────┘  │ fail→ failed                 │
          │ ✓              ▼                             │
   ┌──────┴────────────┐                                 │
   │     diffing        │  baseline 失败?                │
   └──────┬────────────┘──┐                              │
          │ ✓              │ 仅记 NaN                     │
   ┌──────┴────────────┐   │                             │
   │    analyzing       │◄──┘                             │
   └──────┬────────────┘                                  │
          │ 有 issue                                      │
          ├── 无 issue ──► testing                       │
          │                ▲                              │
          │ 有 issue                                        │
          ▼                                                │
   ┌──────────────┐                                       │
   │  generating  │── 生成新规则                          │
   └──────┬───────┘                                       │
          │ ✓                                              │
   ┌──────┴────────────┐                                  │
   │     testing        │                                  │
   └──────┬────────────┘                                  │
          │ ✓                                              │
   ┌──────┴────────────┐                                  │
   │    committing      │ 写 iterate-log / git commit      │
   └──────┬────────────┘                                  │
          │ ✓                                              │
          │  ←──── regression? 回滚 + 派 agent ───────────┤
          ▼                                                │
        ┌────┐                                             │
        │done│─────────────────────────────────────────────┘
        └────┘
```

## 四、核心数据结构

详见 `tools/common/types.ts`：

```typescript
interface IterationReport {
  id: string                       // ISO timestamp
  state: 'idle' | 'collecting' | 'converting' | 'diffing' | 'analyzing' | 'generating' | 'testing' | 'committing' | 'spawning_agent' | 'blocked' | 'done' | 'failed'
  stats: { totalSamples, totalFiles, errors, modified, reviewCount, outputValid }
  failures: Array<{ path, error, severity, type }>
  delta?: { errors, modified, reviewCount }    // vs prev
  agentTickets: string[]
}

interface IssueTicket {
  id: string
  description: string
  exampleFiles: string[]
  payload: { input, actualOutput, expectedOutput }
  severity: 'blocker' | 'warning' | 'minor'
  type: 'syntax' | 'semantic' | 'cosmetic' | 'runtime'
  status: 'open' | 'in_progress' | 'fixed' | 'wontfix'
  failedAttempts: number
}

interface ScheduleState {
  state: IterationReport['state']
  lastRunAt: string
  nextRunAt: string
  currentIteration: string
  history: Array<Pick<IterationReport, 'id' | 'state' | 'stats'>>  // 最近 50 轮
}
```

## 五、Agent 派发协议

当某个 issue 连续 **3 次迭代**未修 → spawn 一个 mavis 子 agent 专门处理。

派发流程：
1. scheduler 写一个 `baselines/.agent-tickets/{issueId}.md` 文件
2. 文件里包含：
   - Issue 描述
   - 输入样本代码（实际能复现的 .vue）
   - 当前 vue-migrate 输出
   - 期望输出
3. 根 agent 通过 `mavis({ command: "task", ... })` 派发
4. 子 agent 修完后写 `result.md` 回写
5. scheduler 检测 `result.md`，更新 `issue.status` = 'fixed' / 'wontfix'

**不无限派发**：单个 issue 最多 3 次派发机会（人/agent 介入的边界）。

## 六、安全阀

| 阀 | 触发 | 动作 |
|---|---|---|
| Pass rate regression | passRate 下降 > 5% | 标记为 regression，commit 跳过，写 review note |
| 单次迭代超时 | > 30 min | 状态机转 failed，state 保存，下次接着来 |
| 资源超限 | samples/ > 10GB | 暂停 collect，转 LRU 清理 |
| Issue 升级 | failedAttempts ≥ 5 | 状态转 `blocked`，等人工 |
| Agent 派发 | failedAttempts = 3 | spawn 子 agent |

## 七、成本估算

按 30min/iter，每 24h 跑 48 轮：

| 阶段 | 工具 | 成本 |
|---|---|---|
| collect | GitHub API（公开） | $0 |
| convert | vue-migrate 本地 | $0 |
| diff | vue-migrate + @vue/codemod | $0 |
| analyze | 正则/parse | $0 |
| generate | **LLM** (rule-generator) | ~$1/iter |
| test | vue-migrate + 100 文件 | $0 |
| commit | git + md | $0 |
| agent dispatch | **LLM** (子 agent) | ~$2/issue |

**总计**：~$3/iter × 48 = **~$144/day**

可优化：
- 用 `gpt-4o-mini` 替代 `gpt-4o`，成本降 70%
- 缓存相似 issue 的规则草稿
- 限制 generate 阶段只在发现真 issue 时才调用 LLM

## 八、与其他子系统的边界

| 子系统 | 不依赖谁 | 谁依赖它 |
|---|---|---|
| sample-collector | 无 | scheduler |
| baseline-comparator | sample-collector（产样本） | scheduler |
| regression-suite | sample-collector + vue-migrate | scheduler |
| rule-generator | baseline-comparator（产 metrics） | scheduler |
| scheduler | 所有 | 无 |

**核心原则**：每个子系统独立可运行 + 可测试，不与其他子系统紧耦合。

## 九、运行模式

### A. 长跑模式（生产）

```bash
tsx tools/scheduler/src/index.ts start
```

启动 30min cron，永远不停。

### B. 单次迭代模式（开发/调试）

```bash
tsx tools/scheduler/src/index.ts run-once --input examples/vue2-manage-master/src
```

只跑一次，立即出报告。

### C. 单文件调试

```bash
pnpm run dev:cli -- transform examples/.../X.vue -o /tmp/out --only-changed
```

跳过整套系统，直接调转换引擎。

### D. 手动派 agent

```bash
# 标记 issue 让 agent 处理
tsx tools/scheduler/src/index.ts spawn-agent --issue KNOWN_ISSUES.md#1
```

## 十、roadmap

| 阶段 | 目标 | 状态 |
|---|---|---|
| Phase 0 | 主转换引擎 (9 插件) | ✅ done |
| Phase 1 | 手动单次跑通 (orchestrate.ts) | ✅ done |
| Phase 2 | 5 个子系统搭建 | 🟡 in progress |
| Phase 3 | 文档沉淀 | ✅ done |
| Phase 4 | 第一次完整迭代报告 | 🟡 next |
| Phase 5 | 接入 cron 真正长跑 | pending |
| Phase 6 | rule-generator 接 LLM | pending |
| Phase 7 | Agent 派发 + GitHub PR | pending |
