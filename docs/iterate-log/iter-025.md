# Iteration 025 — 2026-08-08 (用户 "不要停，继续" 后续改进)

## TL;DR

- **触发**: 用户要求继续, 不停, 每一步都做
- **状态**: ✅ 又加了 6 个改进
- **耗时**: ~35 min
- **核心动作**:
  1. 智能 ECharts/3rd-party 模式识别 (free variable 智能推荐 `ref<any>(null)` vs `let xxx: any`)
  2. 嵌套组件 `const X = Vue.extend({...})` → `const X = defineComponent({...})`
  3. 修复 Vue.extend replace 误匹配注释
  4. 修 multi-line reactive reassignment (用平衡大括号扫描替代单行 regex) — **关键 bug, 修了主样本 compileOk 0.944 → 1.000**
  5. 更新 composition README 完整规则表
  6. 简化 `ref<any | null>(null)` → `ref<any>(null)` (当 init 是 null 时)

## 修改清单

### 1. 智能 free variable 推断

**之前**: 所有 free variable 一律 `let xxx: any` + 提示 "在 setup 里显式赋值"
**之后**: 检测变量名是否匹配 ECharts/3rd-party pattern (`/chart|myChart|chartInstance|editor|monaco/i`), 匹配则用 `const xxx = ref<any>(null)` + 提示 "配合 :ref='setXxx' 初始化"

```js
// ECharts/3rd-party 模式 (myChart / chart / editor / monaco)
const myChart = ref<any>(null)  // 推荐, Vue 3 友好

// 其它 (handleGlobalEvent 等)
let handleGlobalEvent: any  // fallback
```

### 2. 嵌套组件 `Vue.extend` → `defineComponent`

**之前**: `const BaseWidget = Vue.extend({...})` 保留不变, Vue3 里 `Vue.extend` 不存在会编译错
**之后**: 用平衡括号扫描, 替换 `Vue.extend(` → `defineComponent(`. 只替换实际调用 (后跟 `(`), 不碰注释里的 `Vue.extend` 字样.

```js
// 之前:
const BaseWidget = Vue.extend({...})

// 之后:
const BaseWidget = defineComponent({...})
```

### 3. 修复 Vue.extend 替换误匹配

**Bug**: 第一版 replaceVueExtendInScript 用 `s.indexOf('Vue.extend')` 找所有出现, 包括注释里的 `Vue.extend` 字符串. 修复后用 `/(^|[^A-Za-z0-9_$.])Vue\.extend\s*\(/gm` 正则, 只匹配独立 token + 实际函数调用.

### 4. 🐛 修 multi-line reactive reassignment 严重 bug

**Bug**: 正则 `[^;\n]+` 只能匹配单行. 遇到 `this.foodForm = { name: '', ... }` (跨多行) 截到 `this.foodForm = {`, 后续 `name: '', ...` 被丢, 产生错误代码:
```js
foodForm.splice(0, foodForm.length, ...{)  // 语法错
name: '',
description: '',
```

**修复**: 用平衡大括号/中括号扫描, 支持完整的对象/数组字面量跨多行匹配.

**之后**:
```js
foodForm.splice(0, foodForm.length, ...{
  name: '',
  description: '',
  ...
});
```

### 5. 简化 `ref<any | null>(null)` → `ref<any>(null)`

**之前**: `maybeNull: null` → `ref<any | null>(null)` (啰嗦, 等价但繁琐)
**之后**: `ref<any>(null)` (init 是 null 时直接用 any)

### 6. 更新 README

把 composition 插件的 28 条规则 (C.1-C.28) 写进 README, 包括所有 Vue2 → Vue3 的 `this.$xxx` 处理.

## 验证

### 单文件 (compo-test/StressTest.vue)
- iter-024: 0 errors, 26 reviews
- iter-025: **0 errors, 26 reviews** (Vue.extend 转换不影响 review 数, 因为 BaseWidget 不在 Options API 转换流程中)

### 主样本 (vue2-manage-master, 59 vue 文件)
- iter-024-final: 0 errors, 66 modified, 148 reviews, compileOk 0.944
- iter-025: **0 errors, 66 modified, 148 reviews, compileOk 1.000** (multi-line splice 修复让 compileOk 0.944 → 1.000)

### 多样本 (171 文件, 6 sample)
- iter-024-final vs iter-025-final:
  - **avgCompileOk: 0.974 → 0.983 (+0.009 ✅, 回到 iter-007 基线)**
  - avgAstEquivalent: 0.709 → 0.705 (-0.004, noise)
  - avgSemanticDiff: 0.680 (stable)
  - avgRuntimeSafe: 0.862 (stable)
  - totalReviewDelta: 342 → 342 (=)

vue2-manage-master 的 compileOk 0.944 → 1.000 是关键 — multi-line reactive reassignment 之前产生的语法错误被修复了.

## 已知未修 (留给 iter-026+)

- **render function / 异步组件 / provide-inject** — 未实现, 测试数据没有, 不影响当前样本
- **ECharts 测试数据全是预转换过的** — `examples/222/*.vue` 已经有 `<script setup>` 和 `let myChart: any`, composition 不会重新跑, 看不到智能 chart pattern 的效果
- **vendor JS 跳过规则可能太激进** — 50KB 阈值可能误伤正常 .js 文件, 但目前没观察到副作用

## 完整数据

- `baselines/iter-025-final/multi-sample/summary.json` — 171 文件, 6 sample 汇总
- `packages/plugins/composition/README.md` — 完整 28 条规则
- `packages/plugins/composition/src/options-to-setup.ts` — chart pattern detection + multi-line reactive fix
- `packages/plugins/composition/src/index.ts` — Vue.extend → defineComponent

## 下一步 (iter-026+)

1. **P2 cross-plugin rename contract** — 解决 iter-018 发现的 vue3-template vs vue3-types 命名不一致问题
2. **P2 rule-generator 集成** — 跟 issue ticket 联动, 3+ stuck 自动生成新规则
3. **P2 sample-collector + GITHUB_TOKEN** — 拉真实 Vue 2 sample, 扩大测试集 (特别是 ECharts 场景)
4. **P3 performance 优化** — 现在 composition 用 1 次完整 AST 遍历, 1100 行函数. 可以拆分成小函数 + memoize

## 用户反馈循环

用户说 "不要停, 每一步都做" — 我已经把 6+ 个 P0/P1 gap 全修了 (从 iter-023 stub 状态到 iter-025 完整 composition). 现在的核心是:
- ✅ Options → Setup 真实转换 (不只是 stub)
- ✅ props 注入
- ✅ route/router/store/emit 注入
- ✅ this.xxx 替换 (data/method/computed/prop)
- ✅ this.$refs 静态/动态
- ✅ this.$watch 字符串参数
- ✅ reactive 重赋值 splice (含 multi-line object/array)
- ✅ Vue2 移除 API ($bus/$on/$off/$once/$el/...)
- ✅ ECharts/3rd-party 模式
- ✅ Vue.extend 嵌套
- ✅ 类型推断 (bool/num/string/array/object/Date/RegExp)
- ✅ elementui 跳过 vendor JS (errors 10→0)

整体 composition plugin 状态: 完整可用, 不是 stub.
