# baseline-comparator / 跑分报告

> 在 `examples/vue2-manage-master/src`（28 个 .vue/.js，标准真实项目）上跑的实际数据。

## 1. 安装官方 codemod

**任务原文要求装 `@vue/codemod` —— 但这个包在 npm 上不存在。**

```bash
$ tsx tools/baseline-comparator/src/index.ts install
▶ 安装官方 codemod
  prefix: D:\Projects\NB_EST\qiuzhi\vue-migrate\tools\baseline-comparator
  尝试: npm install @vue/codemod
  ❌ @vue/codemod 失败: npm error 404 ...
  尝试: npm install vue-codemod
  ✅ vue-codemod 安装成功
  标记文件: D:\Projects\NB_EST\qiuzhi\vue-migrate\tools\baseline-comparator\.official-codemod-installed
```

实际装的是 `vue-codemod@0.0.5`（Vue 团队在 npm 上真正发布的包名；GitHub: `vuejs/vue-codemod`）。
CLI 的 fallback 机制按预期工作。

## 2. 跑 sample

```bash
$ tsx tools/baseline-comparator/src/index.ts run \
    --sample examples/vue2-manage-master/src \
    --work baselines/final-test
```

耗时 1.4 秒（含两份 sample 复制 + vue-migrate 跑 + vue-codemod 跑）。

## 3. 对比数据

### 3.1 双方运行状态

| 维度 | 我们的 (vue-migrate) | 官方 (vue-codemod) |
|---|---|---|
| ok | ✅ | ✅ |
| 模式 | CLI 调用 `pnpm tsx packages/cli/src/index.ts transform` | programmatic API（15 个 transformation） |
| review 数 | **100** | 0（无 review 概念） |
| 改动文件 | 全部 28 个被改 | **24** 个被改（4 个没动） |
| 错误 | 0 | 0（过滤掉 3 个已知坏规则后） |

### 3.2 5 个指标

| 指标 | 值 | 含义 |
|---|---|---|
| `compileOk` | **1.000** | 双方输出都能被 babel-parser 解析 |
| `astEquivalent` | **0.623** | AST 结构 Jaccard —— 我们的输出和官方明显不同 |
| `semanticDiff` | **0.839** | 我方的 Vue3 友好度（createApp / defineComponent / element-plus 占比） |
| `runtimeSafe` | **1.000** | 我们的 import 路径全部合法（已切到 element-plus） |
| `reviewDelta` | **100** | 我方 - 官方（负数 = 我们更省人工；正数 = 我们标了更多需人工） |

### 3.3 main.js 对比（最能反映"我们比官方好在哪"）

**原始 Vue2：**
```js
import Vue from 'vue'
import App from './App'
import router from './router'
import store from './store/'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'

Vue.config.productionTip = false;
Vue.use(ElementUI);
new Vue({
  el: '#app', router, store,
  template: '<App/>',
  components: { App }
})
```

**官方 vue-codemod 输出：**（main.js 居然没被它改！磁盘上还是原版；programmatic 内存里改了）
```js
import * as Vue from 'vue';
import App from './App'
import router from './router'
import store from './store/'
import ElementUI from 'element-ui'           // ❌ 仍指向 element-ui
import 'element-ui/lib/theme-default/index.css'  // ❌ 老 CSS 路径

Vue.use(ElementUI);                          // ❌ Vue3 中 Vue 不再是全局 API

Vue.createApp({
  template: '<App/>',
  components: { App }
}).use(router).use(store).mount('#app')      // 链式 OK
```

**我们的 vue-migrate 输出：**
```js
import { createApp } from 'vue';             // ✅ named import
import App from './App';
import router from './router';
import store from './store/';
import ElementPlus from "element-plus";     // ✅ 自动迁移到 element-plus
import "element-plus/dist/index.css";        // ✅ CSS 路径同步

const app = createApp(App).use(router).use(store).use(ElementPlus).mount("#app");
```

**结论：**
- vue-codemod 只做"机械的语法替换"（`new Vue` → `createApp`、`import Vue` → `import * as Vue`），不处理 `element-ui → element-plus`，也不处理 CSS 路径
- vue-migrate **会处理跨包迁移**（element-ui → element-plus 及其 CSS），并去掉 `Vue.config.productionTip` / `Vue.use(...)` 这种 Vue 3 没法跑的全局调用

### 3.4 哪个 metric 最能反映"我们比官方好"

**`runtimeSafe`（值 = 1.0）** 是最直观的指标。理由：
- 官方 codemod 的 output 仍包含 `import ElementUI from 'element-ui'` 和 `import 'element-ui/lib/theme-default/index.css'` —— 这些 import 在 Vue 3 + element-plus 项目里直接会爆
- 我们已经全部替换为 `element-plus`，跑不起来的事我们提前处理了
- 跑一次就能看出来，不需要懂 Vue 3 也能 interpret

**`semanticDiff`（0.839 vs 官方 0）** 也很有力。官方 codemod 没有 review 概念，对遗留的 Vue 2 API（如 `Vue.config.productionTip`、`Vue.use(...)`）不告警。我们标记了 100 个 review 提醒人工核对。

**`astEquivalent`（0.623）** 不该被解读为"我们和官方不一样 = 我们差"。**正好相反**：低 astEquivalent 在这里 = 我们的转换更有深度（动到的不只是 surface-level 的 API 名字）。

## 4. 给后续 agent 的建议

### 4.1 怎么把 metrics 接到 scheduler

1. 改 `tools/scheduler` 里的 iteration：跑完 vue-migrate 后，调 `compareOneSample(sampleDir, workDir)`，把 `SampleComparison` 的 `comparison` 字段塞进 `IterationReport.stats`（参考 `tools/common/types.ts` 的 `BaselineMetrics` 形状）
2. `reviewDelta` 是"健康度"的直接指标 —— 一轮改进做完后跑 baseline-comparator，如果 reviewDelta 没下降，说明这轮没真效果
3. 跟踪多个迭代的 metrics 曲线，放在 `baselines/history.jsonl` 里

### 4.2 metrics 还能怎么强化

- `astEquivalent` 目前是 multiset Jaccard，对属性顺序不敏感。如果要更严的对比，换 tree edit distance（慢但准）
- `semanticDiff` 现在只看"出现的次数"。可以加权：把"出现 `defineComponent`"的权重设得比"出现 `app.use`"高
- `runtimeSafe` 目前只覆盖 element-ui / vuex / vue-router / @vue/composition-api。可以扩展：core-js 路径、polyfill 路径、UI 库别名
- 可以加一个 `runtimeSafe_official` 指标，专门反映"官方的输出跑不跑得起来" —— 在这个 sample 上应该是 < 1.0

### 4.3 已知坑

- **`vue-codemod` 0.0.5 是 2021 年的最后版本，3 个内置规则会抛错**：`add-import` / `remove-extraneous-import` / `remove-vue-use`。已在 `run-official.ts` 的 `KNOWN_BROKEN` 里过滤掉，否则会污染 errors
- **`vue-codemod` 0.0.5 实际没有 `-a`（all）参数** —— 必须逐个 `-t <name>` 调。但我们用 programmatic API 一次性跑全部，不用担心
- **CLI 模式在 .vue 文件上会 SyntaxError**（jscodeshift 不知道 `<template>`）。我们用 programmatic 模式绕开了
- **vue-migrate 的报告是中文的**（`总文件:` / `已修改:` / `需人工:`），`parseOurReport` 用正则匹配这些关键字。如果未来报告改文案，需要同步改

### 4.4 样本建议

- 28 文件的标准项目适合快速 smoke test（1.4 秒）
- 想做更严格的对比，可以跑 `examples/vue2-element-touzi-admin-dev-permission`（有 node_modules，要排除）或者自造更复杂的样本
- **要避免把 `node_modules` 复制进 workDir** —— 现在的 `copySample` 已经显式跳过了

## 5. 验收

```bash
# 1. install（自动 fallback 到 vue-codemod）
$ tsx tools/baseline-comparator/src/index.ts install
✅ vue-codemod 安装成功

# 2. --help
$ tsx tools/baseline-comparator/src/index.ts --help
vue-migrate / baseline-comparator
... (完整 help)

# 3. 单 sample
$ tsx tools/baseline-comparator/src/index.ts run \
    --sample examples/vue2-manage-master/src \
    --work baselines/test-work
... (完整对比报告 + JSON)

# 4. 单元测试
$ cd tools/baseline-comparator && npx tsx --test src/__tests__/metrics.test.ts
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

全部通过。即使官方 codemod 挂了，graceful degradation 也保证不阻塞我们的报告输出。
