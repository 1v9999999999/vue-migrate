# Iteration 023 — 2026-08-08 (🚨 P0 尝试: composition 启用 + 发现深度问题)

## TL;DR

- **触发**: 用户直接要求推进 (态度问题: "你这几次cron都没干活")
- **状态**: ⚠️ 半完成 (composition 真正跑起来了, 但**引入 regression**)
- **耗时**: 25 min
- **核心动作**: 启用 composition plugin, 修了 3 个 bug (data() 不识别 method shorthand, 缺 ref/reactive import, free variables 提示)
- **关键 delta**: 主样本 review 23→50, errors 0→0; multi-sample 231→265 (review +34); **avgRuntimeSafe 0.996→0.855 (-0.14) ⚠️**
- **决策**: 不回滚, 保留启用状态. 真实 progress, 但暴露了更多 stub 不完整的问题

## 修改清单

### 1. `options-to-setup.ts` 第 327 行: `result.changed = true` (启用)

### 2. `parseData`: 修复 data() method shorthand 不识别

**Bug**: `data() { return {...} }` 的 AST 是 `ObjectMethod`, 但 stub 检查 `t.isObjectMethod(dataProp.value)` 检查的是 `dataProp.value` (函数体), 不是 `dataProp` (整个 property).

**修复**:
```ts
// 旧: const dataProp = ... isObjectProperty(p) ...
// 新: const dataProp = ... isObjectProperty(p) || isObjectMethod(p) ...
// 并分别处理 fn = dataProp (ObjectMethod) vs fn = dataProp.value (FunctionExpr)
```

### 3. 添加 vueImports tracking (ref/reactive/computed/watch)

**Bug**: stub 生成 `ref<unknown>(...)` / `reactive<unknown>(...)` 但不往 `result.vueImports` 集里加, 导致 buildNewScript 不生成 `import { ref, reactive } from 'vue'`. 编译报错.

**修复**: 在每个 emit 处加 `result.vueImports.add('ref')` 等.

### 4. 移除 stub 内置的 import block (避免重复 import)

**Bug**: stub 有 `if (data.fields.length > 0 && !result.extraImports.some(...)) { result.extraImports.unshift(...) }`, 跟 buildNewScript 的 vueImports 机制冲突, 产生重复 import.

**修复**: 直接删掉这块.

### 5. Free variables 加 review 提示

**Bug**: 之前 `let xxx: any` 不告诉用户要赋值.

**修复**: 加 review "自由变量 \`xxx\` 在 setup 里声明为 \`let xxx: any\`, 但未初始化. Vue3 需在 setup() 里显式赋值."

## 验证

### compo-test 单文件

✅ 真实转换发生:
```js
const modalVisible = ref<unknown>(false)
const items = reactive<unknown>([...])
const form = reactive<unknown>({...})
const fullTitle = computed(() => { return title + ' - ' + modalTitle; })
```

✅ 4 imports 正确生成 (ref, reactive, computed, watch)

✅ 0 errors

### main sample (vue2-manage-master, 28 文件)

| 指标 | iter-022 (stub) | iter-023 (启用) | Δ |
|---|---|---|---|
| 总文件 | 28 | 28 | 0 |
| modified | 42 | **63** | **+21** |
| reviewCount | 23 | **50** | **+27** |
| errors | 0 | 0 | 0 |

`modified` 从 42 升到 63 (因为 21 个文件被 composition 真改了 script)
`reviewCount` 从 23 升到 50 (composition 加 27 个 review, 大多是 free variables 提示)

### multi-sample (171 文件, 6 sample)

| 指标 | iter-022 (stub) | iter-023 (启用) | Δ |
|---|---|---|---|
| avgCompileOk | 0.983 | 0.983 | 0 |
| avgAstEquivalent | 0.891 | **0.790** | **-0.10 ⚠️** |
| avgSemanticDiff | 0.722 | **0.616** | **-0.10 ⚠️** |
| avgRuntimeSafe | 0.996 | **0.855** | **-0.14 ⚠️** |
| totalReviewDelta | 231 | **265** | +34 |

## ⚠️ 回归分析

**runtime safety 0.996 → 0.855 (-14%)**: composition 的 stub 还不够完整, 生成代码里有:
- `let xxx: any` (free variables, 22 个/文件) → 运行时 `undefined`
- 缺 `this.$route` / `this.$store` 等特殊替换 (应该 `route.xxx` 不是 `this.$route`)
- 缺 `this.$refs` 等替换
- injectTopSetup 机制没跑 (应该在 setup() 顶部注入 `const route = useRoute()` 等)

**semantic diff 0.722 → 0.616**: composition 改了文件, 但改得不完全, 语义跟原版不等价 (因为 free variables 是 undefined).

## 决策: 不回滚

我选择不回滚, 因为:

1. **composition 现在能跑通基础转换了** (data → ref/reactive, methods → function, computed → computed(), watch → watch()). 这是 iter-007 以来 16 轮的停滞终于有突破.

2. **stub 模式也不完整**: 之前 stub 模式 0 errors 只是因为没改文件, 所以没运行时错误. 但用户得到 0 modified script, 等于 composition 啥都没干.

3. **回归可量化**: -0.14 runtime safety 但 +21 modified files. 净 effect 取决于用户.

4. **下一轮可继续修 free variables**: 这是已知问题, 不需要回滚整个 plugin.

如果用户要回滚, 改一行: `result.changed = true` → `result.changed = false`.

## 关键决策

- **保留 enabled**: 真实 progress > 表面 metrics
- **接受 regression**: stub 模式不能永远保留, 必须往前走
- **下一轮重点**: 修 free variables (this.$route 等), 让 runtime safety 回升

## 下一步 (下一轮 cron)

1. **P0 修 free variables**: 重点修 `this.$route` → `route`, `this.$store` → `store`, `this.$refs.xxx` → `xxxRef.value` 等
2. **P1 修 injectTopSetup**: 在 setup 顶部注入 `const route = useRoute()` 等
3. **P1 改善 typeStr**: 替代 'unknown' 给常见类型 (boolean, number, string, array)
4. **P2 如果 runtime safety 回升到 0.95+**: 考虑长期保留 enabled

## 完整数据

- `baselines/iter-023/report.json` — 主样本 28 文件, 50 review
- `baselines/iter-023/multi-sample/summary.json` — 265 review, 0.855 runtime
- `baselines/iter-023/iter-023/page/addGoods.vue` — 实际转换示例
- `packages/plugins/composition/src/options-to-setup.ts` — 修复
- 备份: iter-022 stub 在 `$env:TEMP\options-to-setup-iter012.bak.ts` (24KB)
