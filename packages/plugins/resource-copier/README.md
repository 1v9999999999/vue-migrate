# @vue-migrate/plugin-resource-copier

iter-050a P0 #6/#7/#8 新增 plugin — 扫描源项目里非代码资源引用 (`@import './foo.scss'`, `import './foo.css'`, `import.meta.glob('./svg/*.svg')`), 复制到 outDir。

## 背景

Vue 2 项目里大量资源引用**只在代码里出现一次, 不在 import 链**:
- `<style lang="scss">@import './index.scss'</style>` 引用了项目内 .scss, 但 `<style>` 不走 webpack import graph
- `import './waves.css'` 走普通 import, 但如果原项目删了会运行时报错
- `import.meta.glob('./svg/*.svg')` (Vue CLI 不支持) — 转换后 Vite 支持, 但 svg 文件必须存在

如果不复制这些资源:
- 47 个 svg 全部丢失, 图标空
- 2 个 .scss 找不到, 编译报 `Can't find X`
- waves.css 找不到, 按钮没样式

resource-copier 负责这个 P0 build blocker 修复。

## 负责规则

| 编号 | 规则 | 自动化程度 |
|------|------|----------|
| R.1 | `<style>` 块里的 `@import './foo.scss'` → 复制 `foo.scss` 到 outDir 相对路径 | ✅ 自动 |
| R.2 | `<script>` 块里的 `import './foo.css'` → 复制 `foo.css` | ✅ 自动 |
| R.3 | `import.meta.glob('./svg/*.svg')` → glob 展开, 复制所有匹配的 svg | ✅ 自动 |
| R.4 | `import.meta.globEager` / `import.meta.globRaw` 同 R.3 | ✅ 自动 |
| R.5 | `require.context('./svg', false, /\.svg$/)` (Vue CLI 模式) | ✅ 自动 |
| R.6 | 缺文件 / 读失败 → 跳过, 不抛错, 统计 errors 计数 | ⚠️ 静默容错 |

## 触发条件 (隐式)

- 文件经过此 plugin (优先级 50, 在 package-json / vite-scaffold 之后)
- 文件 source 包含 `@import` / `import './...'` / `import.meta.glob` / `require.context`

## 关键实现

```typescript
// 1) scanFileSource(file): 提取所有资源引用
//    - <style> 块: regex /@import\s+['"](.+?)['"]/g
//    - <script> 块: regex /import\s+['"]([^'"]+)['"]/g  (排除 import 标识符)
//    - import.meta.glob('./svg/*.svg'): glob 模式
//    - require.context('./svg', false, /\.svg$/): glob 模式
// 2) resolvePath(source, ref): 原项目相对路径 → outDir 相对路径
//    - 来源: ctx.root (源项目) 或 ctx.config.outDir
//    - 缺: 跳过 (静默)
// 3) copyFile(srcRoot + ref, outDir + resolvedRef) (不覆盖)
// 4) mkdir -p outDir/dirname(ref)
```

## 修复的真实问题 (iter-050a P0 8 个 blocker 中 3 个)

| # | 描述 | 触发文件 |
|---|------|---------|
| 6 | `src/views/dashboard/admin/components/TodoList/index.scss` 缺失 | `<style lang="scss">@import './index.scss'</style>` |
| 7 | `src/directive/waves/waves.css` 缺失 | `directive/waves/waves.js` 里 `import './waves.css'` |
| 8 | `src/icons/svg/*.svg` 47 个缺失 | `icons/index.js` 里 `import.meta.glob('./svg/*.svg')` |

## 复制策略

- 只复制 outDir **缺**的文件 (不覆盖用户已改的)
- 写入 outDir 同样相对路径 (保持 `<style>` 里 `@import './index.scss'` 还能 resolve)
- 写入到 `ctx.config.outDir` (有 outDir) 或 `ctx.root` (in-place 模式)
- `dryRun` 模式只 print, 不写
- 失败 file 不抛, 静默 + 计数

## 文件结构

```
src/
├── index.ts                # 插件入口
└── __tests__/
    └── test-resource-copier.ts  # 43 个 unit test
```

## 测试

`packages/plugins/resource-copier/src/__tests__/test-resource-copier.ts` — 43 个测试覆盖:
- `@import './foo.scss'` / `@import "./foo.scss"` 各种形式
- `import './foo.css'` 在 `<script>` 块
- `import.meta.glob('./svg/*.svg')` glob 展开
- `import.meta.globEager` / `globRaw` 兼容
- `require.context('./svg', false, /\.svg$/)` 兼容
- 缺文件静默容错
- 不覆盖已存在文件
- dryRun 模式

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-resource-copier'
```

priority: **50** (在 package-json / vite-scaffold 之后, 其他 plugin 之前)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| vite-scaffold (iter-049a) | 生成 vite.config.js / index.html / public/ |
| **resource-copier** (iter-050a) | **复制 @import / import './' / import.meta.glob 引用的资源** |
| composition / elementui / store-bridge | 代码转换 (不碰资源) |
| this-replacer / vue3-template | 代码 review (不碰资源) |
