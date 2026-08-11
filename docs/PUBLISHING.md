# 发布流程 / Publishing Guide

vue-migrate 是一个 **monorepo** (pnpm workspace), 由 18 个 plugin + core + cli 组成。本文档说明:
1. 怎么本地 build 单个 package
2. 怎么本地 build 全部
3. 怎么 release 到 npm (manual)
4. 怎么跑 CI 流程

---

## 1. 单个 Package Build

每个 plugin 在 `packages/plugins/<name>/tsconfig.json` 都有 `outDir: ./dist`, 但 **没有 `build` script**。当前默认用 `tsx` 直接跑 `.ts` (开发模式), 不生成 `.js`。

### 加 build script (per-package)

参考修改:

```json
// packages/plugins/<name>/package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "tsx src/__tests__/test-<name>.ts"
  }
}
```

### 单个 build

```powershell
cd D:\Projects\NB_EST\qiuzhi\vue-migrate\packages\plugins\composition
pnpm build
# 产物: dist/index.js + dist/index.d.ts + dist/__tests__/*.js
```

---

## 2. 全部 Build (monorepo)

根 `package.json` 已有 `pnpm -r build`:

```powershell
cd D:\Projects\NB_EST\qiuzhi\vue-migrate
pnpm -r build
```

会递归跑每个 package 的 `build` script (需要每个 package 都有 build script)。

### 当前状态

- 18 个 plugin 中 **0 个**有 `build` script (默认 tsx)
- 加了 build script 后, 输出在 `packages/plugins/<name>/dist/`
- dist 目录默认 gitignored (跟 node_modules 一样)

---

## 3. 本地试运行 (推荐)

不需要 build 也能跑 vue-migrate (tsx 直接吃 .ts):

```powershell
# 单文件扫描
& ".\packages\cli\node_modules\.bin\tsx.cmd" ".\packages\cli\src\index.ts" "transform" "D:\path\to\vue2\project" "--out" "D:\path\to\output" "--only-changed"
```

```bash
# 全功能
pnpm dev
# 或
pnpm --filter @vue-migrate/cli dev
```

---

## 4. Release 到 npm (manual)

### 4.1 前置

1. 在 [npmjs.com](https://www.npmjs.com/) 注册账号
2. `npm login` 登录
3. 选择要发布的包 (monorepo 单独发布)
4. **version bump**: 改 `packages/<pkg>/package.json` 的 `"version"`
5. **build**: `pnpm --filter @vue-migrate/<pkg> build`
6. **pack 验证**: `pnpm pack --pack-destination $env:TEMP`
7. **publish**:
   ```powershell
   # dry-run
   pnpm publish --dry-run --filter @vue-migrate/<pkg>
   # 实际发布
   pnpm publish --access public --filter @vue-migrate/<pkg>
   ```

### 4.2 发布顺序

vue-migrate 各 package 有依赖关系, 发布顺序:

```
core (no deps)
  ↓
plugins/* (deps on core)
  ↓
cli (deps on all plugins)
```

### 4.3 版本号策略 (semver)

- **MAJOR** bump: plugin 行为不兼容变化 (e.g. 新规则改变了已有 output 形式)
- **MINOR** bump: 新增 plugin / 新增规则 / 新文档
- **PATCH** bump: bug fix / tsc 修复 / 文档 typo

---

## 5. CI 流程 (建议但未实施)

未来可加 `.github/workflows/ci.yml` (当前不存在):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 25
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm tsx _dbg/check-all-tsc.mjs
      - run: pnpm tsx _dbg/check-all-tests.mjs
```

**当前未实施原因**: 
- tsc / tests 已经在本地 cron 验证 (每 10 分钟 + 每 30 分钟)
- 跑 CI 主要价值: PR 检查 + 跨平台测试 (linux/macOS)
- 优先级: P3 (CI 不是阻塞,文档/CI 文件准备好后用户/未来维护者按需启用)

---

## 6. 发布 Checklist

发布前:

- [ ] `pnpm tsx _dbg/check-all-tsc.mjs` → 0 errors
- [ ] `pnpm tsx _dbg/check-all-tests.mjs` → 619/619 pass
- [ ] `git log --oneline -5` 看最近 5 个 commit
- [ ] `git status -s` 确认 working tree clean
- [ ] `git push origin HEAD` 推到 GitHub
- [ ] `git ls-remote origin HEAD` 验证远端
- [ ] 选 package, bump version, build, pack, publish (4.1)

发布后:

- [ ] npm 页面看版本
- [ ] GitHub release (建议,可选)
- [ ] 更新 CHANGELOG.md (已有 iter-060 起,持续维护)

---

## 7. 发布频率建议

- **频繁发布**: P0 阻塞 fix / P1 关键 plugin 增
- **季度发布**: P2 新样本 / P3 文档优化
- **不发布**: 内部重构 (no user-visible change)

当前最新已发布版本: 无 (项目仍在 0.1.0 内部迭代)。

---

## 关联文档

- [README.md](../README.md) — 项目总览
- [CHANGELOG.md](../CHANGELOG.md) — 版本变更日志
- [PLUGIN_GUIDE.md](./PLUGIN_GUIDE.md) — 18 plugin 总览
- [SELF_EVOLVING_ARCHITECTURE.md](./SELF_EVOLVING_ARCHITECTURE.md) — 自演化系统架构
