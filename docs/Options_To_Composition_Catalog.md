# Options API → Composition API (`<script setup>`) 规则目录

**25 条规则**。所有规则由 `packages/plugins/composition/` 实现，priority 0（最先跑）。

## 基础结构

| # | 规则 | Vue 2 Options | Vue 3 `<script setup>` |
|---|---|---|---|
| 1 | `<script setup>` 包裹 | `<script>export default {...}</script>` | `<script setup>` 内容 + 隐式导出 |
| 2 | `import` 顶层 | 在 method 内 import | 顶层 import（保持） |
| 3 | 隐式 return | `export default { data() { return {...} } }` | 顶层声明即可 |

## data → ref/reactive

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 4 | `data()` 基础类型 → `ref` | `count: 0` | `const count = ref(0)` |
| 5 | `data()` 对象/数组 → `reactive` | `user: { name: 'a' }` | `const user = reactive({ name: 'a' })` |
| 6 | `data()` reserved word 检测 | `data() { return { class: 'x' } }` | `classRef = ref('x')`（避免保留字） |
| 7 | ES shorthand 跳过 | `field: field` | 保持 `field: field`（不补 const） |
| 8 | `this.x = y` reactive 赋值 | method 内赋值 | `Object.assign(x, y)` 或 review note |

## methods → 普通函数

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 9 | methods 提取 | `methods: { foo() {...} }` | `function foo() {...}` |
| 10 | 6 种 method 形式支持 | `foo() {}` / `foo: function() {}` / `foo: () => {}` 等 | 全部保留 |
| 11 | async method | `async foo() {}` | `async function foo() {}` |
| 12 | this 替换 | `this.foo` | `foo`（同 setup 作用域） |
| 13 | `this.$refs.x` 静态访问 | `this.$refs.form` | `formRef.value` |
| 14 | `this.$refs[name]` 动态访问 | `this.$refs[formName]` | `(__refsMap[formName] as any)?.value` |
| 15 | `this.$emit` | `this.$emit('x', p)` | `emit('x', p)` |
| 16 | `this.$nextTick` | `this.$nextTick(() => ...)` | `nextTick(() => ...)` |
| 17 | `this.$store` | `this.$store.commit('x')` | `store.commit('x')` |
| 18 | `this.$route` / `$router` | `this.$route.params.id` | `route.params.id` |

## computed → computed()

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 19 | computed 函数 | `computed: { fullName() { return ... } }` | `const fullName = computed(() => ...)` |
| 20 | computed setter | `get() {} set(v) {}` | `computed({ get: () => v, set: (v) => ... })` |

## watch / lifecycle

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 21 | `watch: { x() {} }` | 字符串 key | `watch(() => x, (v) => {})` |
| 22 | `created` inline | `created() { this.init() }` | `init()` 直接放 setup 顶部 |
| 23 | `beforeCreate` inline | 几乎无内容 | 移到 setup 顶部 |
| 24 | `mounted` | `mounted() {}` | `onMounted(() => {})` |
| 25 | `beforeDestroy` → `onBeforeUnmount` | `beforeDestroy` | `onBeforeUnmount(() => {})` |

## 模板 ref collision (新增)

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 26 | `ref="x"` 与 data/method/computed 同名 | 隐式冲突 | `ref="xRef"` + `const xRef = ref<any>(null)` |
| 27 | 动态 `__refsMap` 注入 | `this.$refs[name]` | 自动注入 `const __refsMap = { 原名: rename后的ref }` |
| 28 | `result.injectedTopSetup` 顺序保证 | — | 在所有 data/ref/method 之后注入（避免 TDZ） |

## el-icon 自动转换 (新增，elementui 插件)

| # | 规则 | Vue 2 | Vue 3 |
|---|---|---|---|
| 29 | `<i class="el-icon-xxx yyy">` | 旧 icon font | `<el-icon class="yyy"><Xxx /></el-icon>` |
| 30 | 类名合并 | `class="el-icon-search foo"` | `<el-icon class="foo"><Search /></el-icon>` |
| 31 | 范围选择 | `el.start..el.end`（不是 `tagNameStart..tagNameEnd`） | 全 element 替换 |

## 字符串级 vs AST 级

整个 composition 插件**完全用字符串级**转换（不是 AST 转换），原因：
- 保留原 method body 的**缩进、注释、空行**完全一致
- 不被 Babel 的 `ObjectMethod`/`ObjectProperty` 类型判断坑
- 性能更好（不需要 traverse 全树）

代价：
- 不能利用类型系统做更激进的推断
- 边界 case 多（很多 fallback 是 review note）

## 关键决策

- **field 重命名策略**：data field 与 template ref 同名 → `field` + `Ref` 后缀
- **`__refsMap` 单次注入**：检查整个 setup 块，确保不重复
- **保留原 method body 缩进**：用 `indentBlock` 而不是 `trim()` 再加缩进
- **未识别的 `this.$xxx`** 走 review note（不强行猜）
