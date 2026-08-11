# iter-081 计划: defineEmits 推断增强 (arg count + payload interface)

## 现状 (iter-046)

`packages/plugins/composition/src/options-to-setup.ts` 当前生成:

```typescript
// TS 输出 (line 420)
const emit = defineEmits<{ eventName: any[] }>()  // payload = any[] 占位

// JS 输出 (line 423)
const emit = defineEmits(['eventName1', 'eventName2'])
```

**已知 TODO** (line 427):
```
事件 payload 类型是 any[](无精准推断), 如果需要可在 setup 里改成精确类型:
e.g. const emit = defineEmits<{ update: [id: number, value: string] }>()
```

## 增强目标

从 `this.$emit('eventName', arg1, arg2, ...)` 调用推 arg count,生成:

```typescript
// 增强后 TS 输出
interface EmitsPayloads {
  eventName1: [arg1: any, arg2: any]    // 2 个参数
  eventName2: [arg1: any]                // 1 个参数
  eventName3: []                         // 0 个参数
}
const emit = defineEmits<EmitsPayloads>()
```

**重要: 元素类型仍是 `any`** — 我们不做完整类型推断 (那需要 full type inference 系统, 1+ 周工作)。但 arg count 是确定的,这就是巨大改进。

## 实现策略

### 步骤 1: 扫描 this.$emit 收集 arg count

```typescript
// 在 convertOptionsToSetup 里
const emitArgCounts: Record<string, number> = {}  // eventName → arg count
traverse(methodsAst, {
  CallExpression(path) {
    if (isThisEmitCall(path)) {
      const eventName = path.node.arguments[0]
      if (t.isStringLiteral(eventName)) {
        // 注意: 排除 first arg (eventName 本身)
        const argCount = path.node.arguments.length - 1
        emitArgCounts[eventName.value] = argCount
      }
    }
  }
})
```

### 步骤 2: 生成 EmitsPayloads interface (仅 TS)

```typescript
function buildEmitsInterface(eventNames: string[], argCounts: Record<string, number>): string {
  const lines = eventNames.map(name => {
    const count = argCounts[name] ?? 0
    if (count === 0) return `  ${name}: []`
    const args = Array.from({length: count}, (_, i) => `arg${i + 1}: any`).join(', ')
    return `  ${name}: [${args}]`
  })
  return `interface EmitsPayloads {\n${lines.join(',\n')}\n}\n`
}
```

### 步骤 3: 改 line 412-423 输出

```typescript
// Before
injected.push(`const emit = defineEmits<{${tsSig}}>()`)
// or
injected.push(`const emit = defineEmits([${eventNames.map(n => `'${n}'`).join(', ')}])`)

// After (TS)
if (eventNames.length > 0) {
  injected.push(buildEmitsInterface(eventNames, emitArgCounts))
  injected.push(`const emit = defineEmits<EmitsPayloads>()`)
}

// After (JS — 仍 array 形式, 不变)
injected.push(`const emit = defineEmits([${eventNames.map(n => `'${n}'`).join(', ')}])`)
```

## 风险评估

### 风险 1: 重复 emit 事件不同 arg count

```typescript
// Vue 2 允许 (虽然不规范)
this.$emit('update', { id: 1 })
this.$emit('update', { id: 2, value: 'foo' })
// 不同调用 arg count 不同 — TS 接口只能一个
```

**缓解**: 取 max arg count (兼容所有调用)

```typescript
emitArgCounts[name] = Math.max(...(callCounts[name] || []))
```

### 风险 2: dynamic emit event name

```typescript
this.$emit('foo' + bar)  // 字符串拼接
```

**缓解**: 仍用 `any[]` 兜底, 跟现状一致

```typescript
if (!t.isStringLiteral(eventName)) continue
```

### 风险 3: 跟现有 test-define-emits.ts 14 case 冲突

**检查**: iter-046 测试断言 `defineEmits<{...}>()` 出现, 改成 `defineEmits<EmitsPayloads>()` 后老断言可能挂。

**缓解**: 测试断言改成 `defineEmits<EmitsPayloads>()` 或 `EmitsPayloads`, 加新断言 `interface EmitsPayloads { ... }`

## 实施步骤 (3 轮)

| 轮 | 文件 | 动作 |
|----|------|------|
| iter-081 | docs/iter-081-define-emits-plan.md | 本计划 (1 文件) |
| iter-082 | packages/plugins/composition/src/options-to-setup.ts | 实现 emitArgCounts 收集 + interface 生成 (1 文件) |
| iter-083 | packages/plugins/composition/src/__tests__/test-define-emits.ts | 新增 arg count 推断 + interface 生成 case (1 文件) |

## 成功标准

- [ ] iter-082: 改完代码, 0 tsc error, 现有 14 个 define-emits test 全部通过
- [ ] iter-083: 新加 5+ case (单参/双参/零参/重复不同 count/dynamic 兜底) 全部通过
- [ ] iter-083: iter-078 0-regression 重跑, defineProps 45=45 仍正确, store-bridge 等其它 pattern 数字稳定

## 备选 (如时间不够)

- **简化版**: 只生成 `defineEmits<{ eventName: any[] }>()` (现状), 跳过 interface, 跳过 arg count 推断
- **单 arg 版**: 只对 `this.$emit('name', x)` 形式生成 `defineEmits<{ name: [arg1: any] }>()`, 不处理 0/2+ arg

## 关联文档

- [composition plugin README](../packages/plugins/composition/README.md)
- [iter-051-054-bench.md](./iter-051-054-bench.md) — 上一阶段 review 规则沉淀
