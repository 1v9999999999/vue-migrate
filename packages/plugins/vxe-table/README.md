# @vue-migrate/plugin-vxe-table

vxe-table 3 (Vue 2) → vxe-table 4 (Vue 3) 转换 plugin (iter-031)。

## 背景

vxe-table 4 跟 v3 差异相对小, 大部分 config prop (sort-config / column-config / edit-config 等) 兼容, 但有两处不兼容改写:

1. **CSS import 路径** — `vxe-table/lib/index.css` 改名为 `vxe-table/lib/style.css`
2. **template 子组件名** — `<vxe-table-column>` 改名为更短的 `<vxe-column>`

主包 `'vxe-table'` 同名 import 不变, `VXETable` 这个默认导入名 v4 仍能跑(不强制改名为 `VxeUITable`)。

## 负责规则

| 编号 | 规则 | 自动化程度 | 改写形式 |
|------|------|----------|---------|
| VT.1 | `import 'vxe-table/lib/index.css'` | ✅ 自动 | `'vxe-table/lib/style.css'` (AST 改 source.value + raw) |
| VT.2 | `<vxe-table-column>` open/close tag | ✅ 自动 | `<vxe-column>` (走 vue3-template 的 applyEdits, 一次处理) |

## VT.2 实现要点 (iter-031 三次踩坑)

### VT-3: open + close tag 必须同时改

```vue
<!-- BEFORE -->
<vxe-table-column prop="name">姓名</vxe-table-column>

<!-- AFTER (正确) -->
<vxe-column prop="name">姓名</vxe-column>
```

第一次实现只改了 open tag `<vxe-table-column>`, 留下 `</vxe-table-column>` close tag, 模板解析报错。修复: 用 `el.closeStart + 2` 跳过 `</` 两个字符, 单独给 close tag 追加一个 edit。

### VT-4: edit replacement 不能含 attrs

```typescript
// 错误实现
edits.push({
  start: el.openStart, end: el.tagNameEnd,
  replacement: `<${NEW_TAG} ${el.attrs}>`  // 错误! attrs 已经保留在 [tagNameEnd, openEnd] 之间
})

// 正确实现
edits.push({
  start: el.openStart, end: el.tagNameEnd,  // 只到 tagName 末尾, 不动 attrs
  replacement: `<${NEW_TAG}`
})
```

`el.openStart..el.tagNameEnd` 这一段就是 tagName, attrs 留到下次 edit 处理。replacement 只放新 tag 名, attrs 不掺进来。

### selfClosing 跳过 close tag

```vue
<vxe-table-column prop="name" />
```

self-closing 元素没有 `</vxe-table-column>`, 检查 `!el.selfClosing && el.closeStart >= 0` 才追加 close tag edit。

## 关键实现

### VT.1: AST 改 source

```typescript
// CSS 路径
if (src === OLD_CSS) {
  node.source.value = NEW_CSS
  // babel 用 raw 字符串输出, 必须同步, 否则 codegen 用旧 raw 输出
  if (node.source.extra) node.source.extra.raw = `'${NEW_CSS}'`
  else node.source.raw = `'${NEW_CSS}'`
}
```

**为什么 raw 必须改?** babel 的 StringLiteral node 同时维护 `value` 和 `raw`, codegen 用 raw 字符串原样输出。只改 value 不改 raw 会导致源里是 `'vxe-table/lib/index.css'`, 改完 value 内存中是 `style.css` 但输出还是旧 CSS — 白改。

### VT.2: 借用 vue3-template 工具

```typescript
import { scanAllElements } from '../../../vue3-template/src/utils/template-scanner.js'
import { applyEdits } from '../../../vue3-template/src/utils/template-editor.js'

const all = scanAllElements(template)  // 扫出所有 element 含 openStart/tagNameEnd/closeStart
for (const el of all) {
  if (el.tagName !== OLD_TAG) continue
  edits.push({ start: el.openStart, end: el.tagNameEnd, replacement: `<${NEW_TAG}` })
  if (!el.selfClosing && el.closeStart >= 0) {
    const closeTagNameStart = el.closeStart + 2
    edits.push({ start: closeTagNameStart, end: closeTagNameStart + OLD_TAG.length, replacement: NEW_TAG })
  }
}
return { out: applyEdits(template, edits), changed: true, changes }
```

**为什么走 vue3-template 的工具, 不自己解析?** 模板里有自闭合、嵌套、属性跨多行、属性值含 `<` 等 corner case, 自己写 parser 容易踩坑。复用 vue3-template 的 scanAllElements / applyEdits, 所有 corner case 已经在 vue3-template 那边验证过。

## 文件结构

```
src/
├── index.ts                                  # 插件入口, 调 2 个 rule
├── types-shim.d.ts
└── rules/
    ├── import-path.ts                        # VT.1
    └── template.ts                           # VT.2
└── __tests__/
    └── test-vxe-table.ts                     # 13 case
```

## 测试

跑 13 个 case:
- VT.1: CSS 路径改写 / 已改过不重复 / 不匹配不动 / 主包 import 不动
- VT.2: open tag 改名 / close tag 改名 / 自闭合 / 嵌套 / 多属性 / 不匹配不动

`packages/plugins/vxe-table/src/__tests__/test-vxe-table.ts`

## 实测

iter-058 跑 vue-element-admin-master 195 源文件:
- vxe-table 0 触发 (master 不用 vxe-table, 用 ElementUI 自带 table)
- iter-031 验证时是 196 路由表项目, vxe-table-column → vxe-column 改写 N 次, 0 false positive

## 注册

`packages/cli/src/index.ts`:
```typescript
import '@vue-migrate/plugin-vxe-table'
```

priority: **8** (在 vue3-template(9) 之后, 其它 plugin 之前)。

## 跟其他 plugin 的关系

| Plugin | 处理 |
|--------|------|
| vue3-template | 提供 `template-scanner` / `template-editor` 工具, 本 plugin 复用 |
| elementui | `<el-table-column>` 不动, 跟 vxe-table-column 是不同组件 |
| 3rd-party-imports | 不动 vxe-table (主包同名 + CSS 路径由本 plugin VT.1 处理) |
| package-json | 加 `vxe-table` 4.x 依赖到 dependencies |

## 边界 / 已知限制

- **config prop 不改**: v3 的 `sort-config` / `column-config` v4 仍兼容同名, 不在本 plugin 范围
- **过滤参数 `filter-config`**: 同上, v4 兼容
- **`VXETable` 默认名**: 不强制改为 `VxeUITable` (v4 仍能跑, 改不改是用户偏好)
- **icon / pager 子组件**: `vxe-pager` / `vxe-toolbar` 等 v4 同名, 不在本 plugin 范围
- **TypeScript 类型**: `vxe-table` 4.x 的 .d.ts 已经 Vue 3 兼容, 本 plugin 不动
- **老 v2 版本 (vxe-table < 3)**: 路径和组件名都不一样, 超出本 plugin 范围, 需用户手动升级
