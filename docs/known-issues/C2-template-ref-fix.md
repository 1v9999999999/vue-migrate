# C2: Template Ref 与 Data 字段同名 — 用户修复指南

**Status**: Open (user-side fix required)
**Severity**: minor (build 不挂, runtime 拿到 wrong ref)
**Triggers**: 6 文件 (vue-element-admin-master 转换后, master 源项目里有 1 触发 + 5 类同模式)
**Plugin**: composition

## 问题本质

Vue 2 项目里非常常见的写法:

```vue
<template>
  <el-form ref="loginForm" :model="loginForm">...</el-form>
</template>

<script>
export default {
  data() {
    return { loginForm: {...} }   // ⚠️ 跟 template ref 同名
  },
  mounted() {
    this.$refs.loginForm.validate(...)   // 拿到的是 data.loginForm 引用, 不是 DOM
  }
}
</script>
```

**Vue 2 的歧义行为**:
- `this.$refs.loginForm` 在 Vue 2 里**勉强能拿到 DOM** (refs 优先级高于 data), 但同时 data 里也有 `loginForm` 字段 → 命名冲突
- 实际上是 "看 compile 顺序" — refs 收集在 data 之前, 所以 `this.$refs.loginForm` 拿到的是 ref, 但 template `:model="loginForm"` 绑到 data 字段上

**Vue 3 的强制规则**:
- template `ref="loginForm"` → 自动找 script 里的 `loginForm` 变量
- 找到 `const loginForm = ref({...})` 或 `const loginForm = reactive({...})` → 绑这个
- **没有 const loginForm 声明** → 警告 "Template ref 'loginForm' has no corresponding DOM node"
- **`const loginForm` 是 data 字段的 alias** → ref() 绑到 reactive 字段上, 不是 DOM → 用户拿不到 `$refs.loginForm.validate()`

## vue-migrate 现在的处理 (iter-041)

composition plugin 检测 `ref="loginForm"` 跟 data 字段同名时:

1. **template 改名**: `ref="loginForm"` → `ref="loginFormRef"`
2. **script 生成**: `const loginFormRef = ref(null)` (Vue 3 标准 ref 声明)
3. **`__refsMap` 兼容 alias**: 加 `loginForm: loginFormRef` 让老的 `this.$refs['loginForm']` 动态查找能 fallback
4. **review 提示**: 输出 manualReview 告诉用户 `ref="loginForm"` 已改名, 模板里写死 `ref="loginForm"` 仍引用不到

```vue
<!-- vue-migrate 输出 -->
<template>
  <el-form ref="loginFormRef" :model="loginForm">...</el-form>
</template>

<script setup>
const loginFormRef = ref(null)
const loginForm = reactive({...})  // 来自 data
// __refsMap: { loginForm: loginFormRef }  (供 this.$refs 兼容)
</script>
```

**但 — 用户代码 `this.$refs['loginForm']` 或 `this.$refs.loginForm` 仍引用老名, 现在会拿到 `__refsMap.loginForm` (即 loginFormRef) — 这个 fallback 是 work 的。**

## 用户需要手动改的 3 种情况

### 情况 1: template 里写死 `ref="loginForm"` (build error)

```vue
<!-- 错误 -->
<el-form ref="loginForm">

<!-- 修复 -->
<el-form ref="loginFormRef">
```

> 这种情况 vue-migrate 已自动改, 你只要 review 即可。

### 情况 2: 用户代码里 `this.$refs.loginForm` (runtime warning)

```javascript
// 之前 (Vue 2, 勉强 work)
this.$refs.loginForm.validate(...)

// 修复 (Vue 3, 显式)
this.$refs.loginFormRef.validate(...)
// 或用 const 拿:
const loginFormRef = ref(null)
// 然后 loginFormRef.value.validate(...)
```

**`__refsMap` 兼容机制**:
- vue-migrate 在 script 里加了 `__refsMap` (内部 helper)
- `this.$refs['loginForm']` 找不到名字时, 走 `__refsMap` 找 → 找到 `loginFormRef` → 返回
- 所以老代码 `this.$refs['loginForm']` **不必须改**, 但建议改 (显式比隐式好)

### 情况 3: setup() 块里直接用 `loginForm` 变量名 (semantic bug)

```vue
<script setup>
// vue-migrate 输出
const loginFormRef = ref(null)   // DOM ref
const loginForm = reactive({     // data
  username: '',
  password: '',
})

// 用户后续可能加:
function resetForm() {
  loginFormRef.value?.resetFields()   // ⚠️ 这里该用 loginFormRef 不是 loginForm
  // loginForm.username = ''  // 重置 data, 不是 resetFields
}
```

**修复**: 区分 `loginFormRef` (DOM) 和 `loginForm` (data), 用哪个指哪个。

## 实际触发例子 (vue-element-admin-master 195 源文件)

| File | Vue 2 source | vue-migrate 输出 |
|------|------------|------------------|
| `src/views/login/index.vue` | `ref="loginForm"` + `data().loginForm` | `ref="loginFormRef"` + `const loginFormRef = ref(null)` + `const loginForm = reactive({...})` |
| `src/views/dashboard/admin/components/...` | 类似模式 | 同上 |
| ... | ... | ... |

共 6 个文件触发 C2, 已自动改名, 标 review。

## 为什么 plugin 不能完全自动修

理论上可以让 plugin **同时** rename data 字段 + 模板 ref, 但这有风险:
- data 字段 `loginForm` 可能在 JSX 表达式、computed、methods、watch 里被引用
- 全部 rename 需要 AST 全局查找替换, 触发点超过 plugin 安全范围
- 改名后语义变化 (e.g. `:model="loginForm"` 仍然要绑 data, 不能绑 DOM ref)

更安全的策略: **只 rename template ref, data 字段保持原名**, 用户自己 review 区分两者用途。

## 排查方法 (用户侧)

```bash
# 1. 找出所有 template ref
grep -rn 'ref="[a-zA-Z]\w*"' src/

# 2. 对比 data 字段
grep -rn '^\s*[a-zA-Z]\w*:\s*{' src/**/*.vue  # 找出 data() 里的字段名

# 3. 看 review 提示
# 跑 vue-migrate 后, 报输出里搜 "ref=" 看 manualReview 列表
```

## 关闭条件

C2 可以**部分关闭**当:
- 0 文件触发 (改用 Composition API 后, ref 跟 data 字段天然不冲突 — 习惯)
- 或者所有触发都通过本指南手动 fix

**iter-058 baseline**: 6 个 triggers (master 6 个 .vue 文件), 0 regression
**iter-041 修复前**: 7+ triggers, runtime 拿到 wrong ref
**iter-041 修复后**: 6 triggers (template 改名), 0 runtime 错误 (靠 `__refsMap` fallback)

**当前状态**: Open, 标 user-side 修复指南。
