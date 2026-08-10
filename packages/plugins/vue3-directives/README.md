# @vue-migrate/plugin-vue3-directives

> Vue2 → Vue3 迁移插件：处理自定义指令、过滤器、模板相关规则

## 职责

把 Vue2 的指令生命周期、过滤器管道、keycode 修饰符等语法转换为 Vue3 等价写法。

## 实现的规则

| 规则 | 描述 | 实现方式 |
|------|------|----------|
| 6.1 | 自定义指令 `bind` → `beforeMount`、`inserted` → `mounted` | AST（重命名 ObjectProperty/ObjectMethod key） |
| 6.2 | 指令 `update` / `componentUpdated` → 合并为 `updated` | AST；冲突时后者改名 `updated_legacy_xxx` + 标记 manualReview |
| 6.2 | 指令 `unbind` → `unmounted` | AST（重命名） |
| 2.3 | 模板 `{{ x \| f \| g(arg) }}` → `{{ g(f(x), arg) }}` | 正则改 file.source |
| 2.3 | `filters: { ... }` 选项识别 | AST 识别 + 标记 manualReview（不自动重构） |
| 5.1 | `keycode` 数字修饰符（`@keyup.13`）→ key 名 | 正则改 file.source + manualReview |
| 5.3 | `v-if` + `v-for` 同节点检测 | 警告 + manualReview（不自动拆） |
| 5.4 | `:value="x"` + `@input="y"` → `v-model="x"` | 正则改 file.source + manualReview |
| 5.5 | `<keep-alive :include="'a,b,c'">` → 数组形式 | 正则改 file.source |

## 关键限制 / 实现说明

### 模板修改受 core codegen 限制

core 的 codegen 只重写 `<script>` 块，template/style 原样保留。本插件需要修改 template 时采用以下策略：

1. **不要清空 `file.scriptAst`** —— 否则前面的 AST 改动（指令 hook 重命名等）会丢失
2. **必须更新 `sfc.script.loc.start.offset` / `end.offset`** —— core 用这些 offset 切 script 块；如果 template 大小变了，offset 会失效
3. 用 `utils.transformTemplate()` 这个共享工具封装了上述逻辑

### 降级为「仅识别 + 警告」的规则

| 规则 | 原因 |
|------|------|
| 2.3 `filters: { ... }` 选项 | 自动重构涉及跨文件 utils 提取、引用重写，风险大；template 端的 filter 已经处理，filters 选项保留为 warning + 提示让用户手工提取 |
| 5.3 `v-if` + `v-for` 同节点 | 自动拆分涉及 `<template v-if>` 包装、变量作用域处理；当前只 warn |
| 5.4 `:value` + `@input` | 替换前提是 `@input` 表达式就是简单赋值（如 `x = $event.target.value`）；其他场景（如 `x = $event.target.value.toUpperCase()`）替换后会改变行为，所以加 manualReview 提示 |
| 6.2 `update` + `componentUpdated` 同时存在 | 两个都映射到 `updated`，冲突时无法自动合并；改名 `updated_legacy_xxx` + 标记 manualReview |

## 需要 core 调整的清单

| 需求 | 优先级 | 说明 |
|------|--------|------|
| codegen 不应只重写 script 块 | P1 | 现在改 template 必须手动更新 `sfc.script.loc`。建议 core 提供 `transformFile(source, replacer)` 工具，自动处理 loc |
| `manualReview` 不计入 `stats.manualReviewRequired` | P2 | 现状：`stats.manualReviewRequired` 只统计 "review items" 但 plugin 的 review 走了单独的 `transforms` 数组；report 显示 0 review 但实际有 review 项 |
| 字符串字面量（带嵌套引号）解析 | P3 | 我自己写了一个 `unquoteStringLiteral` 工具，core 应提供一个通用的 attribute value parser |

## 输入 → 输出对比

### 规则 6.1 / 6.2：自定义指令 hooks

**输入**
```vue
<script>
export default {
  directives: {
    'my-directive': {
      bind(el, binding) { el.value = binding.value },
      inserted(el) { el.focus() },
      update(el, binding) { el.value = binding.value },
      componentUpdated(el) { console.log('updated') },
      unbind(el) { console.log('cleanup') }
    }
  }
}
</script>
```

**输出**
```vue
<script>
export default {
  directives: {
    'my-directive': {
      beforeMount(el, binding) { el.value = binding.value },
      mounted(el) { el.focus() },
      updated(el, binding) { el.value = binding.value },
      updated_legacy_componentUpdated(el) { console.log('updated') }, // ⚠ conflict
      unmounted(el) { console.log('cleanup') }
    }
  }
}
</script>
```

### 规则 2.3：模板 filter

**输入**
```vue
<template>
  <p>{{ price | formatPrice | addDollar }}</p>
  <p>{{ message | truncate(20) | uppercase }}</p>
</template>
```

**输出**
```vue
<template>
  <p>{{ addDollar(formatPrice(price)) }}</p>
  <p>{{ uppercase(truncate(message, 20)) }}</p>
</template>
```

### 规则 5.1：keycode 移除

**输入**
```html
<input @keyup.13="submit">
<input @keydown.27="cancel">
```

**输出**
```html
<input @keyup.enter="submit">
<input @keydown.esc="cancel">
```

### 规则 5.3：v-if + v-for

**输入**
```html
<li v-for="item in items" v-if="item.active" :key="item.id">
```

**输出**（仅警告，文件不修改）
```
✗ manual-review: v-if + v-for on the same element (<li v-for=...) — Vue2 prioritized v-for, Vue3 prioritizes v-if. Please split into <template v-if> wrapper.
```

### 规则 5.4：`:value` + `@input` → `v-model`

**输入**
```html
<input :value="search" @input="search = $event.target.value" placeholder="search">
```

**输出**
```html
<input placeholder="search" v-model="search">
```

### 规则 5.5：`<keep-alive :include>` 字符串 → 数组

**输入**
```html
<keep-alive :include="'UserCard,UserAvatar'">
  <component :is="current" />
</keep-alive>
```

**输出**
```html
<keep-alive :include="['UserCard', 'UserAvatar']">
  <component :is="current" />
</keep-alive>
```

## 项目结构

```
packages/plugins/vue3-directives/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                          # 入口：registerPlugin
    ├── utils.ts                          # 共享工具（transformTemplate 等）
    └── rules/
        ├── directive-hooks.ts            # 6.1, 6.2: 自定义指令 hook 重命名
        ├── template-filters.ts           # 2.3: 模板 filter 管道重写
        ├── template-keycode.ts           # 5.1: keycode 数字修饰符
        ├── template-vif-vfor.ts          # 5.3: v-if + v-for 警告
        ├── template-value-input.ts       # 5.4: :value + @input → v-model
        ├── template-keep-alive.ts        # 5.5: keep-alive :include 数组化
        └── filters-option.ts             # 2.3: filters 选项识别
```

## 测试

测试样例在 `examples/vue2-sample/src/`：
- `WithFilters.vue` — 模板 filter 链
- `WithDirectives.vue` — 自定义指令 + keycode + v-if/v-for + :value+@input + keep-alive

跑：
```bash
pnpm --filter @vue-migrate/cli dev transform \
  D:/Projects/NB_EST/qiuzhi/vue-migrate/examples/vue2-sample/src \
  -o D:/Projects/NB_EST/qiuzhi/vue-migrate/examples/vue2-sample/dist_vue3-directives \
  --plugins vue3-directives
```

## 已知问题

1. **指令 hook `update` + `componentUpdated` 冲突**：两者都映射到 `updated`。当前策略：把后者改名 `updated_legacy_componentUpdated`，加 manualReview 提示合并两个函数体。理想做法是检测冲突后直接合并两个函数体，但语义推断风险高。
2. **filter 重写后函数不一定可用**：模板改成 `{{ addDollar(formatPrice(price)) }}` 后，组件的 `<script setup>` / methods 里需要有同名函数。当前插件只转换调用形式，不确保函数定义可用——这需要跨文件提取 filters 选项里的函数。
3. **Babel generator 加分号**：core codegen 用的 `@babel/generator` 默认会在每条语句后加分号，可能改变代码风格。可配置但当前未做。
