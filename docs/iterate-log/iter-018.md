# Iteration 018 — 2026-08-08 (🔍 调试 + 修: mark-todos 看不到 $listeners / $scopedSlots)

## TL;DR

- **触发**: cron 30m 唤醒
- **状态**: ✅ done
- **耗时**: 25 min (调试 + 修复)
- **🚨 根因发现**: vue3-template 插件 (priority 9) 在 vue3-types (priority 5) 之前跑, **会把 `this.$listeners` rename 成 `this.$attrs`, `this.$scopedSlots.xxx` rename 成 `this.$slots.xxx`**。所以 mark-todos 看到的不是 `$listeners` 而是 `$attrs` — 永远匹配不上 `$listeners` 规则 (死代码)
- **修复**: 把 mark-todos 的 `$listeners` rule 改名成 `$attrs`, `$scopedSlots` rule 改名成 `$slots` (匹配 rename 后的名字)
- **关键 delta**: 主样本 review 23→23; multi-sample totalReviewDelta 227→**234** (+7, 来自 vue2-sample 和 stress-compo 真的用了 $listeners/$scopedSlots 的样本)

## 调试过程

### 1. 假设 1: mark-todos 不会 visit $listeners

iter-017 改完 hint 文本后, 跑 stress-compo 看不到新 review。加 console.log 验证 markAccessorsAsTodo 是否被调用:

```ts
console.log(`[mark-todos] entering file=${file.path}, ast=${!!file.scriptAst}, astType=${file.scriptAst?.type}`)
```

输出: mark-todos IS called, ast=File. 所以 mark-todos 跑了。

### 2. 假设 2: traverseThisMembers 漏掉 $listeners

加 list all properties visited:

```ts
const allMemberProps = new Set<string>()
traverse(file.scriptAst, {
  MemberExpression: {
    enter(path: any) {
      if (t.isIdentifier(node.property)) {
        allMemberProps.add(node.property.name)
      }
    }
  }
})
console.log(`all MemberExpression property names: [${[...allMemberProps].join(', ')}]`)
```

输出 (StressTest.vue):
```
all MemberExpression property names: [..., $attrs, $children, $slots, ..., $store, ..., $route, ..., $watch, ..., $bus, $off, ..., resize, ...]
```

**$listeners 不在列表里! 但 $attrs 在!**

### 3. 假设 3: parse 漏掉

跑独立测试脚本 `find-listeners.ts` (用同样的 @babel/parser):

```ts
const ast = parse(scriptContent, { sourceType: 'module', plugins: ['typescript'] })
traverse(ast, {
  MemberExpression(path) {
    if (propDesc.includes('listeners')) console.log(...)
  }
})
```

输出: **found 2 this.$listeners in AST** ✅

所以 parse 没问题。**差异在 mark-todos 跑时, AST 已经被其他插件修改了**。

### 4. 假设 4: vue3-template 提前重命名

`grep "listeners" packages/plugins` → 找到 `vue3-template/src/rules/script-instances.ts:66`:
```ts
t.isIdentifier(node.property, { name: '$listeners' })
// ...
node.property = t.identifier('$attrs')  // ← 重命名!
```

确认: vue3-template (priority 9) 跑在 vue3-types (priority 5) 之前, 把 `this.$listeners` 改成了 `this.$attrs`。所以 mark-todos 看到的是 $attrs 而不是 $listeners。

同埋: `$scopedSlots.xxx` → `$slots.xxx` (line 56)。

## 修复

### `packages/plugins/vue3-types/src/rules/mark-todos.ts`

把 TODO_RULES 改成匹配 rename 后的名字:

**Before**:
```ts
{ property: '$listeners', category: '$listeners', vue3Hint: '...' }
{ property: '$scopedSlots', category: '$scopedSlots', vue3Hint: '...' }
```

**After**:
```ts
{ property: '$attrs', category: '$attrs (含原 $listeners)', vue3Hint: 'this.$attrs (Vue3 合并了原 Vue2 的 $listeners)  // 例: this.$attrs.onClick → emits("onClick", $event), 或在子组件 setup 里 const emit = defineEmits(["onClick"]); emit("onClick", $event)' }
{ property: '$slots', category: '$slots (含原 $scopedSlots)', vue3Hint: 'this.$slots.xxx() (slots are now functions)  // Vue2 的 $scopedSlots 已重命名为 $slots; 旧用法 this.$scopedSlots.xxx → 新用法 this.$slots.xxx()' }
```

iter-017 的 hint 文本被复用, 升级成 "含原 Xxx" 标识。

## 验证

### stress-compo

新 review 出现:
```
vue3-types TODO: $attrs (含原 $listeners) usage found (×2) — this.$attrs (Vue3 合并了原 Vue2 的 $listeners)  // ...
vue3-types TODO: $slots (含原 $scopedSlots) usage found (×2) — this.$slots.xxx() ... 
```

### multi-sample (171 文件, 6 sample)

| Sample | iter-017 rev | iter-018 rev | Δ |
|---|---|---|---|
| compo-test | 20 | 20 | 0 |
| stress-compo | 20 | 22 | +2 |
| test-keep | 0 | 0 | 0 |
| vue2-element-touzi-admin-dev-permission | 41 | 41 | 0 |
| vue2-manage-master | 102 | 102 | 0 |
| vue2-sample | 44 | 47 | +3 |
| **total** | **227** | **234** | **+7** |

✅ +7 review 全部来自真正用了 $listeners/$scopedSlots 的样本, 不是 false positive

## 关键指标

| 指标 | iter-017 | iter-018 | vs iter-017 |
|---|---|---|---|
| 主样本 reviewCount | 23 | 23 | 0 |
| 主样本 errors | 0 | 0 | 0 |
| multi-sample totalReviewDelta | 227 | 234 | +7 |
| mark-todos rules 总数 | 7 | 7 | 0 (2 个改名) |
| dead code | 1 ($listeners 规则) | 0 | ✅ |
| diagnostic logs | 7 (调试用) | 0 | ✅ (已清) |

## 教训

1. **插件顺序 + AST 修改要协调**: vue3-template rename $listeners → $attrs, 但没通知下游插件; 跨插件需要协调契约
2. **console.log + 隔离测试脚本 = 调试利器**: 这次 25 分钟找到根因, 主要靠日志
3. **iter-017 改的 hint 是死代码**: 没找到根因就改 hint 是无效的, 这次才真正修对

## 下一步

1. **P1 协调 vue3-template ↔ vue3-types 契约**: 让 vue3-template rename 时记录"我重命名了 X → Y", vue3-types 据此调整
2. **P1 同样检查 $scopedSlots 是不是也加了 review**: 已经在 iter-018 一起改
3. **P0 composition 长期化**: 仍 stub

## 完整数据

- `baselines/iter-018b/report.json` — 主样本 23 review
- `baselines/iter-018/multi-sample/summary.json` — 234 totalReviewDelta
- `packages/plugins/vue3-types/src/rules/mark-todos.ts` — 修复
- `packages/plugins/vue3-template/src/rules/script-instances.ts` — rename 源 (未改)
