# @vue-migrate/plugin-package-json

把 `package.json` 从 Vue 2 时代 (vue-cli-service + vuex + element-ui + vue-router 3) 转换到 Vue 3 时代 (vite + pinia + element-plus + vue-router 4) — 同时复制 `src/styles/` 等非代码资源。

## 背景

Vue 2 → Vue 3 升级不只是代码层: `package.json` 里:

- `vue` ^2.x → ^3.4
- `vue-router` ^3.x → ^4.2
- `vuex` ^3.x → 删 (由 pinia 替代)
- `element-ui` ^2.x → `element-plus` ^2.4
- `vue-template-compiler` → 删
- `vue-cli-plugin-*` / `@vue/cli-plugin-*` → 删
- `vue-loader` ^15 → ^17
- 缺 `vite` / `@vitejs/plugin-vue` 时自动注入

外加 scripts 段:
- `serve` → `dev`
- `vue-cli-service serve|build|lint|inspect|test|test:unit` → `vite` / `vite build` / `eslint --ext .js,.vue,.ts src` / `vite inspect` / `vitest` / `vitest run`

**且**: `src/styles/*.scss` 不会被 scanner 复制到 outDir, 但 main.js / settings.js 引用了 `@/styles/xxx.scss` — 不复制直接 build 失败 (P0 build blocker)。

## 负责规则

| 编号 | 规则 | 自动化程度 | 触发条件 |
|------|------|----------|---------|
| PJ.1 | `dependencies` 按 DEP_MAP 重命名 / 删除 / 升版本 | ✅ 自动 | 任何 Vue 2 项目 |
| PJ.2 | `scripts` 段 `serve` → `dev` + `vue-cli-service X` → vite 等价 | ✅ 自动 | 含 scripts 段 |
| PJ.3 | `devDependencies` 注入 `vite` / `@vitejs/plugin-vue` | ✅ 自动 (按需) | 原 devDep 缺这两个 |
| PJ.4 | `src/styles/` 目录递归复制到 outDir | ✅ 自动 (按需) | 指定了 outDir + 原项目有 src/styles/ |
| PJ.5 | `dependencies.@element-plus/icons-vue` 自动注入 | ✅ 自动 (按需) | deps 有 `element-plus` 或代码 import 了 icons-vue |

## 关键实现

### 走 `analyze` 钩子 (不是 per-file transform)

```typescript
const plugin: TransformPlugin = {
  name: 'package-json',
  priority: 100,  // 最高
  fileKinds: [],  // 不走 per-file 流程
  async analyze(ctx: ProjectContext) { /* ... */ },
}
```

**为什么用 analyze, 不用 transform?** `package.json` 不在 `ctx.files` 里 (scanner 只扫 .vue / .js / .ts), `src/styles/*.scss` 也不在 — 都要走文件 IO 直接写盘。`analyze` 是项目级钩子, 跑在所有 per-file transform 之后, 适合做"跨文件一次性处理"。

### DEP_MAP 重命名

```typescript
export const DEP_MAP: Record<string, DepMapEntry> = {
  'vue':              { name: 'vue',           version: '^3.4.0' },
  'vue-router':       { name: 'vue-router',    version: '^4.2.0' },
  'vuex':             { name: 'pinia',         version: '^2.1.0' },
  'element-ui':       { name: 'element-plus',  version: '^2.4.0' },
  'vue-template-compiler':     { name: '', remove: true },
  'vue-cli-plugin-element':    { name: '', remove: true },
  'vue-cli-plugin-typescript': { name: '', remove: true },
  'vue-cli-plugin-babel':      { name: '', remove: true },
  'vue-cli-plugin-pwa':        { name: '', remove: true },
  'vue-cli-plugin-eslint':     { name: '', remove: true },
  'vue-cli-plugin-unit-jest':  { name: '', remove: true },
  '@vue/cli-service':          { name: '', remove: true },
  'vue-loader':      { name: 'vue-loader',     version: '^17.4.0' },
  '@vue/compiler-sfc': { name: '@vue/compiler-sfc', version: '^3.4.0' },
  // 3rd-party 升级: vuedraggable / vue-count-to / echarts / screenfull 等
  'vuedraggable':    { name: 'vuedraggable',   version: '^4.1.0', manualReview: '...' },
  'echarts':         { name: 'echarts',        version: '^5.5.0', manualReview: '...' },
  // ...
}
```

`manualReview` 标记的依赖: 仍会升版本 (如果有 version), 但输出 console.log 提示用户注意 breaking change。

### scripts 重写 (PJ.2)

```typescript
const KEY_RENAME = { 'serve': 'dev' }
const CMD_REWRITE = {
  'vue-cli-service serve':    'vite',
  'vue-cli-service build':    'vite build',
  'vue-cli-service lint':     'eslint --ext .js,.vue,.ts src',
  'vue-cli-service inspect':  'vite inspect',
  'vue-cli-service test:unit':'vitest run',
  'vue-cli-service test':     'vitest',
}
```

**支持复合命令**: `"jest --clearCache && vue-cli-service test:unit"` → `"jest --clearCache && vitest run"`。用 `SEGMENT_SPLIT = /\s*(?:\|\||&&|;)\s*/` 切段, 只对 `vue-cli-service X` 段重写, 其它段保留。

### styles 复制 (PJ.4, iter-048a F5)

```typescript
async function copyDir(srcDir, destDir, skipNames) {
  // 递归 readdir
  // 跳过 node_modules / .git / dist / .cache
  // 失败不抛, console.error (best-effort)
}
```

**关键**: 只在 `ctx.config.outDir` 指定时复制。in-place 模式 (`vue-migrate transform ./src` 不带 `--out`) 没必要复制 — 源目录已有这些文件。

### @element-plus/icons-vue 注入 (PJ.5, iter-050a P0#4)

```typescript
function projectNeedsElementPlusIcons(pkg: PkgJson): boolean {
  return 'element-plus' in (pkg.dependencies || {})
}

function projectImportsElementPlusIcons(ctx: ProjectContext): boolean {
  for (const file of ctx.files.values()) {
    if (file.source?.includes('@element-plus/icons-vue')) return true
  }
  return false
}
```

任一条件满足就注入 `@element-plus/icons-vue@^2.3.0` 到 dependencies。

**为什么用 String.includes 而不是 regex?** 全局 regex `/.../g` 的 `lastIndex` 跨调用残留会误判 (第二次调用时从 `lastIndex` 继续, 跳过匹配)。`includes` 简单可靠。

## 文件结构

```
src/
├── index.ts                                  # analyze 钩子 + 写盘 + styles copy
├── types-shim.d.ts
└── rules/
    ├── dependencies.ts                       # PJ.1 + DEP_MAP (~30 项)
    ├── devDependencies.ts                    # PJ.3 vite/plugin-vue inject
    └── scripts.ts                            # PJ.2 KEY_RENAME + CMD_REWRITE
└── __tests__/
    └── test-package-json.ts                  # 110 case
```

## 测试

跑 110 个 case, 覆盖:
- DEP_MAP 每条: name 替换 / version 替换 / remove / manualReview 标记
- scripts key rename: serve → dev / 其它 key 不动
- scripts cmd rewrite: 6 种 subcmd 各自转换
- scripts 复合命令: `&&` / `||` / `;` 分隔后逐段处理
- isVue2Project 判定: `^2.` / `~2.` / `2.x` 各种写法
- @element-plus/icons-vue 注入: 两种触发条件
- analyze dry-run 模式: 不写盘, 只 console.log

`packages/plugins/package-json/src/__tests__/test-package-json.ts`

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- DEP_MAP 触发: vue / vuex / element-ui / vue-router / vue-loader / vue-template-compiler / vue-cli-plugin-* (7 类) 全部命中
- scripts 触发: `serve` → `dev`, `vue-cli-service build` → `vite build` 等
- @element-plus/icons-vue 注入: 16 个文件用 `<el-icon><Xxx /></el-icon>` → 自动注入
- src/styles/ 复制: master 有 `src/styles/*.scss` 5 个文件 → 全部 copy 到 outDir
- 0 误删/误改 (跟 iter-054 baseline 一致 — 0 regression)

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-package-json'
```

priority: **100** (最高, 最后跑 — 让所有代码侧 plugin 先完成, package.json 这边处理 vuex→pinia 替换就不会跟代码冲突)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| vue3-entry | 先把 `import Vue` / `Vue.use` 等处理掉, package.json 这边才能正确删 `vuex` |
| vuex-pinia | 先把 vuex 替换成 pinia import, package.json 这边才能把 `vuex` 替换为 `pinia` |
| elementui | 先把 `<el-*>` 改 `<el-*>`, package.json 这边才知道要 inject `element-plus` |
| vue-router-v4 | 先把 vue-router import 改了, package.json 这边才知道要升 `vue-router` ^4.2 |
| 3rd-party-imports | 跟 package.json 同步, 都改 echarts/vuedraggable/screenfull 等版本 |
| vite-scaffold | 生成 `vite.config.js` / `index.html` 跟 package.json 的 dev 脚本一致 |

## 边界 / 已知限制

- **monorepo (workspaces / pnpm workspace)**: 不递归处理子 package.json, 只处理 root 一个
- **yarn.lock / pnpm-lock.yaml / package-lock.json**: 不动 (依赖 lock 由用户 `pnpm install` 解决)
- **3rd-party 升级 manualReview**: 仅 console.log 提示, 不阻塞迁移, 用户需自行验证
- **element-ui CSS path**: 不在 package.json 处理范围, 由 elementui plugin 改 import path
- **private / workspaces 字段**: 保留, 不动
- **engines / os / cpu 字段**: 保留, 不动
- **scripts 里 `vue-cli-service` 之外的命令**: 全部保留, 本 plugin 只重写已知的 vue-cli-service 子命令
- **`<script type="module">` 风格 package.json**: 不影响 (本 plugin 只动 dependencies / devDependencies / scripts)
