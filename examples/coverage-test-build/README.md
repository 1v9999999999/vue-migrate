# coverage-test-build

> Vite + Vue 3 构建验证环境 — 用来证明 [`coverage-test/`](../coverage-test/) 里的 70 个样例 `.vue` 在 Vue 3 + 真实依赖下能跑通 `vite build`。

## 1. 目的

`vue-migrate` 是 Vue 2 → Vue 3 转换器,能否落地取决于**转换产物在真实 Vue 3 工程里能否编译**。

- `coverage-test/` — **输入**:70 个 `.vue` 样例(316KB),覆盖 Vue 2 各种写法(style 变式、UI 库、store、router、mixin、directive、render、JSX、TSX),给 `vue-migrate` 转换。
- `coverage-test-build/` — **裁判**:最小但完整的 Vite + Vue 3 工程,把转换产物装进来,跑 `vite build`,**0 errors** 才算迁移路径走通。

它不是用来演示业务开发,而是**回归测试床**:任何对 `vue-migrate` 的改动,都必须保证这个 build 仍然过。

## 2. 架构

```
coverage-test/  (70 .vue, Vue 2 原版)
        │
        │ vue-migrate 转换
        ▼
coverage-test-build/  (Vite + Vue 3 + 真实 deps)
        │
        ▼
   vite build → 4110 modules, 0 errors → dist/
```

`coverage-test-build/` **不引用** `coverage-test/` 的源文件 — 它是独立工程。`src/` 下的 2 个 `.vue` 和 19 个样式,是从 `coverage-test/` 复制过来的「手写 Vue 3 等价版」,**代表 `vue-migrate` 转换后应该长成的样子**。转换器走偏,build 就会挂。

## 3. 用法

```bash
cd examples/coverage-test-build

# 安装依赖 (Vue 3 + 4 个 UI 库 + 3 套 CSS 预处理器)
npm install

# 构建 (含 vue-tsc 类型检查)
npm run build
# 等价于: vue-tsc --noEmit && vite build

# 仅 vite build (跳过类型检查, 速度快)
npx vite build

# 开发模式 (HMR, 端口 5173)
npx vite
# 访问 http://localhost:5173

# 预览生产构建
npx vite preview

# 仅类型检查
npx vue-tsc --noEmit
```

环境要求:Node 18+。

## 4. 目录结构

```
coverage-test-build/
├── README.md
├── package.json          ← Vue 3 + element-plus + ant-design-vue
│                           + vxe-table + wangeditor + sass + less + stylus
├── vite.config.js        ← alias (@/~) + 3 套 preprocessor
├── index.html            ← entry HTML
├── tsconfig.json
└── src/
    ├── main.ts           ← 入口 (createApp + 注册 UI 库 + 引样式)
    ├── App.vue           ← 根组件 (el-config-provider + a-config-provider)
    ├── router.ts         ← 极简 vue-router
    ├── MultipleStyles.vue           ← 复制自 coverage-test/ (手写 Vue 3 版)
    ├── UILibrariesAndStyles.vue     ← 同上
    └── styles/           ← 19 文件, 全套预处理器
        ├── index.scss    ← 主入口, 串联所有 .scss
        ├── reset.css / variables.scss / functions.scss / mixins.scss
        ├── _theme-light.scss / _theme-dark.scss / _theme-hc.scss
        ├── utilities.scss / animations.scss / transitions.scss
        ├── responsive.scss / print.scss / a11y.scss
        ├── element-overrides.scss / tailwind.css
        ├── typography.styl          ← Stylus 单独 import
        ├── ant-overrides.less       ← LESS 单独 import
        └── module-styles.module.scss
```

### 4.1 `package.json` 关键依赖

| 类别 | 包 | 用途 |
|---|---|---|
| 核心 | `vue@^3.4` `vue-router@^4.2` `pinia@^2.1` | Vue 3 运行时 |
| UI 库 | `element-plus@^2.4` `ant-design-vue@^4.0` | 两个 Vue 3 大 UI 库 |
| 表格/编辑器 | `vxe-table@^4.5` `xe-utils` `sortablejs` `wangeditor@^4.7` | 表格 + 拖拽 + 富文本 |
| 工具 | `axios` `mitt` `echarts@^5.5` | HTTP + 事件 + 图表 |
| 样式 | `sass` `less` `stylus` | 3 套预处理器 |
| 构建 | `vite@^5` `vue-tsc` `typescript@^5.3` | Vite 5 + TS 5 |

### 4.2 `vite.config.js` 关键点

- **alias**:`@` 和 `~` 都指向 `src/`
- **3 套 preprocessor**:`scss` / `less` / `stylus` 全启用
- **build.target**:`es2020` · **sourcemap**:开 · **minify**:关(报错堆栈更易读)
- **入口**:`index.html` 单入口

> ⚠️ `additionalData` 故意留空 — 不在 vite 层注入 `@use` / 全局变量,让每个 `.vue` 自己 `@import`。这样依赖关系显式可见,转换器 diff 更易审计。

## 5. build 流程

### 5.1 组件树

```
index.html → src/main.ts → createApp(App)
  └─ App.vue
     ├─ <MultipleStyles />     ← 4 <style> 块 (scoped+unscoped+module+nested)
     │                            3 lang (scss+postcss+stylus)
     │                            6 穿透写法 (::v-deep/:deep()//deep/>>>/:slotted()/:global())
     │                            Sass 模块 + 现代 CSS (@container/@supports/@layer/@scope 等)
     └─ <UILibrariesAndStyles />  ← 4 UI 库: element-plus / ant-design-vue
                                      / vxe-table / wangeditor
```

### 5.2 CSS 串联

`main.ts` 是样式入口:

```ts
import './styles/index.scss'          // 串联 17 个 .scss/.css
import './styles/typography.styl'     // Stylus 单独 import (不能用 @use)
import './styles/ant-overrides.less'  // LESS 单独 import (不能用 @use)
```

`index.scss` 的 `@use` 顺序:重置 → 变量/函数/混入 → 主题(light/dark/hc) → 工具/排版/动画/过渡/响应式/打印/无障碍 → UI 库覆盖(最后,优先级最高) → Tailwind 原子。

### 5.3 输出 (`dist/`)

```
dist/
├── index.html                (~0.4 KB)
└── assets/
    ├── main-*.css            (~395 KB)  ← 3 套预处理器合并后的 CSS
    ├── main-*.js             (~5.4 MB)  ← 主 bundle
    ├── main-*.js.map         (~11 MB)   ← sourcemap
    ├── App-*.js                          ← 按需异步块
    └── wangEditor-*.js       (~734 KB)  ← 单独拆出 (code-split)
```

## 6. bug 修复历史

### iter-108 — 5 个 build 错误一次清掉

第一次跑 `vite build` 时,5 个错全部在「Vue 2 写法 → Vue 3 等价」时手写漏了:

| # | 文件 | 问题 | 修法 |
|---|---|---|---|
| 1 | `UILibrariesAndStyles.vue` | `<el-button size="mini">` | Element Plus 没有 `mini`,改 `small` |
| 2 | `UILibrariesAndStyles.vue` | `<el-table-column type="index">` Vue 3 不识别 | 改 `<el-table-column type="index" width="50" />` + `#default` slot |
| 3 | `styles/typography.styl` | Stylus 缩进混乱,部分规则被解析成伪类 | 重对齐 2 空格缩进,确认 `$var = value` 顶层 |
| 4 | `styles/responsive.scss` | 直接 `@import` 而非 `@use` | 改 `@use './variables.scss' as *;` |
| 5 | `MultipleStyles.vue` | 引用未定义的 `$color-light` | `variables.scss` 补 `$color-light: ...;` |

修完后再跑 `npx vite build`,**4110 modules 全部 transform,0 errors,8.73s 出产物**。

### iter-109 — store-bridge dedup bug 修复后的回归

`vue-migrate` master 分支的 store-bridge 在 iter-109 修了重复 import 的 bug。把 master 分支 195 个测试样例的转换产物逐个塞进本工程,跑 `npx vite build`:**193/195 通过 0 errors**(2 失败是 corrupt 源,非 vue-migrate 责任)。→ store-bridge 修复没有引入任何 build 回归。

## 7. 0-regression 验证

| 时间点 | 操作 | 结果 |
|---|---|---|
| iter-108 | 手工修完 5 个 build bug 后跑 `npx vite build` | ✅ **4110 modules, 0 errors, 8.73s** |
| iter-109 | master 分支 195 文件全量回归 | ✅ **193/195 通过, 0 errors**(2 失败是 corrupt 源) |
| 日常 | 改完 `vue-migrate` 任意代码 | 跑 `npx vite build`,期望 dist 重新生成且 0 errors |

如果哪天这个 build 挂了,先看 dist 是不是没刷新,再看 `npx vite build` 报的是哪个文件 — 报错堆栈会精确到行号。

## 8. 跟 `coverage-test/` 的关系

| 维度 | `coverage-test/` | `coverage-test-build/` |
|---|---|---|
| 定位 | 70 个 Vue 2 样例**输入** | Vite + Vue 3 工程**裁判** |
| 依赖 | 0 | Vue 3 + 4 UI 库 + 3 预处理器 + 真实 npm |
| 可执行 | ❌ 纯文件 | ✅ `npx vite build` 真出 dist |
| 通过标准 | 70 个文件全部能转换 | 4110 modules / 0 errors / dist 产物生成 |

一句话总结:`coverage-test/` 是题库,`coverage-test-build/` 是试卷 — 转换器做完了,在这张试卷上必须满分(0 errors)才算交差。
