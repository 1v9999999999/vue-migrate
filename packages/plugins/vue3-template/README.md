# @vue-migrate/plugin-vue3-template

P1 模板 & 脚本端 Vue2 → Vue3 兼容性规则。

## 负责规则

| 编号 | 规则 | 自动化程度 |
|------|------|----------|
| 2.1  | `slot="xxx"` / `slot-scope="xxx"` → `<template #xxx>` | ✅ 自动 |
| 2.2  | `<template slot="xxx">` → `<template #xxx>` | ✅ 自动 |
| 2.4  | `v-bind.sync="x"` → `v-model:xxx` 或拆成多个 | ✅ 自动（简单情况）+ 警告（复杂） |
| 2.5  | `this.$listeners` → `this.$attrs` | ✅ 自动（带 manual review 警告） |
| 2.6  | `this.$children` → 模板 ref | ⚠️ manual review（语义差异大） |
| 2.7  | `this.$scopedSlots.xxx` → `this.$slots.xxx` | ✅ 自动 |
| 2.9  | `inline-template` 属性移除 | ✅ 自动（带 manual review 警告） |
| 2.10 | `this.$on / $off / $once` → mitt | ⚠️ manual review（需选事件总线库） |

## 文件结构

```
src/
├── index.ts                # 插件入口，串联各规则
├── utils/
│   ├── template-scanner.ts # 轻量级 HTML 元素扫描器（自写，不依赖 @vue/compiler-dom）
│   └── sfc-source.ts       # SFC 源改写工具（含 offset 同步逻辑）
└── rules/
    ├── slot-rewriting.ts   # 规则 2.1, 2.2: slot / slot-scope → <template>
    ├── vbind-sync.ts       # 规则 2.4: v-bind.sync → v-model:xxx
    ├── inline-template.ts  # 规则 2.9: inline-template 移除
    └── script-instances.ts # 规则 2.5, 2.6, 2.7, 2.10: script AST 端实例属性
```

## 关键实现点

### 1. template 端用自写扫描器（不依赖 @vue/compiler-dom）

`utils/template-scanner.ts` 是一个**轻量级 HTML 元素扫描器**，能识别：
- 普通开闭标签 `<div>...</div>`
- 自闭合标签 `<i />`
- 注释 `<!-- ... -->`
- 嵌套结构（维护栈深度）
- 属性解析（含 `v-bind.sync`、`:foo`、 `@click` 等指令）
- 模板字符串边界（避免在属性值内部被 `<` 误导）

为什么不直接用 `@vue/compiler-dom` 的 `parse`？
- `parse` 只产出 AST，没有 serialize。重建 template 容易丢注释、空白、文本
- 自写扫描器保留原始 source 文本，做"自底向上文本替换"，最忠实

### 2. 重写 template 后同步 SFC block offset

core 的 `codegen` 只重写 `script` 块，template 原样保留。  
如果改了 template 长度而不更新 `sfc.script.loc` / `sfc.style.loc` 的 offset，codegen 会按旧 offset 切片错位，导致文件损坏。

`utils/sfc-source.ts::replaceTemplateContent` 做了：
1. 用 `loc.start.offset` 和 `loc.end.offset` 定位 template 块
2. 替换 inner content（保留 `<template>` 和 `</template>` 标签）
3. 用 `delta = newLen - oldLen` 调整后续所有 block 的 `loc.start.offset` / `loc.end.offset`
4. ⚠️ **关键**：先缓存 `loc.end.offset`（因为它和 `tpl.loc.end.offset` 是同一引用，后续修改会污染）

### 3. 优先级 9（在 vue2-compat 之后跑）

```
vue2-compat (10)  →  vue3-template (9)  →  vue3-types (5)
```

这样：
- `vue2-compat` 先把 `new Vue()` / `Vue.extend()` 改成 Vue3
- 我基于已被改过的 `file.scriptAst` 跑 `this.$scopedSlots` / `$listeners` / `$children` / `$on` 替换
- `vue3-types` 最后再加 JSDoc 类型标注（不被前面的修改覆盖）

### 4. fallback 路径：当 `file.sfc` 为 undefined

@vue/compiler-sfc 的 parse 可能在某些 .vue 文件上失败（**已知问题**：`v-bind.sync` 会触发 parser 崩溃）。  
此时 `file.sfc` 为 undefined，`file.scriptAst` 也为 undefined。

我的 fallback：
- 用正则定位 `<template>...</template>` 块
- 直接修改 `file.source` 文本
- codegen 走"无 sfc"路径：原样返回 `file.source`（selfCheck 重新用 SFC 解析验证）

⚠️ 这种情况下：
- template 端规则可以工作
- script 端规则不能工作（无 scriptAst）
- vue2-compat 在 script 上的修改也会丢失（因为 codegen 不替换 script 块）

详见下方「已知问题与限制」。

## 输入 → 输出对比

### slot / slot-scope 重写

**输入**:
```vue
<child-comp>
  <span slot="header">标题</span>
  <span slot-scope="props">{{ props.text }}</span>
</child-comp>
```

**输出**:
```vue
<child-comp>
  <template #header>
    <span>标题</span>
  </template>
  <template #default="props">
    <span>{{ props.text }}</span>
  </template>
</child-comp>
```

### v-bind.sync 重写

**输入**:
```vue
<my-dialog v-bind.sync="dialog" />
<my-form v-bind.sync="{ username, password }" />
```

**输出**:
```vue
<my-dialog v-model:dialog="dialog" />
<my-form v-model:username="username" v-model:password="password" />
```

### $scopedSlots / $listeners 重写

**输入**:
```js
mounted() {
  console.log('listeners:', this.$listeners)
  this.$scopedSlots.header({ title: 'hi' })
}
```

**输出**:
```js
mounted() {
  console.log('listeners:', this.$attrs)
  this.$slots.header({ title: 'hi' })
}
```

### inline-template 移除

**输入**:
```vue
<child-comp inline-template class="x">
  <p>{{ msg }}</p>
</child-comp>
```

**输出**:
```vue
<child-comp class="x">
  <p>{{ msg }}</p>
</child-comp>
```

## 已知问题与限制

### 1. `@vue/compiler-sfc` 在 `v-bind.sync` 上崩溃

**现象**: 含 `<el v-bind.sync="...">` 的 .vue 文件，SFC parse 抛 `TypeError: Cannot read properties of undefined (reading 'loc')`，导致 `file.sfc` 为 undefined、整个文件被 core 跳过。

**绕过**: 
- 不要在测试文件里用 `v-bind.sync`（这个 bug 应该在 core 解决）
- 或在 transform 前手动把 `v-bind.sync` 替换成 `v-bind`（没有 sync 修饰符）

**详见**: 「需要 core 调整」一节。

### 2. `inline-template` 重构为 `<slot>` 需手动

Vue3 不支持 `inline-template`，需要重构子组件内部用 `<slot>` 暴露内容。  
我的 plugin 只移除 `inline-template` 属性（加 manual review），不自动重构成 slot 形式。

### 3. `$children` / `$on` / `$off` / `$once` 不自动改

这些 API 在 Vue3 移除，但替代方案取决于项目（ref? pinia? mitt? tiny-emitter?）。  
plugin 只标 manual review，不改代码。

### 4. `$listeners` 改名后语义有差异

Vue3 把 `$listeners` 合并进了 `$attrs`。改名后能跑，但有边界情况行为不同（比如 native vs component event 的区分）。  
plugin 自动改名 + 标 manual review。

### 5. `v-bind.sync` 复杂情况

只处理：
- `v-bind.sync="<identifier>"` → `v-model:<identifier>="<identifier>"`
- `v-bind.sync="{ a, b, c }"` → 展开为多个 `v-model:a="a" v-model:b="b" ...`

不处理（标 review）：
- `v-bind.sync="form.data"`（成员访问，无法推断 prop）
- `v-bind.sync="getForm()"`（函数调用）

## 需要 core 调整

| 序号 | 描述 | 影响 |
|------|------|------|
| 1 | `@vue/compiler-sfc` parse 失败后只标 `parse-error`，不保留 sfc 信息；`file.scriptAst` 为 undefined；core 的 orchestrator 跳过整个文件 | 任何含 `v-bind.sync` 的 .vue 文件都不会被任何插件处理 |
| 2 | `transformTemplate`（vue3-directives/src/utils.ts）清空 `file.scriptAst`，与 vue2-compat 的脚本修改冲突 | 多个改 template 的插件顺序敏感 |
| 3 | `parseProject` 失败的文件不会被任何插件 transform | 同 #1，需要兜底 parser |
| 4 | core `codegen` 只重写 script 块 | template 改动必须在插件里手动同步 SFC offset（已在本插件内解决） |

## 测试

```bash
# 单元测试（不依赖 core）
npx tsx packages/plugins/vue3-template/src/__tests__/test-slot.ts
npx tsx packages/plugins/vue3-template/src/__tests__/test-vbind.ts
npx tsx packages/plugins/vue3-template/src/__tests__/test-inline.ts
npx tsx packages/plugins/vue3-template/src/__tests__/test-scanner.ts

# 端到端
pnpm --filter @vue-migrate/cli exec tsx src/index.ts transform \
  D:/Projects/NB_EST/qiuzhi/examples/test-template \
  -o D:/Projects/NB_EST/qiuzhi/examples/test-template/dist
```

## 已知未实现（TODO）

- [ ] 动态 slot 名 `slot=":"` 识别为动态
- [ ] `<template slot="xxx">`（slot 在 `<template>` 上时）的特殊处理
- [ ] `v-bind.sync="form"` 的 prop 推断（需要读子组件 props）
- [ ] `inline-template` 内容自动迁移到子组件 slot
- [ ] `$scopedSlots` 在 `<script setup>` 中的自动 setup
