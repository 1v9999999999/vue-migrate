# @vue-migrate/plugin-composition

把 Vue2 Options API 风格的组件转换为 Vue3 `<script setup>` 风格。

## 实现的规则

| 编号 | 规则 | 状态 |
|------|------|------|
| C.1 | `data() {...}` → `const x = ref<T>(...)/reactive<T>(...)` | ✅ 类型推断: bool/num/string/array/object/Date/RegExp |
| C.2 | `props: {...}` → `const props = defineProps<{...}>()` | ✅ |
| C.3 | `methods: {...}` → 普通 `function` | ✅ |
| C.4 | `computed: {...}` → `computed(() => ...)` | ✅ |
| C.5 | `watch: {...}` → `watch(() => key, cb, opts)` | ✅ 支持 deep/immediate/handler form |
| C.6 | 生命周期 → `onMounted/onBeforeUnmount/...` | ✅ |
| C.7 | `<script setup>` 标志 | ✅ |
| C.8 | 自动补 import (ref/reactive/computed/watch/...) | ✅ |
| C.9 | `this.dataName` → `dataName.value`（ref）或 `dataName`（reactive） | ✅ |
| C.10 | `this.$refs.xxx` → `xxxRef.value` (含 ref 重命名 `xxx → xxxRef`) | ✅ |
| C.11 | `this.$refs[xxx]` → `__refsMap[xxx].value` | ✅ |
| C.12 | `this.$store` → `store` (useStore) | ✅ |
| C.13 | `this.$route/$router` → `route/router` (useRoute/useRouter) | ✅ |
| C.14 | `this.$emit` → `emit` (defineEmits) | ✅ |
| C.15 | `this.$nextTick` → `nextTick` | ✅ |
| C.16 | `this.$message/$notify/$msgbox/$loading` → ElMessage/ElNotification/ElMessageBox/ElLoading | ✅ |
| C.17 | `this.$attrs` → `$attrs` (Vue3 合并了 $listeners) | ✅ |
| C.18 | `this.$slots/$scopedSlots` → `$slots` | ✅ |
| C.19 | `this.$children` → undefined + review | ✅ Vue3 移除 |
| C.20 | `this.$on/$off/$once/$bus` → undefined + review (建议 mitt) | ✅ Vue3 移除 |
| C.21 | `this.$el/$forceUpdate/$destroy/$set/$delete` → undefined + review | ✅ Vue3 移除/改变 |
| C.22 | `this.$watch(string, fn[, opts])` → `watch(() => key.value, fn[, opts])` | ✅ 用平衡括号扫描, 避免误匹配 |
| C.23 | `this.xxx = expr` (reactive 字段) → `xxx.splice(0, xxx.length, ...expr)` | ✅ |
| C.24 | `this.xxx` (prop) → `props.xxx` | ✅ |
| C.25 | 自由变量 `chart/myChart/chartInstance/editor/monaco` → `const xxx = ref<any>(null)` | ✅ 智能 ECharts/3rd-party 模式 |
| C.26 | 自由变量 (其它) → `let xxx: any` + review | ✅ |
| C.27 | 嵌套组件 `const X = Vue.extend({...})` → `const X = defineComponent({...})` | ✅ |
| C.28 | `export default Vue.extend({...})` / `defineComponent({...})` → 走相同转换流程 | ✅ |

## 标 review（不自动改）

- `components / filters / mixins` 复杂场景
- `provide/inject`
- `render(h) {...}` 函数 — Vue3 签名变了
- 异步组件 `() => import('./Async.vue')`
- `inheritAttrs: false` → 需要 `useAttrs()`

## 策略

字符串级别转换（不走 AST serialize 函数体）：

1. 在 `file.source` 里找 `export default { ... }` 段 (或 Vue.extend/defineComponent 包装)
2. 用 brace-matching 解析各 section 的范围
3. regex 提取字段（data/props/methods/computed/watch/lifecycle）
4. 跳过关键字（if/while/for/switch/return...）以免误判
5. 拼接成 setup 代码
6. **直接覆盖** `file.source` 的 script 块
7. 设置 `file.useRawSource = true` 让 codegen 用 file.source 输出
8. post-process: 替换 script 里的 `Vue.extend(` → `defineComponent(` (嵌套组件)
9. post-process: 替换 template 里的 `$route/$router/$store/$emit/$listeners/$scopedSlots` 为 setup 暴露的别名

## 输入/输出示例

### 输入

```vue
<script>
export default {
  props: { name: String, age: { type: Number, default: 0 } },
  data() {
    return {
      count: 0,
      user: { name: 'foo' }
    }
  },
  computed: {
    double() { return this.count * 2 }
  },
  methods: {
    inc() { this.count++ },
    greet() { return this.user.name }
  },
  mounted() {
    console.log('mounted')
  }
}
</script>
```

### 输出

```vue
<script setup>
import { computed, defineProps, onMounted, reactive, ref } from 'vue'

const props = defineProps<{
  name?: string;
  age?: number;
}>()

const count = ref<number>(0)
const user = reactive<object>({ name: 'foo' })

const double = computed(() => count.value * 2)

function inc() {
  count.value++
}

function greet() {
  return user.name
}

onMounted(() => {
  console.log('mounted')
})
</script>
```

## 已知限制

- 复杂的嵌套 callback / async function 里的 `this` 需要人工确认
- nested data object 的 keys 在多行情况下解析可能不完美
- render 函数 / 异步组件 / provide-inject 暂不处理
- 嵌套在 setup 内调用的 `this.$watch` 第一个参数是变量（非字符串）的情况，转换会留 TODO 标记

## 优先级

`priority: 0`（最早跑），让其他 plugin 先改完 AST。
Composition 之后 codegen 用 `file.useRawSource` 直接输出 file.source，不重新走 AST。
