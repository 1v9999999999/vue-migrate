/**
 * tools/scheduler/src/agent-dispatcher.ts
 *
 * 子 agent 派发协议。
 *
 * 工作流：
 *   1. shouldSpawnAgent(recentReports, openIssues) → IssueTicket | null
 *      - 同一个 issue 在最近 3 次迭代都没修 → 派发
 *   2. spawnAgentForIssue(issue, workDir) → 写 markdown ticket 到
 *      baselines/.agent-tickets/{issueId}.md
 *   3. 主进程（人类 + Claude）轮询 .agent-tickets 目录，
 *      对每个新 ticket 调用 `mavis task` 派发子 agent
 *   4. agent 完成后修改 issue.status = 'fixed' / 'wontfix'
 *
 * 为什么不直接调 mavis？
 *   - scheduler 本身是长跑进程，无法用 mavis 工具（那是会话级工具）
 *   - 派发由主进程协调：scheduler 写 ticket，主 agent 读 ticket 后派发
 *   - 这样 scheduler 是无状态的，崩溃/重启不影响 ticket 队列
 */

import { writeFile, readFile, readdir, mkdir, access, unlink, constants } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { IssueTicket, IterationReport } from '../../common/types.js'

/** Agent ticket 文件目录 */
export const DEFAULT_TICKETS_DIR = 'baselines/.agent-tickets'

/** 默认最大尝试次数（连续 3 次迭代未修 → 派发） */
export const DEFAULT_MAX_ATTEMPTS = 3

/** 派发 ticket 接口 */
export interface AgentDispatchTicket {
  ticketId: string
  issue: IssueTicket
  attempts: number
  maxAttempts: number
  lastError?: string
  spawnedAt?: string
}

/**
 * 根据最近 3 轮 reports 和当前 open issues，
 * 决定是否需要派发 agent。
 *
 * 规则：
 *   - 同一个 issue.id 在最近 N 轮 (默认 3) reports 的 failures 中都出现 → 派发
 *   - 同一个 issue 的 failedAttempts >= maxAttempts → 派发
 *   - 优先派发失败次数最多的（已经积累更多 context）
 */
export async function shouldSpawnAgent(
  recentReports: IterationReport[],
  openIssues: IssueTicket[],
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<IssueTicket | null> {
  if (openIssues.length === 0) return null
  if (recentReports.length === 0) return null

  // 统计最近 N 轮 reports 中每个 issue 的出现次数
  // （基于 failures[].path 模糊匹配，因为 issue.id 可能不一样）
  const recentWindow = recentReports.slice(-maxAttempts)

  // 候选 issue：status=open 且 failedAttempts >= maxAttempts
  const candidates = openIssues
    .filter((i) => i.status === 'open' && i.failedAttempts >= maxAttempts)
    .map((issue) => {
      // 在 recent reports 中匹配次数（通过 exampleFiles）
      const matchCount = recentWindow.reduce((acc, report) => {
        const inThisReport = report.failures.some((f) =>
          issue.exampleFiles.some((ef) => ef === f.path || f.path.includes(ef) || ef.includes(f.path)),
        )
        return acc + (inThisReport ? 1 : 0)
      }, 0)
      return { issue, matchCount }
    })
    .filter((c) => c.matchCount >= maxAttempts)

  if (candidates.length === 0) return null

  // 按 failedAttempts 降序，优先处理"老问题"
  candidates.sort((a, b) => b.issue.failedAttempts - a.issue.failedAttempts)
  return candidates[0].issue
}

/**
 * 生成 ticket markdown 内容。
 * 供 mavis task 子 agent 阅读。
 */
function renderTicketMarkdown(issue: IssueTicket, attempts: number): string {
  return `# Agent Dispatch Ticket

## Issue
- **ID**: \`${issue.id}\`
- **Status**: ${issue.status}
- **Severity**: ${issue.severity}
- **Type**: ${issue.type}
- **Failed Attempts**: ${attempts}

## Description
${issue.description}

## Example Files
${issue.exampleFiles.map((f) => `- \`${f}\``).join('\n')}

## Payload

### Input
\`\`\`
${issue.payload.input}
\`\`\`

### Actual Output
\`\`\`
${issue.payload.actualOutput}
\`\`\`

### Expected Output
\`\`\`
${issue.payload.expectedOutput}
\`\`\`

## Instructions for Sub-Agent

You are dispatched by the vue-migrate scheduler to handle this specific issue.

1. **Read** the issue description and example files.
2. **Investigate** why the current rule (or lack thereof) doesn't handle this case.
3. **Decide**:
   - If you can fix it: implement the rule in
     \`packages/codemod/src/plugins/<plugin-name>/<rule-name>.ts\`,
     add tests in \`packages/codemod/src/plugins/<plugin-name>/__tests__/<rule-name>.test.ts\`,
     then update the issue status to \`fixed\` in
     \`baselines/.agent-tickets/${issue.id}.md\`.
   - If it's a design problem: write a brief design doc to
     \`docs/iterate-log/\` and set the issue status to \`wontfix\`.
4. **Verify** by running \`pnpm test\` in the repo root.

## Constraints

- Do **NOT** touch unrelated files.
- Do **NOT** change the public API of any rule.
- Follow the existing plugin pattern (see \`tools/rule-generator/README.md\`).
- Keep PRs small and focused on this single issue.

## Status Updates

<!-- Sub-agent: edit below as you make progress -->
- [ ] Investigated
- [ ] Implemented
- [ ] Tested
- [ ] Status: pending → \`fixed\` / \`wontfix\`

---
*Created at: ${new Date().toISOString()}*
*Spawned by: scheduler (consecutive-failure trigger)*
`
}

/**
 * 写 ticket markdown 到 baselines/.agent-tickets/{issueId}.md。
 * 写完后返回 ticket ID 和文件路径。
 *
 * 不直接调 mavis——由主进程（人类 / Claude 父会话）读取 .agent-tickets 目录
 * 决定派发时机。
 */
export async function spawnAgentForIssue(
  issue: IssueTicket,
  workDir: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<{ success: boolean; result?: string; error?: string }> {
  const ticketsDir = join(workDir, DEFAULT_TICKETS_DIR)
  await mkdir(ticketsDir, { recursive: true })

  const ticketPath = join(ticketsDir, `${issue.id}.md`)

  // 检查是否已经派发过（防重复）
  try {
    await access(ticketPath, constants.F_OK)
    return {
      success: false,
      error: `Ticket already exists: ${ticketPath}`,
    }
  } catch {
    // 不存在，OK
  }

  try {
    const md = renderTicketMarkdown(issue, issue.failedAttempts)
    await writeFile(ticketPath, md, 'utf8')
    return {
      success: true,
      result: ticketPath,
    }
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
    }
  }
}

/**
 * 列出当前所有 open 的 agent tickets。
 * 供主进程（父 agent）轮询。
 */
export async function listOpenTickets(
  workDir: string,
): Promise<Array<{ id: string; path: string; createdAt: string }>> {
  const ticketsDir = join(workDir, DEFAULT_TICKETS_DIR)
  try {
    const entries = await readdir(ticketsDir)
    const result: Array<{ id: string; path: string; createdAt: string }> = []
    for (const e of entries) {
      if (!e.endsWith('.md')) continue
      const full = join(ticketsDir, e)
      try {
        const stat = await import('node:fs/promises').then((m) => m.stat(full))
        result.push({
          id: e.replace(/\.md$/, ''),
          path: full,
          createdAt: stat.mtime.toISOString(),
        })
      } catch {
        // 跳过
      }
    }
    return result
  } catch {
    return []
  }
}

/**
 * 标记 ticket 为已处理（sub-agent 完成后调用）。
 * 删除 .md 文件，并把结果写回 history。
 */
export async function completeTicket(
  workDir: string,
  issueId: string,
  resolution: 'fixed' | 'wontfix',
  notes?: string,
): Promise<void> {
  const ticketsDir = join(workDir, DEFAULT_TICKETS_DIR)
  const ticketPath = join(ticketsDir, `${issueId}.md`)

  // 写完成记录
  const completionPath = join(ticketsDir, `${issueId}.completed.md`)
  const completion = `# ${issueId} — ${resolution.toUpperCase()}

Completed at: ${new Date().toISOString()}

${notes || ''}
`
  await writeFile(completionPath, completion, 'utf8')

  // 删除原 ticket
  try {
    await unlink(ticketPath)
  } catch {
    // 已经删除，OK
  }
}
