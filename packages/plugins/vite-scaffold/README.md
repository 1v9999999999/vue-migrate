# @vue-migrate/plugin-vite-scaffold

iter-049a P0 #1/#2/#3 新增 plugin — Vue CLI → Vite 转换后, 自动生成 `vite.config.js` / `index.html` / `public/`, 否则 `npm run dev` / `npm run build` 跑不起来。

## 背景

Vue CLI 转换到 Vite 后, **package.json 已经改用 vite**, 但项目根目录还缺:
- `vite.config.js` (Vite 配置)
- `index.html` (Vite 入口, 不是 Vue CLI 的 public/index.html)
- `public/favicon.ico` (Vite 把 public/ 当 static assets)

如果不补这三个, `npm run dev` 报 `Cannot find vite.config.js`, 转换后的项目根本起不来。

vite-scaffold 负责这个 P0 修复。

## 负责规则

| 编号 | 规则 | 自动化程度 |
|------|------|----------|
| S.1 | 缺 `vite.config.js` → 自动生成 (defineConfig + plugins: [vue()]) | ✅ 自动 |
| S.2 | 缺 `index.html` → 自动生成 (推断入口 src/main.js 或 src/main.ts) | ✅ 自动 |
| S.3 | 缺 `public/` 目录 → 自动从原项目 public/ 复制 | ✅ 自动 |
| S.4 | 缺 `public/favicon.ico` → 同 S.3 | ✅ 自动 |
| S.5 | 仍存在 `vue.config.js` (Vue CLI 配置) + scripts 已改 vite → 删除 vue.config.js + 标 review | ✅ 自动 |
| S.6 | 存在 `babel.config.js` + 有 vite + 没用到 babel → 删除 | ✅ 自动 |
| S.7 | 标 review 提示用户检查 webpack-only 配置 (mock-server 等) | ⚠️ review |

## 触发条件 (任一)

- `package.json` 的 `scripts` 出现 `vite` / `vite build` / `vite xxx`
- `package.json` 的 `devDependencies` 包含 `vite` 或 `@vitejs/plugin-vue`
- 转换后 `ctx.config.outDir` 路径里有 `vite` 信号

## 关键实现

```typescript
// 1) 检测: packageUsesVite() / packageHasViteDeps() / isViteProject()
// 2) buildViteConfigTemplate()  生成 vite.config.js
//    - defineConfig({ plugins: [vue()] })
//    - alias: { '@': fileURLToPath(...) }
//    - 推断端口 (从 dev script 提取)
// 3) buildIndexHtmlTemplate()  生成 index.html
//    - <div id="app"></div>
//    - <script type="module" src="/src/main.js"></script>  (fallback main.ts)
// 4) inferMainEntry()  推断入口 (main.js / main.ts)
// 5) copyPublicDir()  从原项目 public/ 复制到 outDir/public/
// 6) deleteVueConfig()  / deleteBabelConfig()
```

## 输出示例

`vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" href="/favicon.ico" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vue App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

`public/`:
- `favicon.ico` (从原项目复制)
- 其他 static assets (svg / png / ico)

## 文件结构

```
src/
├── index.ts                # 插件入口
└── __tests__/
    └── test-vite-scaffold.ts  # 54 个 unit test
```

## 测试

`packages/plugins/vite-scaffold/src/__tests__/test-vite-scaffold.ts` — 54 个测试覆盖:
- vite config 生成 (alias / plugins / port)
- index.html 生成 (主入口推断)
- public/ 复制 (深拷贝)
- vue.config.js / babel.config.js 删除条件
- manualReview 提示
- 跨平台路径 (Windows + POSIX)

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-vite-scaffold'
```

priority: **99** (在 package-json 之后跑, package-json 先把 scripts 切到 vite, vite-scaffold 再决定要不要 scaffold)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| package-json (iter-050) | 改 `scripts: { dev: 'vite', build: 'vite build' }` + 加 vite 依赖 |
| **vite-scaffold** (iter-049a) | **生成 vite.config.js / index.html / public/** |
| resource-copier (iter-050) | `@import` / `import.meta.glob` 资源自动复制 |
| vite-compat (iter-048) | `process.env` → `import.meta.env.MODE`, `require()` → `await import()` |
