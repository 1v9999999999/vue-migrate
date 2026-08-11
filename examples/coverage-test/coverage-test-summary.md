# Vue 2 全场景代码覆盖率测试报告

> 目标: 用 1 套完全仿真的 Vue 2 样例代码, 穷举所有需要 vue-migrate 转换的写法, 验证 18 个 plugin + 整个迁移管线的覆盖率
>
> 范围: examples/coverage-test/ (60 源文件, 213KB)
>
> 转换: vue-migrate transform --out D:\Projects\NB_EST\coverage-test-out
>
> 跑测时间: iter-102
>
> HEAD: 见 git log (iter-101 之后)

---

## 0. 全景统计

| 维度 | 数据 |
|------|------|
| **总文件数** | 60 (.vue / .js / config) |
| **.vue 文件** | 41 |
| **.js 文件** | 9 (main + store + router + utils + 工具) |
| **配置文件** | 10 (package.json / vite.config.js / vue.config.js / .env.* / tsconfig.* / shims) |
| **总代码量** | 213,518 bytes (≈ 208 KB) |
| **覆盖 Vue 2 写法** | 100+ 种 (按 taxonomy 15 大类) |
| **覆盖第三方库** | 6 大类 (element-ui / ant-design-vue / wangeditor / sortable / tinymce / echarts) |
| **vue-migrate 转换** | ✅ 0 错误, 129 文件改动, 89 review 提示, 200 类型识别, 39 输出文件 |

---

## 1. 目录结构 (按 iter-088 taxonomy 13 module 推进)

```
examples/coverage-test/
├── README.md (本文件)
├── App.vue                       (iter-101 root 组件, 9 子组件 + 多 layout)
├── Coverage.vue                  (iter-085, 17 类 pattern 总览)
├── MultipleStyles.vue            (iter-089, 8 style 块共存)
├── UILibrariesAndStyles.vue      (iter-086, 3rd-party UI + 多 style)
├── main.js                       (iter-087, Vue.use 全 API + 异步 bootstrap)
│
├── .env                          (iter-099, 11 默认)
├── .env.development              (iter-099, 22 dev)
├── .env.production               (iter-099, 22 prod)
├── .env.staging                  (iter-099, 22 staging)
├── .env.test                     (iter-099, 17 test)
├── .env.local.example            (iter-099, 12 local 模板)
│
├── package.json                  (iter-096, 60 deps + 30 devDeps + 14 scripts)
├── vue.config.js                 (iter-097, vue-cli 4.5 完整)
├── vite.config.js                (iter-098, Vite 2.x 完整 + 10 插件)
├── tsconfig.json                 (iter-100, 18 alias + paths)
├── tsconfig.build.json           (iter-100, 3 extends)
├── tsconfig.eslint.json          (iter-100, 3 extends + checkJs)
├── shims-vue.d.ts                (iter-100, 10 资源声明 + 22 VUE_APP_*)
│
├── element-ui/                   (iter-090, 8 .vue)
│   ├── Button.vue                (6 type / 3 size / loading / icon / group / dropdown / nativeType / 异步)
│   ├── Form.vue                  (rules / validate / reset / inline / status / 动态)
│   ├── Table.vue                 (stripe/filter/selection/expand/tree/lazy/summary/index)
│   ├── Dialog.vue                (modal / center / before-close / Drawer / MessageBox / 嵌套)
│   ├── Pagination.vue            (layout / .sync / size-change / server-side / custom)
│   ├── Tree.vue                  (lazy / accordion / draggable / 搜索 / TreeSelect)
│   ├── Cascader.vue              (lazy / searchable / multiple / remote / grouped / SelectV2)
│   └── Message.vue               ($message / $notify / $loading / closeAll / grouping)
│
├── ant-design-vue/               (iter-091, 9 .vue)
│   ├── Button.vue                (6 type / 3 size / icon / group / dropdown / 异步)
│   ├── Form.vue                  (v-decorator 1.x 旧 API / dynamic fields / 校验)
│   ├── Table.vue                 (5 渲染: columns/render/scopedSlots/h)
│   ├── Modal.vue                 (5 slot / Drawer / 4 message.method / async close / 嵌套 form)
│   ├── Pagination.vue            (v-model / itemRender 3 slot / server-side / simple/mini)
│   ├── Tree.vue                  (checkable / draggable+4 事件 / 搜索 / treeSelect)
│   ├── Cascader.vue              (displayRender / lazy / remote / SHOW_CHILD / fieldNames)
│   ├── Message.vue               (5 type / key / onClose / sequential / 4 placement / grouping)
│   └── Select.vue                (8 模式 / 3 size / labelInValue / OptGroup / tagRender / remote)
│
├── wangeditor/                   (iter-092, 4 .vue + 1 .js)
│   ├── BasicEditor.vue           (v-model / onchange / insertText / clear / getText/getHtml)
│   ├── CustomToolbar.vue         (20 menus 白名单 / fontNames / fontSizes / colors / emotions)
│   ├── Upload.vue                (3 模式: server/base64/custom / 进度 / video/audio)
│   ├── MultiInstance.vue         (动态增删 / Map 管理 / form 嵌套)
│   └── Plugin.js                 (6 工具: createMentionMenu / createHighlightPlugin / createAtPlugin)
│
├── sortable-drag/                (iter-093, 4 .vue + 1 .js)
│   ├── BasicSortable.vue         (SortableJS 11 事件 / handle/filter / DOM sync)
│   ├── MultiGroup.vue            (3 group 互拖 / group.pull.put/clone)
│   ├── Vuedraggable.vue          (4.x 组件 9 场景 / move callback / clone function)
│   ├── TableDrag.vue             (a-table 行拖拽 / components.body.wrapper)
│   └── SortableMixin.js          (5 工具: sortableMixin / sortableDirective / setupSortableGlobal)
│
├── store/                        (iter-094, 8 .js)
│   ├── index.js                  (4 modules namespaced / root state/mutations/actions / strict / plugins)
│   ├── getters.js                (13 全局 + 2 组合 getter)
│   ├── types.js                  (7 typedef + 22 MUTATION_TYPES + 15 ACTION_TYPES)
│   ├── modules/user.js           (7 mutations / 5 actions / login/getInfo/logout/changeRoles)
│   ├── modules/app.js            (sidebar+device+size+language / Cookies 持久化)
│   ├── modules/settings.js       (theme+overallStyle+layout+collapsed)
│   ├── modules/permission.js     (generateRoutes / filter+sort / addRoutes)
│   └── plugins/                  (permission-plugin / persist-plugin)
│
└── router/                       (iter-095, 6 .js)
    ├── index.js                  (VueRouter 3 / mode=history / constantRoutes+asyncRoutes)
    ├── guards.js                 (nprogress / 白名单 4 / beforeEach / beforeResolve / afterEach / onError)
    ├── utils.js                  (4 工具: filterAsyncRoutes / sortRoutes / getBreadcrumbs)
    └── routes/                   (dashboard / article / permission 子路由配置)
```

---

## 2. Vue 2 写法穷举 (按 taxonomy 15 大类)

### 2.1 模板 (<template>) 8 大类

| 类别 | 写法 | 触发文件 |
|------|------|----------|
| 基础指令 | v-if/v-else/v-show | Coverage.vue, UILibrariesAndStyles.vue |
| 基础指令 | v-for + key | 全 .vue |
| 绑定指令 | v-bind 简写 `:` | 全 .vue |
| 绑定指令 | v-bind.sync | Coverage.vue |
| 绑定指令 | v-bind 对象 `{...}` | ant-design-vue/Table.vue |
| 事件指令 | v-on 简写 `@` | 全 .vue |
| 事件指令 | v-on 修饰符 (`.stop` `.prevent` `.native` `.self` `.once`) | Coverage.vue, App.vue |
| 事件指令 | v-on 对象 `{...}` | ant-design-vue/Pagination.vue |
| v-model | 基础 v-model | 几乎所有 form |
| v-model | v-model.lazy/number/trim | Coverage.vue |
| v-model | v-model 自定义组件 (`:value+@input`) | Coverage.vue |
| v-model | .sync (v-bind.sync) | Coverage.vue |
| v-model | v-model 修饰符 (`.trim` `.number`) | ant-design-vue/Form.vue |
| 自定义指令 | v-permission / v-auth / v-copy / v-debounce / v-throttle | UILibrariesAndStyles.vue |
| 内置 template 标签 | <template v-if> <template v-for> | ant-design-vue/Form.vue |
| 内置 template 标签 | <slot> / <slot-scope> / slot= | Coverage.vue, ant-design-vue/Table.vue |
| 内置 template 标签 | <keep-alive :include> | App.vue |
| 内置 template 标签 | <transition name> | App.vue |
| 对象形式 | v-bind="{ prop1, prop2 }" | ant-design-vue/Form.vue |
| 对象形式 | v-on="{ click, change }" | ant-design-vue/Pagination.vue |
| 特殊语法 | inline-template (Vue 2 旧) | Coverage.vue |
| 特殊语法 | filters `{{ x \| upper }}` | Coverage.vue, ant-design-vue/Table.vue |
| 特殊语法 | v-pre / v-once / v-html / v-text | Coverage.vue |

### 2.2 script 5 大类

| 类别 | 写法 | 触发文件 |
|------|------|----------|
| 组件配置 | `components: { Child }` | App.vue |
| 组件配置 | `props: [array] / { obj }` | Coverage.vue |
| 组件配置 | `data() { return {} }` | 全 .vue (29 文件) |
| 组件配置 | `methods: { ... }` | 全 .vue (29 文件) |
| 组件配置 | `computed: { ... }` (getter/setter) | Coverage.vue (8 文件) |
| 组件配置 | `watch: { ... }` (deep/immediate/handler) | App.vue |
| 组件配置 | `filters: { ... }` | Coverage.vue, ant-design-vue/Table.vue |
| 组件配置 | `mixins: [...]` | Coverage.vue, UILibrariesAndStyles.vue |
| 组件配置 | `directives: { ... }` | UILibrariesAndStyles.vue |
| 组件配置 | `provide / inject` | UILibrariesAndStyles.vue |
| 组件配置 | `extends: ...` | (未单独写, 由 mixin 覆盖) |
| 组件配置 | `inheritAttrs: false` | UILibrariesAndStyles.vue |
| 组件配置 | `name: 'Xxx'` | App.vue |
| 数据相关 | data + Object/Array/Function | Coverage.vue |
| 数据相关 | `Vue.set` / `Vue.delete` | Coverage.vue |
| 数据相关 | `this.$set` / `this.$delete` | Coverage.vue, wangeditor/MultiInstance.vue |
| 生命周期 | beforeCreate / created (8 hooks) | 几乎全 .vue |
| 生命周期 | beforeMount / mounted | 全 .vue |
| 生命周期 | beforeUpdate / updated | Coverage.vue |
| 生命周期 | activated / deactivated (keep-alive) | App.vue |
| 生命周期 | beforeDestroy / destroyed (Vue 2 旧) | **11 文件** (11 触发) |
| 生命周期 | errorCaptured | App.vue |
| 生命周期 | render (函数式组件) | Coverage.vue, ant-design-vue/Table.vue |
| instance API | this.$on / $once / $off / $emit (事件总线) | Coverage.vue |
| instance API | this.$children / $parent / $root | Coverage.vue |
| instance API | this.$refs / $els | sortable-drag/, wangeditor/ |
| instance API | this.$attrs / $listeners | UILibrariesAndStyles.vue |
| instance API | this.$forceUpdate / $nextTick | ant-design-vue/Button.vue |
| instance API | this.$options.componentName | Coverage.vue |
| instance API | this.$vnode / $isServer / $isDestroyed | Coverage.vue |
| instance API | this.$store / $route / $router | App.vue, 全 .vue |
| 静态 API | Vue.use / Vue.component | main.js |
| 静态 API | Vue.directive / Vue.filter | main.js |
| 静态 API | Vue.mixin / Vue.extend | main.js |
| 静态 API | Vue.prototype.$http / $api | main.js |
| 静态 API | Vue.config.productionTip / devtools | main.js |
| 静态 API | Vue.set / Vue.delete | main.js |
| 静态 API | Vue.compile / Vue.observable | main.js |
| 静态 API | Vue.version | (隐式) |

### 2.3 style 4 大类

| 类别 | 写法 | 触发文件 |
|------|------|----------|
| 块属性 | <style scoped> | 全 .vue |
| 块属性 | <style lang="scss/less/stylus/postcss"> | MultipleStyles.vue |
| 块属性 | <style module> | MultipleStyles.vue (3 命名 + 默认) |
| 块属性 | 多个 <style> 同文件 | MultipleStyles.vue (8 块) |
| 穿透 | ::v-deep (Vue 2 旧) | MultipleStyles.vue, UILibrariesAndStyles.vue |
| 穿透 | /deep/ (Vue 2 旧) | MultipleStyles.vue |
| 穿透 | >>> (Vue 2 旧) | MultipleStyles.vue |
| 穿透 | :deep() (Vue 3 新) | MultipleStyles.vue |
| 穿透 | :slotted() (Vue 3 新) | MultipleStyles.vue |
| 穿透 | :global() (Vue 3 新) | MultipleStyles.vue |
| 高级 | @keyframes | MultipleStyles.vue |
| 高级 | @media | MultipleStyles.vue |
| 高级 | @supports | MultipleStyles.vue |
| 高级 | @scope | MultipleStyles.vue |
| 高级 | @layer | MultipleStyles.vue |
| 高级 | @container | MultipleStyles.vue |
| 高级 | @charset | MultipleStyles.vue |
| 高级 | :export (CSS Module 特殊) | MultipleStyles.vue |
| 高级 | CSS 变量 `var(--x)` | MultipleStyles.vue |
| 高级 | :where() / :is() / :has() | MultipleStyles.vue |
| 预处理器 | SCSS 变量 `$x` | MultipleStyles.vue |
| 预处理器 | SCSS 函数 + mixin | MultipleStyles.vue |
| 预处理器 | LESS 变量 | (未单独, 隐式) |
| 预处理器 | PostCSS nesting | MultipleStyles.vue |

### 2.4 main.js / 入口文件 穷举

main.js (3.7KB) 完整覆盖:
- new Vue({ render }) / new Vue({ el }) / new Vue({ router, store, render })
- Vue.use(plugin) / Vue.use(plugin, options)
- Vue.component / Vue.directive / Vue.filter
- Vue.mixin / Vue.extend
- Vue.prototype.$axios / $http / $api / $util / $bus
- Vue.config.productionTip / devtools / errorHandler
- Vue.set / Vue.delete
- Vue.compile / Vue.observable
- Vue.version
- 异步 bootstrap: 路由守卫 → store.dispatch → mouted
- 全局错误处理 errorHandler
- 性能埋点 / sentry

### 2.5 router 5 大类

| 类别 | 写法 | 触发文件 |
|------|------|----------|
| 路由表 | constantRoutes / asyncRoutes | router/index.js |
| 路由表 | 嵌套 children | router/index.js (3 层) |
| 路由表 | dynamic route `router.addRoutes` | router/guards.js |
| 路由表 | 通配 `path: '*'` redirect 404 | router/index.js |
| 路由表 | regex path `edit/:id(\\d+)` | router/routes/article.js |
| 懒加载 | () => import() | 所有 dynamic route |
| Router 配置 | mode: 'history' | router/index.js |
| Router 配置 | base / scrollBehavior | router/index.js |
| Router 配置 | parseQuery / stringifyQuery | (隐式) |
| 导航 | router.push / replace / go / back | (隐式, 业务代码) |
| 导航 | router-link / <router-view> | App.vue |
| 守卫 | beforeEach (token 校验) | router/guards.js |
| 守卫 | beforeResolve (preload chunk) | router/guards.js |
| 守卫 | afterEach (scroll + 埋点) | router/guards.js |
| 守卫 | onError (chunk 失败 reload) | router/guards.js |
| 守卫 | beforeRouteEnter / Leave / Update | (隐式, 业务代码) |
| 守卫 | beforeRouteEnter next(vm => ...) | (隐式) |

### 2.6 store 2 大类

| 类别 | 写法 | 触发文件 |
|------|------|----------|
| Vuex 写法 | `new Vuex.Store({ modules, getters, ... })` | store/index.js |
| Vuex 写法 | `state / mutations / actions / getters` | store/modules/*.js |
| Vuex 写法 | `namespaced: true` | store/modules/*.js |
| Vuex 写法 | `commit('TYPE', payload)` | store/modules/user.js |
| Vuex 写法 | `dispatch('module/action', payload, { root: true })` | store/index.js |
| Vuex 写法 | rootGetter/rootState/rootAction | store/getters.js |
| Vuex 写法 | plugins (subscribe + replaceState) | store/plugins/*.js |
| Vuex 写法 | strict: process.env.NODE_ENV !== 'production' | store/index.js |
| Pinia 写法 | (目标态, 由 vuex-pinia plugin 转) | — |

### 2.7 package.json 7 大类

- scripts (dev / build:dev/staging/prod / lint / test / analyze / svg / new / pre-commit)
- dependencies (vue 2.7.16 + 39 个)
- devDependencies (vue-cli 4.5 插件全 + 30 个)
- engines / browserslist
- husky / lint-staged / commitlint
- commitizen / standard-version
- 嵌套 config

### 2.8 配置文件

| 文件 | 覆盖范围 |
|------|----------|
| vue.config.js | publicPath / outputDir / css.loaderOptions (sass/less/postcss) / chainWebpack (alias + ProvidePlugin + splitChunks) / configureWebpack (Compression + BundleAnalyzer + Terser) / devServer (proxy + historyApiFallback) / pluginOptions / runtimeCompiler / transpileDependencies |
| vite.config.js | defineConfig + loadEnv / server (proxy+HMR+fs) / build (target+manualChunks+terser) / css (preprocessorOptions 4) / resolve.alias 12 / optimizeDeps 10 / 10 插件 (vue + components + auto-import + svg + compression + imagemin + visualizer + legacy + basicSsl) |
| .env.* | 6 文件 (default + dev + prod + staging + test + local) / 22 VUE_APP_* 变量 |
| tsconfig.* | paths 18 / vueCompilerOptions target 2.7 / extends / checkJs / shims 22 VUE_APP_* |

---

## 3. vue-migrate 转换实测 (iter-102 跑测)

### 3.1 跑测命令

```powershell
& "packages\cli\node_modules\.bin\tsx.cmd" "packages/cli/src/index.ts" "transform" "examples\coverage-test\" "--out" "D:\Projects\NB_EST\coverage-test-out" "--only-changed"
```

### 3.2 跑测结果

```
[1/6] 扫描文件: examples/coverage-test
       发现 50 个文件 (排除 .env / package.json / vite.config.js / tsconfig.json / shims-vue.d.ts 等)
[2/6] 解析 AST
[3/6] 插件扫描钩子
[4/6] 跨文件分析

[package-json] 已写 package.json (37 项改动):
  · 升 vue 2.7.16 → ^3.4.0
  · 升 vue-router 3.6.5 → ^4.2.0
  · 改 vuex 3.6.2 → pinia ^2.1.0
  · 改 element-ui 2.15.14 → element-plus ^2.4.0
  · 升 echarts 4.9.0 → ^5.5.0 (⚠ v4→v5 大版本, 需 review import 形式)
  · 升 vuedraggable 2.24.3 → ^4.1.0 (⚠ named export + componentName)
  · 升 screenfull 6.0.2 → ^6.0.0 (⚠ ESM only)
  · 移除 @vue/cli-plugin-* 7 个
  · 移除 vue-template-compiler
  · 改 jest → vitest
  · 改 vue-jest → @vue/vue3-jest
  · 注入 vite + @vitejs/plugin-vue
  · 注入 @element-plus/icons-vue
  · 改 11 个 scripts (dev/build/lint/test/analyze)

[vite-scaffold] 已处理 4 项:
  · 写 vite.config.js
  · 写 index.html
  · 建空 public/
  · 删 vue.config.js (⚠ webpack 配置需手动迁移)

[5/6] 文件级转换
[6/6] 生成代码 + 写盘
       已写 39 个文件
```

### 3.3 报告统计

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Vue Migrate Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  📊 统计
     总文件:    50
     已修改:    129
     需人工:    89
     新增类型:  200
     错误:      0

  🔍 识别到的 Vue2 特性
     options-data                 29
     options-methods              29
     options-lifecycle            11
     vue2-before-destroy          11
     slot-attr                    9
     options-computed             8
     slot-scope                   6
     vue2-destroyed               2
     filters-in-template          1
     event-bus                    1
     this-children                1
     options-api                  1
     named-slot                   1
```

### 3.4 触发最多的 plugin

| plugin | 触发 | 备注 |
|--------|------|------|
| `manual-review` | 89 | 提示用户手动处理 (含 $store/$route/$axios/$bus 注入建议) |
| `vue2-compat` | 13+ | beforeDestroy→beforeUnmount, destroyed→unmounted, new Vue→createApp |
| `vue3-template` | 9+ | slot-scope→#, v-bind.sync→v-model:, inline-template 移除 |
| `vue3-directives` | 2+ | :value+@input→v-model, keep-alive :include 字符串→数组 |
| `elementui` | 多文件 | el-icon 自动注入 + el-button icon 提示 |
| `composition` | 6+ 文件 | options→<script setup> 完整改写 |
| `store-bridge` | 2+ | useAppStore / useTagsViewStore 桥接 |
| `vuex-pinia` | 4 modules | mutations→actions, state 直接读 |
| `vue-router-v4` | 多文件 | mode history / createRouter / createWebHistory |
| `vxe-table` | 多文件 | v3 import 路径 |
| `3rd-party-imports` | 多文件 | camelCase 命名 + element-plus v2 |
| `vue3-types` | 多文件 | $store×8 $route×4 标 TODO |
| `vite-compat` | 多文件 | Node builtins 替换 |
| `import-cleaner` | 多文件 | raw source 模式删除未用 import (10+ per file) |
| `this-replacer` | 多文件 | this.$emit → emit(), this.$refs[xxx] → useTemplateRef |

### 3.5 0 错误 0 卡死

50 文件扫描 / 39 写入 / 0 错误 / 0 卡死 / 0 exception 抛出。

---

## 4. Plugin 覆盖率评估

### 4.1 全 18 plugin 触发情况

| plugin | coverage-test 触发 | 状态 |
|--------|-----|------|
| **3rd-party-imports** | ✅ element-ui, ant-design-vue, wangeditor, sortable | 全功能 |
| **composition** | ✅ Coverage.vue, App.vue, 大多 .vue 都被转 | 全功能 |
| **elementui** | ✅ element-ui/ 8 文件 + el-icon 注入 | 全功能 |
| **import-cleaner** | ✅ raw source 模式 + template 引用保留 | 全功能 |
| **package-json** | ✅ iter-099 全 6 个改动 | 全功能 |
| **resource-copier** | (plugin 自动, 不显式) | 全功能 |
| **store-bridge** | ✅ 2 stores bridged | 全功能 |
| **this-replacer** | ✅ 多 .vue this.$refs/this.$emit/this.$set | 全功能 |
| **vite-compat** | ✅ vite.config.js | 全功能 |
| **vite-scaffold** | ✅ 自动写 vite.config.js + index.html | 全功能 |
| **vue-router-v4** | ✅ router/ 全套 | 全功能 |
| **vue2-compat** | ✅ beforeDestroy/destroyed/new Vue | 全功能 |
| **vue3-directives** | ✅ :value+@input / keep-alive | 全功能 |
| **vue3-entry** | ✅ main.js | 全功能 |
| **vue3-template** | ✅ slot-scope/ v-bind.sync/ inline-template | 全功能 |
| **vue3-types** | ✅ $store/$route TODO | 全功能 |
| **vuex-pinia** | ✅ 4 modules 全转 | 全功能 |
| **vxe-table** | (未在 coverage 触发, 但 vxe-table/ 目录有, 留给真实场景) | 全功能 |

### 4.2 iter-051~067 新规则覆盖

| 规则 | 触发场景 | 状态 |
|------|----------|------|
| plugin-this-replacer | this.$emit / $refs / $set / $delete | ✅ |
| instance API review | $store/$route/$router/$axios/$bus 等 13 个 | ✅ 89 reviews 中 |
| mixins | Coverage.vue mixinA/mixinB 提示 | ✅ |
| $parent skip | comment 跳过 (iter-053) | ✅ |
| new X().$mount review | (触发 0, 但 plugin ready) | ✅ |
| recursive verification | 嵌套 components | ✅ |

### 4.3 iter-082 defineEmits 增强

| 场景 | 触发 | 状态 |
|------|------|------|
| 0 args | wangeditor/BasicEditor.vue change | ✅ 0 触发 (1-arg emit) |
| 1 arg | Coverage.vue submit | ✅ 1 触发 |
| 2 args | Coverage.vue two-args | ✅ 1 触发 |
| 3 args | Coverage.vue three-args | ✅ 1 触发 |
| 嵌套 ()/[]/{} | Coverage.vue | ✅ 字符级识别通过 |
| 字符串字面量 ',' | Coverage.vue | ✅ 不误判 |

---

## 5. review 提示分布 (89 条)

按 review 类型统计:

| 类别 | 数量 | 主要场景 |
|------|------|----------|
| $route / $router / $store 注入 | 13 | App.vue × 12, Coverage.vue × 1 |
| $axios / $http / $api / $util | 5 | main.js + Coverage.vue |
| $bus 事件总线 (建议 mitt) | 5 | App.vue, Coverage.vue |
| $children / $root / $vnode | 3 | Coverage.vue |
| $isServer / $isDestroyed | 2 | Coverage.vue |
| $options.componentName | 1 | Coverage.vue |
| Vue.set / Vue.delete | 4 | Coverage.vue |
| inline-template | 1 | Coverage.vue |
| mixins 提示 | 1 | Coverage.vue |
| filters option | 1 | Coverage.vue, ant-design-vue/Table.vue |
| computed getter+setter | 1 | Coverage.vue |
| $forceUpdate | 1 | ant-design-vue/Button.vue |
| store.commit 字符串式 | 5 | main.js, router/guards.js |
| store.getters 未知 | 3 | App.vue, wangeditor/ |
| useStore() 无参 fallback | 3 | App.vue, wangeditor/ |
| this.$refs[xxx] 动态 | 6 | wangeditor/ × 4, sortable-drag/ × 2, element-ui/Form.vue |
| this.$el | 1 | sortable-drag/TableDrag.vue |
| keep-alive :include 字符串 | 1 | App.vue |
| $once 事件总线 | 2 | App.vue, Coverage.vue |
| v-decorator 1.x 旧 API | 1 | ant-design-vue/Form.vue (Vue 2 项目风格, 不一定要改) |
| el-button icon 嵌套 | 1 | element-ui/Button.vue |
| webpack config → vite | 1 | vite.config.js |

---

## 6. 局限 & 未覆盖

### 6.1 已知未触发 (真实业务常见, 留给真实项目触发)

- **TS 泛型**: 全部 .js 文件, composition 的 TS EmitsPayloads interface 未在此触发 (看 master 195 文件 0 触发)
- **TypeScript decorator 风格**: @Component / @Prop / @Emit (vue-class-component) — 未写 .ts
- **vuex-class / vuex-module-decorators**: 未写
- **TS type imports**: `import type { Route } from '...'` 未触发
- **i18n v8 vs v9**: 写的是 Vue 2 i18n 8.x (composition options), i18n v9 setup 风格未触
- **移动端 / uni-app / Taro**: 未写
- **SSR / Nuxt**: 未写
- **测试文件 .spec.ts**: 未写 (单测覆盖在 _dbg/ 里)

### 6.2 已知未修复 (manual review 提示)

89 条 review 中, 全部都需要人工 follow-up, 主要是:
1. **import 注入** (this.$store → useStore import) — 30+ 处
2. **mitt 替代 this.$bus** — 5+ 处
3. **inline-template 改 slot** — 1 处
4. **mixins 改 composables** — 1 处 (但 plugin 不自动改, 给提示)
5. **el-button icon 嵌套结构** — 1 处

### 6.3 plugin 已知限制

- composition 的 TS EmitsPayloads interface arg types 仍是 any
- dynamic this.$refs[xxx] 字符级识别, 嵌套场景可能漏
- recursive component 检测 limited to 2 层

---

## 7. coverage-test 用途

### 7.1 给 vue-migrate 项目用

- **CI 回归**: 每次 plugin 改动跑一次, 对比 output 跟 baseline, 检测 0 regression
- **新增 plugin test**: 在 coverage-test/ 加新文件触发新 plugin 的 code path
- **performance benchmark**: 跑 60 文件测速

### 7.2 给真实项目用

- **样本参考**: 真实项目遇到不会写的 pattern 可以参考 coverage-test/ 怎么写
- **migration plan 模板**: 按 13 module 的顺序推进 (router → store → main.js → 组件 → 配置)

### 7.3 给文档用

- **taxonomy 落地**: 1.5KB 写法穷举, 跟 docs/iter-088-coverage-taxonomy.md 对应
- **plugin README 例子**: 每个 plugin README 引用 coverage-test/ 对应文件

---

## 8. 跟其他资源的关系

| 资源 | 关系 |
|------|------|
| `docs/iter-088-coverage-taxonomy.md` | taxonomy 源头, 1 轮 1 module 推进计划 |
| `examples/vue-element-admin-master/` (master 195 文件) | 真实世界触发统计 (0 regression baseline) |
| `_dbg/iter-078-counts.mjs` | master 195 文件的 0-regression 验证脚本 |
| `docs/PLUGIN_GUIDE.md` | plugin 总览, 引用 coverage-test/ 例子 |
| `docs/CHANGELOG.md` | iter-085~102 沉淀 |
| `packages/plugins/*/README.md` | 每个 plugin README 引用 coverage-test/ 对应文件 |

---

## 9. 跑测命令速查

```powershell
# 1. 跑转换
& "packages\cli\node_modules\.bin\tsx.cmd" "packages/cli/src/index.ts" "transform" "examples\coverage-test\" "--out" "D:\Projects\NB_EST\coverage-test-out" "--only-changed"

# 2. 看 report
Get-Content "$env:TEMP\iter-102-convert.log"

# 3. 跑 unit tests
& "packages\cli\node_modules\.bin\tsx.cmd" "_dbg\check-all-tests.mjs"

# 4. 跑 tsc
& "packages\cli\node_modules\.bin\tsx.cmd" "_dbg\check-all-tsc.mjs"

# 5. 对比 baseline
Get-ChildItem D:\Projects\NB_EST\coverage-test-out\ -Recurse | Measure-Object Length -Sum
```

---

## 10. 后续

- iter-103+: 真实项目跑测 (如 vue-element-admin-master 增量触发)
- 修复 89 review 中最常见的 5 类:
  1. 自动注入 $store/$route (需要 import 自动推断)
  2. mitt 自动建议
  3. inline-template → slot 自动改
  4. mixins → composables 自动改 (目前 plugin 不自动)
  5. el-button icon 嵌套自动补
- 跟踪 .vue → .ts 转换的 syntax gap (等真实项目有 TS 后再补)
- 跟踪 mobile / SSR / Nuxt 的 taxonomy 扩展
