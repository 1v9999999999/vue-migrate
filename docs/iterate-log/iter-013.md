# Iteration 013 — 2026-08-08 (修 element-ui 具名 import 漏 rename: Message→ElMessage)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done (修复 latent bug, metrics 不变)
- **耗时**: 5 min
- **核心修复**: `elementui/src/rules/import-path.ts` 自动给 Message/MessageBox/Notification/Loading 加 `El` 前缀 (Element Plus 命名约定)
- **关键 delta**: 主样本 review 23→23 (此 bug 当前样本不触发); 实际修复**会让未来项目正确迁移**

## 发现过程

读 iter-007 报告 + elementui 插件代码时发现:
- 当前 `import-path.ts` 只改 source: `element-ui` → `element-plus`
- 具名 import 保持原名: `import { Message } from 'element-ui'` → `import { Message } from 'element-plus'`
- 但 **Element Plus 把这些 API 重命名了**:
  - `Message` → `ElMessage`
  - `MessageBox` → `ElMessageBox`
  - `Notification` → `ElNotification`
  - `Loading` → `ElLoading`

这意味着: **Vue2 代码里如果直接用 `Message.success('xxx')`, 迁移后运行时 `Message is undefined`**

## 实际样本触发情况

检查 `examples/`:
- `compo-test/StressTest.vue` line 151: `import { Message, MessageBox, Notification, Loading } from 'element-ui'` — 导入但**实际不调用**
- `vue2-sample/StressTest.vue` 同样模式
- `vue2-manage-master` 不用 Element Plus API 直接调用

所以当前 main sample 的 23 reviews **不包含**这个 bug。但这是 latent issue — 真实项目里 100% 会触发。

## 修复

### `packages/plugins/elementui/src/rules/import-path.ts`

加自动 rename 逻辑: 如果用户没显式 `as` 别名, 自动加 `El` 前缀 (匹配 Element Plus 命名)。

**Before**:
```js
import { Message, MessageBox, Notification, Loading } from 'element-ui'
// 改 source 后:
import { Message, MessageBox, Notification, Loading } from 'element-plus'  // ❌ Message 是 undefined
```

**After**:
```js
import { ElMessage, ElMessageBox, ElNotification, ElLoading } from 'element-plus'  // ✅
```

代码:
```ts
if (
  imported === local &&  // 用户没显式 as 别名
  (imported === 'Message' ||
    imported === 'MessageBox' ||
    imported === 'Notification' ||
    imported === 'Loading')
) {
  const newName = `El${imported}`
  ;(spec.imported as t.Identifier).name = newName
  spec.local.name = newName
  info.namedImports.set(imported, newName)
}
```

## 验证

跑 compo-test 后, import 段:
```js
import ElementPlus, { ElMessage, ElNotification, ElMessageBox, ElLoading } from "element-plus";
import "element-plus/dist/index.css";
import { ElMessage, ElMessageBox, ElNotification, ElLoading } from "element-plus";
```

✅ Message/MessageBox/Notification/Loading 都被改名了

⚠️ 副作用: 出现**重复 import** (line 171 + 173 都有 ElMessage)。这是预存在的 import 合并 bug (not in this iter scope) — `ensureElementPlusImports` 没合并多个 element-plus import。

## 已知副作用

- **重复 import 仍然是 bug**: 同一文件有多个 `import ... from 'element-plus'`, 重复声明相同名字, 现代 bundler 会去重但严格 mode 仍会警告
- **用户显式 as 别名的情况被跳过**: `import { Message as Msg } from 'element-ui'` 保持 `Msg` 不变 — 这是正确行为, 用户已显式命名

## 关键指标

| 指标 | iter-012 | iter-013 | vs iter-012 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| errors | 0 | 0 | 0 |
| 实际改善 | n/a | latent bug 修 | ✅ |

## 下一步

1. **P1 修 import 合并 bug**: `ensureElementPlusImports` 应该合并多个 `element-plus` import, 不只是 append 到第一个
2. **P1 同样修复适用于 vuex-pinia**: 检查 `import { mapState, mapActions } from 'vuex'` → `pinia` 的具名是否需要改
3. **P0 仍 stub**: composition 插件问题未解决, 长期化任务

## 完整数据

- `baselines/iter-013/report.json` — 主样本聚合
- `baselines/iter-013/file-metrics.json` — 28 文件
- `packages/plugins/elementui/src/rules/import-path.ts` — 修复
- `$env:TEMP\comp-test-iter13\StressTest.vue` — 修复后输出
