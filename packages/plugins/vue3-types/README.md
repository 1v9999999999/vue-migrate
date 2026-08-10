# @vue-migrate/plugin-vue3-types

> TypeScript 类型补全插件（Vue 2 → Vue 3 迁移，P3 / 规则 4.1~4.8）

负责在 Options API 组件上**推断** data / props / $refs / $store / $route 的类型，
并把推断结果落到代码注释或返回类型标注上。

---

## 规则覆盖（MVP）

| 编号 | 规则 | 实现状态 | 输出形式 |
|------|------|----------|----------|
| 4.1 | `data()` 返回值类型推断 | ✅ 完整 | `<script lang="ts">` 加 `: { ... }` 返回类型；其它情况加 JSDoc `@returns` |
| 4.2 | `props: { ... }` 类型推断 | ✅ 完整 | 始终加 JSDoc `@type {{...}}`（因为 Options API 没法转 `defineProps`） |
| 4.3 | `this.xxx` 反查 data/methods 类型 | ⏸ MVP 不做 | — |
| 4.4 | `this.$refs.xxx` | ✅ 识别 + TODO 标记 | TODO 注释 + manualReview |
| 4.5 | `this.$store` | ✅ 识别 + TODO 标记 | TODO 注释 + manualReview |
| 4.6 | `this.$route` | ✅ 识别 + TODO 标记 | TODO 注释 + manualReview |
| 4.7 | JS → TS 类型补全 | ✅（间接） | 通过 JSDoc 注释提供 IDE 类型提示 |
| 4.8 | `propTypes` 校验函数 → TS 联合 | ⏸ MVP 不做 | — |

附加（已实现，未在原规则表里）：
- `this.$router` / `$listeners` / `$children` / `$scopedSlots` → TODO 标记

---

## 安装 & 注册

```jsonc
// packages/cli/package.json
"dependencies": {
  "@vue-migrate/plugin-vue3-types": "workspace:*"
}
```

```ts
// packages/cli/src/index.ts
import '@vue-migrate/plugin-vue3-types'
```

`fileKinds: ['vue', 'ts', 'tsx']` —— **不处理 .js 文件**（没有类型信息可推）。

---

## 工作原理

### 1. data() 推断（规则 4.1）

- 找出所有 `export default { ... }` 的组件对象
- 在里面找 `data` 属性（ObjectMethod 或 ObjectProperty）
- 提取 `return { ... }` 里的 ObjectExpression
- 逐个 Property 推断类型：

| 表达式 | 推断结果 | 置信度 |
|--------|----------|--------|
| NumericLiteral | `number` | 0.9 |
| StringLiteral | `string` | 0.9 |
| BooleanLiteral | `boolean` | 0.9 |
| NullLiteral | `null` | 0.9 |
| RegExpLiteral | `RegExp` | 1.0 |
| TemplateLiteral (无表达式) | `string` | 0.9 |
| ArrayExpression | `T[]`（T = 元素类型 union） | 0.3~0.9 |
| ObjectExpression | 递归推断 inline shape | 0.5~0.9 |
| UnaryExpression `!` | `boolean` | 0.6 |
| ClassExpression / NewExpression | 类名 | 0.6~1.0 |
| Identifier (undefined/Infinity/NaN) | 字面类型 | 0.8~1.0 |
| ArrowFunctionExpression / FunctionExpression | `unknown` | 0.0 |
| 其它 | `any` | 0.3 |

- `TSAsExpression` / `TSTypeAssertion` 自动解包
- 推断结果同时写入 `ctx.project.typeCache`（key: `data.<propName>`），并 `ctx.project.stats.newTypesInferred++`

### 2. props 推断（规则 4.2）

| 写法 | 推断策略 | 置信度 |
|------|----------|--------|
| `name: String` | `string` | 1.0 |
| `age: { type: Number, default: 0 }` | `number`（来自 type 字段） | 1.0 |
| `value: [String, Number]` | `string \| number` | 1.0 |
| `name: SomeCustomClass` | `SomeCustomClass` | 0.6 |
| `{ type: ..., default: () => ({...}) }` | 推断 default 表达式类型 | 0.5~0.8 |

- `required: true` → 必填（`name: T`）；有 `default` → 可选（`name?: T`）
- 推断结果同样写入 typeCache

### 3. Vue3-only 访问器（规则 4.4~4.6）

- 遍历每个 `this.$x` MemberExpression
- 找到所在的 ObjectMethod/Function
- 在该函数上挂一个 JSDoc 风格的 TODO 块，列出**首次**遇到的每个 category
- 同时 `utils.manualReview(...)` 上报每个 category
- 文件级 `markChanged` 用于统计

### 4. typeCache 使用

```ts
// src/utils.ts
project.typeCache.set(filePath, Map<string, InferredType>)
// InferredType = { tsType: t.TSType, jsTypeString: string, confidence: number, reason: string }
```

未来跨文件插件（如 Vuex → Pinia）可以直接读这个缓存。

---

## 输入 / 输出对比

### Case 1：TS 组件 + data

**输入** (`examples/vue2-sample/src/WithTypes.vue`):
```vue
<script lang="ts">
export default {
  data() {
    return {
      count: 0,
      title: 'hello',
      active: true,
      list: [] as number[],
    }
  },
}
</script>
```

**输出**:
```ts
data(): { count: number; title: string; active: boolean; list: any[] } {
  return {
    count: 0,
    title: 'hello',
    active: true,
    list: [] as number[],
  };
}
```

> 注：作为 `as number[]` 在 `[]` 上时，babel 解析的是空数组，无法得知元素类型，所以
> 仍输出 `any[]`。**置信度 0.5** 表示需要人复核。

### Case 2：TS 组件 + props（含 3 种 Vue 2 prop 写法）

**输入**:
```ts
props: {
  name: String,                              // form A
  value: [String, Number],                   // form B
  age: { type: Number, default: 0 },         // form C
  userId: { type: String, required: true },  // form C + required
  options: { type: Object, default: () => ({ debug: false }) },
}
```

**输出**:
```ts
/**
 * vue3-types inferred props shape:
 * @type {{ name: string; value?: string | number; age?: number; userId: string; options?: Record<string, unknown> }}
 * (In Vue3, the recommended equivalent is
 *   const props = defineProps<{ name: string; value?: string | number; age?: number; userId: string; options?: Record<string, unknown> }>()
 *   in <script setup>. For Options API, runtime props are kept as-is.)
 */
props: { ... }
```

### Case 3：JS 组件（`lang="js"` 或没有 lang）

**输入** (`App.vue`):
```vue
<script>
export default {
  data() {
    return { title: 'Vue2 App', count: 0 }
  },
  // ...
}
</script>
```

**输出**:
```js
/**
 * vue3-types inferred data() return type:
 * @returns {{title: string, count: number}}
 */
data() { return { title: 'Vue2 App', count: 0 } }
```

### Case 4：识别 `$refs` / `$store` / `$route` 并标 TODO

**输入**:
```ts
mounted() {
  const _r = this.$refs.foo
  const _s = this.$store.state.user.name
  const _route = this.$route.params.id
}
```

**输出**:
```ts
/**
 * vue3-types TODO:
 *
 *   - $refs ×1: this.$refs.xxx → const xxxRef = ref<InstanceType<typeof Xxx>>(null); in template: <Xxx ref="xxxRef" />
 *   - $store ×1: this.$store → useXxxStore() (Pinia). 依赖 @vue-migrate/plugin-vuex-pinia
 *   - $route ×1: this.$route → useRoute()  (vue-router@4)
 */
mounted() { ... }
```

外加 3 条 `manualReview` 报告项。

### Case 5：复杂 data — 嵌套对象 + 数组 + 字面量混合

**输入**:
```ts
data() {
  return {
    price: 100,
    message: 'hi',
    now: new Date(),
    plain: 'literal',
    profile: { name: 'guest', age: 18 } as { name: string; age: number },
  }
}
```

**输出**（JSDoc 形式）:
```
@returns {{price: number, message: string, now: Date, plain: string, profile: {name: string; age: number}}}
```

> 嵌套对象被递归展开为内联 `{}` shape，元素类型为 `as` 断言时取断言类型（`{name: string; age: number}`）。

---

## 置信度策略

| 来源 | 置信度 | 说明 |
|------|--------|------|
| Vue 2 显式 `type: Number` | 1.0 | 开发者声明 |
| 字面量 `count: 0` | 0.9 | 强类型信号 |
| 数组元素递归推断 | min(各元素置信度) | 0.5 起 |
| 空数组 `[]` | 0.5 | 无元素信息 |
| `as T` 断言 | 取断言类型 + 0.0 | 0.9 |
| 函数 / 标识符无上下文 | 0.0 | 标 `unknown` |
| `new Xxx()` | 0.6 | 类名引用 |

推断结果按**最低 0.5** 保留（低于 0.5 时记 cache 但降级为 `any`）。
开发者可读 `ctx.project.typeCache.get(filePath).get('data.count').confidence` 判断可信度。

---

## 已知限制 / TODO

1. **类型脚本文件（.ts / .tsx）不能加 `: T` 返回类型** —— 因为 core 的 `selfCheck` 用纯
   babel parser（不带 typescript plugin），会失败。已自动回退到 JSDoc 注释。
2. **`this.xxx` 跨方法体反查类型**（规则 4.3）未实现 —— 需要更重的程序分析，超出 MVP 范围。
3. **`propTypes` 校验函数 → 联合类型**（规则 4.8）未实现。
4. **自动转 `defineComponent<...>({...})`** 没做 —— Vue 3 的 `defineComponent` 泛型太特定，
   与 Options API 的多 property 模式不匹配。当前保守策略是**保留 Options API** + 加注解。
5. **不修改 .js 文件** —— 没有类型信号，处理了反而误导。

---

## 「需要 core 调整」清单

1. **`selfCheck` 应该按文件 kind 启用对应 babel plugin**
   - 现状：`parseBabelForCheck(output, { sourceType: 'module' })` —— 不含 typescript
   - 期望：vue/ts/tsx 文件用包含 typescript plugin 的 parser
   - 影响：本插件只能在 .vue + `<script lang="ts">` 里加 `: T` 注解；.ts/.tsx 只能用 JSDoc

2. **`TransformUtils.markChanged` 的类型签名过时**
   - 现状：`types.ts` 写的是 `markChanged(): void`
   - 实际：`context.ts` 实现了 `markChanged(msg?: string)`，orchestrator 依赖 message
   - 影响：插件里调用 `markChanged(msg)` 需要 `as any` 转一下

3. **`MigrationStats.manualReviewRequired` 未在 orchestrator 中更新**
   - 现状：orchestrator 只从 `t.error` 派生
   - 实际：`utils.manualReview` 内部已经 `project.stats.manualReviewRequired++`，
     但最后 `ctx.stats.manualReviewRequired = reviewItems.filter(...).length` 又覆盖了
   - 影响：报告中 "需人工" 数字永远是 0（即便有 manualReview 项）

4. **`@babel/traverse` 缺少 .d.ts**
   - 需要 `pnpm add -D @types/babel__traverse`，或在插件里继续用 `@ts-ignore`
