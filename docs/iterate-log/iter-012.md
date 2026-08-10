# Iteration 012 — 2026-08-08 (P0 试探: composition 启用 + 立即回滚)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ⚠️ 试探 + 回滚 (no net change, 但有 critical finding)
- **耗时**: 5 min
- **核心发现**: composition 简版虽然跑通 (无 syntax error, 0 errors), 但产出的 Vue3 代码 **运行时是错的**:
  - data 字段被声明为 `let xxx: any` (而不是 `const xxx = ref(...)`)
  - `created()` body 用 `items.length`, 但 `items` 是 undefined, 运行时崩溃
  - `import { useStore } from 'pinia'` 但实际是 Vuex 项目, 完全是错的
- **动作**: 立即回滚 `result.changed = true` → `false`, 备份在 `$env:TEMP\options-to-setup-iter012.bak.ts`
- **关键 delta**: 主样本 review 23→23 (无变化, 验证 rollback 成功)

## 试探过程

### 1. 备份当前 stub 文件

```bash
Copy-Item options-to-setup.ts $env:TEMP\options-to-setup-iter012.bak.ts
```

### 2. 改 `result.changed = false` → `true`

iter-008 改的 comment 也更新了: "iter-012: enable to test if simplified version works without regression"

### 3. 跑 compo-test 单文件测试

```bash
tsx packages/cli/src/index.ts transform examples/compo-test -o $env:TEMP\comp-test-iter12
```

**报告**:
- 文件: 1
- 错误: 0
- 评审: 20 (跟 stub 模式完全一致)
- 转换标志: `✓ composition: [composition] → <script setup> (0 imports, 282 lines)`

0 errors 看似成功, 实际是**假阳性** — 编译/语法没问题, 但运行时类型不对。

### 4. 实际看转换出的代码

打开 `$env:TEMP\comp-test-iter12\StressTest.vue` 第 437-460 行:

```vue
// --- beforeCreate() inline ---
{
  console.log('beforeCreate');
}
// --- created() inline ---
{
  console.log('created, items:', items.length);  // ❌ items is undefined
}
let title: any
let modalTitle: any
let items: any          // ❌ 应该是 const items = ref([...]) 或 reactive([...])
let currentUser: any
let searchText: any
```

### 5. 进一步发现 (更严重)

```vue
const route = useRoute()           // ❌ 没 import useRoute
const store = useStore()           // ❌ 错误地 import 自 pinia, 但项目是 Vuex
import { useStore } from 'pinia'   // ❌ Vuex 项目用 pinia
import { useRoute } from 'vue-router' // ❌ vue-router 4 里 useRoute 是从 'vue-router' 没错, 但路由 context 还没准备
```

这些都是简化版的硬伤。**完整版的 broken 文件 (`options-to-setup.ts.broken`, 216KB) 才能正确处理这些**。

## 回滚

```bash
Copy-Item $env:TEMP\options-to-setup-iter012.bak.ts packages/plugins/composition/src/options-to-setup.ts -Force
```

验证:
- `Length: 24582` (跟 iter-011 一致)
- `grep "result.changed = false"` 找到注释行
- 跑主样本: 28 files, 42 modified, 23 review, 0 errors ✅ (跟 iter-007/009/010/011 一致)

## 教训

1. **0 errors 不等于正确** — 我们的 reporter 只检测 syntax / compile error, 不检测 semantic/runtime correctness
2. **简化版确实丢了核心功能** — ref/reactive 转换、useRoute/useStore 注入、this 替换都是 broken 的
3. **stub 模式反而比启用更安全** — 至少不破坏现有代码, 用户能拿 review notes 手工迁移
4. **真正修复 composition 需要从 .broken 重建 (2K+ 行)** — 工作量太大, 下一轮 cron 也不一定够时间

## 关键指标

| 指标 | iter-011 | iter-012 | vs iter-011 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| composition changed | false (stub) | false (试探+回滚) | 0 |
| 0 errors | ✅ | ✅ | ✅ |
| 运行时正确性 | n/a (stub 不改文件) | ❌ (简版数据字段是 `let xxx: any` 不是 `ref(...)`) | n/a |

## 下一步

1. **P0 composition 修复长期化**: 写 .broken 的 proper restore (2K+ 行, 工作量超 1 轮 cron)
2. **P1 reporter 增强**: 检测 `let xxx: any` 模式 (data 字段未转 ref) → 加 review 警告
3. **P1 优先**: 既然 composition stub 模式是当前能用的最佳状态, 把精力放在 #5/#6 之外的小改进
4. **P2 review note 改进**: 把 "vue3-types TODO: $refs usage found" 这类加上 link 到具体 fix 示例

## 完整数据

- `baselines/iter-012/report.json` — 主样本 28 files
- `$env:TEMP\comp-test-iter12\StressTest.vue` — composition 启用后的输出 (演示错误, 已保留做证据)
- `$env:TEMP\options-to-setup-iter012.bak.ts` — 回滚前的备份 (24582 字节)
- `packages/plugins/composition/src/options-to-setup.ts` — 已回滚到 stub 模式
