# @vue-migrate/plugin-ts-decorator

> iter-119: Convert TypeScript class-based Vue 2 components (vue-property-decorator + vue-class-component + vuex-class) to Vue 3 `<script setup>` form.

---

## 背景

The `composition` plugin only handles Options API (`export default { ... }`).
TypeScript class-based components using `@Component`, `@Prop`, `@State`, etc.
are skipped, leaving the user with a Vue 2 class that breaks on Vue 3.

This plugin runs **before** the `composition` plugin (priority 1, vs 0 for
composition), detects class-based components via `@Component` decorator or
`class X extends Vue` form, and rewrites the file to `<script setup>` form.
The `composition` plugin then sees `<script setup>` and bails out (it only
injects `defineProps` / `defineEmits` if missing — iter-046).

---

## 规则覆盖

| 编号 | 规则 | 实现状态 | 输出形式 |
|------|------|----------|----------|
| 1 | `@Component` (vue-class-component) — 组件注册 | ✅ | 删除 (script setup 无需) |
| 2 | `@Prop({...})` (vue-property-decorator) | ✅ | `const props = defineProps({ name: { default: '' } })` |
| 3 | `@Watch('key')` | ✅ | `watch(key, (newVal, oldVal) => { ... })` |
| 4 | `@Emit('event')` | ⚠ review | emit + 重新触发, 需手改 |
| 5 | `@State('user')` (vuex-class) | ✅ | `const user = computed(() => useStore().state.user)` |
| 6 | `@Getter('token')` (vuex-class) | ✅ | `const token = computed(() => useStore().getters.token)` |
| 7 | `@Action('login')` (vuex-class) | ✅ | `const login = (payload) => useStore().dispatch('login', payload)` |
| 8 | `@State('module', 'key')` (2-arg) | ✅ | `const x = computed(() => useStore().state.module.key)` |
| 9 | `@State(namespace)` (1-arg namespace) | ⚠ review | 需手拆: `const { a, b } = useStore().state.mod` |
| 10 | `@Provide` / `@Inject` | ⚠ review | 需手拆: `provide()` / `inject()` in setup |
| 11 | `@Ref` | ⏸ TODO | — |
| 12 | `@Component({ components: {...} })` | ⚠ review | 组件注册, 需手 import + 引用 |
| 13 | `@Component({ mixins: [...] })` | ⚠ review | 建议改 composable |
| 14 | class field `count = 0` | ✅ | `const count = ref(0)` |
| 15 | class field `name: string = ''` | ✅ | `const name = ref<string>('')` |
| 16 | getter method `get double() { ... }` | ✅ | `const double = computed(() => { ... })` |
| 17 | 生命周期方法 (`mounted()`, `beforeDestroy()`) | ✅ | `onMounted(() => { ... })`, `onBeforeUnmount(...)` |
| 18 | 普通方法 `inc() { this.count++ }` | ✅ | `function inc() { count.value++ }` |
| 19 | `this.count` (data field) | ✅ | `count.value` |
| 20 | `this.user` (@State/@Getter) | ✅ | `user` (already a computed) |
| 21 | `this.login` (@Action) | ✅ | `login` (already a function) |
| 22 | `this.name` (@Prop) | ✅ | `props.name` |
| 23 | `this.inc` (method) | ✅ | `inc` |
| 24 | `this.$route` / `$router` | ✅ | `route` / `router` (useRoute/useRouter) |
| 25 | `this.$store` | ✅ | `store` (useStore) — only if needed |
| 26 | `this.$nextTick` | ✅ | `nextTick` |
| 27 | `this.$emit` | ⚠ review | `emit` — 需先 defineEmits |
| 28 | `this.$refs` / `$attrs` / `$slots` | ⏸ TODO | 部分支持 |
| 29 | `this.$message` / `$notify` / `$msgbox` | ✅ | `ElMessage` / `ElNotification` / `ElMessageBox` |
| 30 | `this.$on` / `$off` / `$once` / `$bus` | ⚠ review | Vue 3 移除, 建议 mitt |
| 31 | `this.$forceUpdate` / `$destroy` / `$set` / `$delete` | ⚠ review | Vue 3 移除 |
| 32 | `this.$children` / `$parent` / `$root` / `$vnode` | ⚠ review | Vue 3 移除 / 改变 |
| 33 | `this.$isServer` / `$isDestroyed` | ⚠ review | 用 import.meta.env.SSR / composable |
| 34 | constructor method | ⚠ review | 改 setup 顶层初始化代码 |
| 35 | `extends mixins(X, Y)` | ⏸ TODO | mixin 成员需手拆 |
| 36 | complex inherit chains | ⏸ TODO | 需人工 |

附加 (已实现):
- 移除 class field / method / lifecycle 后的 `@Component` decorator + class wrapper
- 自动补 import (ref, reactive, computed, watch, onMounted, etc. from 'vue')
- 保留 user imports (e.g. `import { ... } from 'vuex-class'`)
- `<script setup lang="ts">` 输出
- `.ts` / `.tsx` / `.vue` 文件都支持

---

## 输入 / 输出对比

### Case 1：基础 class + @Prop

**输入** (`DecoratorComp.ts`):
```ts
import { Vue, Component, Prop } from 'vue-property-decorator'

@Component
export default class MyComp extends Vue {
  @Prop({ default: '' }) name!: string
}
```

**输出**:
```vue
<script setup lang="ts">
const props = defineProps({ name: { default: '' } })
</script>
```

### Case 2：vuex-class + lifecycle + class fields

**输入** (`TypeScriptComp.vue`):
```vue
<script lang="ts">
import { Vue, Component, Prop } from 'vue-property-decorator'
import { State, Action } from 'vuex-class'

@Component
export default class MyComp extends Vue {
  @Prop({ type: String, required: true }) readonly title!: string
  @State('user') user!: any
  @Action('login') login!: (p: any) => Promise<any>
  count = 0
  get double() { return this.count * 2 }
  mounted() { this.$nextTick(() => console.log('m')) }
  add(n: number) { this.count += n }
}
</script>
```

**输出**:
```vue
<script setup lang="ts">
import { computed, defineProps, nextTick, onMounted, ref } from 'vue'
import { useStore } from 'vuex'

const props = defineProps({ title: { type: String, required: true } })
const user = computed(() => useStore().state['user'])
const login = (payload) => useStore().dispatch('login', payload)
const count = ref(0)
const double = computed(() => { return count.value * 2 })
onMounted(() => { nextTick(() => console.log('m')) })
function add(n) { count.value += n }
</script>
```

---

## 工作原理

### 1. 检测 (transform hook)

Plugin 在 `transform` hook 中:
1. 跳过被 `__skipped` 标记的文件 (iter-118 Nuxt 特殊函数)
2. 用 `@babel/parser` + `typescript` + `decorators-legacy` + `classProperties` 解析
3. 找 `ExportDefaultDeclaration` → `ClassDeclaration` / `ClassExpression`
4. 调 `convertClassComponentToSetup(classNode, scriptInner, isTs)`

### 2. 转换 (class-to-setup.ts)

1. 遍历 class body:
   - `ClassProperty` / `PropertyDefinition` → field
   - `ClassMethod` / `MethodDefinition` → method
2. 提取每个 member 的 decorator:
   - `@Prop` → propNames / propEntries
   - `@State` → stateNames
   - `@Getter` → getterNames
   - `@Action` → actionNames
   - `@Watch` (on method) → watch handler
   - `@Emit` (on method) → emit handler
3. 识别 lifecycle (mounted / beforeDestroy 等) → onMounted / onBeforeUnmount
4. 生成 setup code:
   - `defineProps({ ... })` from @Prop
   - `import { useStore } from 'vuex'` (if needed)
   - `computed(() => useStore().state['key'])` from @State
   - `computed(() => useStore().getters['key'])` from @Getter
   - `(payload) => useStore().dispatch('key', payload)` from @Action
   - `ref<T>(init)` from class field
   - `computed(() => ...)` from getter method
   - `onXxx(() => ...)` from lifecycle
   - `function ...` from regular method
   - `watch(source, cb, opts)` from @Watch
5. `this.xxx` 在 method / lifecycle body 内重写:
   - `this.field` → `field.value`
   - `this.method` → `method`
   - `this.prop` → `props.prop`
   - `this.$route` → `route` (if useRoute imported)
   - 等等

### 3. 输出 (build new script)

- 保留 user imports (去除重复)
- 加 `import { useStore } from 'vuex'` (if needed)
- 加 `import { ... } from 'vue'` (ref, computed, watch, onMounted, etc.)
- 输出 setup code
- 包 `<script setup lang="ts">` (for .vue) 或直接替换 (for .ts/.tsx)

### 4. 同步 sfc

对 .vue 文件, 更新 `file.sfc.script` 的 loc + attrs.setup = true。

---

## 限制 / TODO

1. **核心 selfCheck parser 不带 TS plugin** —— 输出若有 TS 类型, selfCheck 会失败。
   解决: `stripTypeAnnotations()` 移除 @Watch callback / method params 的 TS 类型, 输出为纯 JS。
2. **`.tsx` 文件** — babel parse 需要 'jsx' plugin (其他 iter 加的, see index.ts comment)。
3. **`@Component({ components: {...} })`** — 需手 import + 引用。
4. **`@Emit` decorator** — emit 重新触发的语义, 需手改方法体。
5. **`@Provide` / `@Inject`** — 需手改为 `provide()` / `inject()` composable。
6. **`extends mixins(X, Y)`** — mixin 成员需手拆为 composable。
7. **constructor method** — Vue 3 + script setup 不支持, 改 setup 顶层初始化。

---

## 已知问题

1. `@State('app', 'count')` 输出 `useStore().state.app.count` (dot path) — vuex 实际接受
   数组 path (`['app.count']` 或 `app.count`), 都是合法的。
2. `this.$emit` 自动加 `defineEmits([...])`, 但事件名是空的 (因为我们不知道用户想 emit
   什么) — 需手补。
3. `this.$attrs` / `$slots` — 在 script setup 直接可用, 我们的重写会保留 `this.$attrs`
   改为 `$attrs` (去 this. 前缀), 行为正确。

---

## 置信度策略

无明确置信度机制 — TS class decorator 是结构化的, 转换是确定性的。
所有 review 项是显式标 manualReview, 用户必须手改。

---

## 优先级

`priority: 1` (在 composition 0 之前跑)
- composition 看到 `<script setup>` 就 bails out (走 iter-046 的 defineProps/defineEmits 注入)
- 如果我们的转换出错 (e.g. 不识别的 decorator), file 不动, 后续 plugin 继续处理
