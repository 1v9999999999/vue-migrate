# ElementUI → Element Plus 规则目录

**40 条规则**。plugin: `packages/plugins/elementui/`, priority 25。

## 组件名重命名

| # | 规则 | ElementUI | Element Plus |
|---|---|---|---|
| 1 | Button | `<el-button>` | `<el-button>`（相同） |
| 2 | Input | `<el-input>` | 相同 |
| 3 | Select | `<el-select>` | 相同 |
| 4 | Table | `<el-table>` | 相同 |
| 5 | Form | `<el-form>` | 相同 |
| 6 | Dialog | `<el-dialog>` | 相同 |
| 7 | Pagination | `<el-pagination>` | 相同 |
| 8 | Menu | `<el-menu>` | 相同 |
| 9 | DatePicker | `<el-date-picker>` | 相同 |
| 10 | Cascader | `<el-cascader>` | 相同 |
| 11 | Tree | `<el-tree>` | 相同 |
| 12 | Upload | `<el-upload>` | 相同 |
| 13 | Dropdown | `<el-dropdown>` | 相同 |
| 14 | Tabs | `<el-tabs>` | 相同 |
| 15 | Steps | `<el-steps>` | 相同 |

## 属性差异

| # | 规则 | ElementUI | Element Plus |
|---|---|---|---|
| 16 | `size` 取值 | medium / small / mini | default / small / large |
| 17 | `type` 取值扩展 | primary / success / warning / danger / info | 同 + 5 种新增 |
| 18 | `placement` 改 `position` | `placement="top"` | `placement` 在 popper 中保留 |
| 19 | `popper-append-to-body` 改 `append-to-body` | 旧名 | 改名 |
| 20 | `custom-class` 改 `class` | 仅 el-message | 直接用 class |
| 21 | `center` 属性 | dialog only | dialog 仍支持 |
| 22 | `show-close` 必填 | 可选 | 默认 false |

## 事件差异

| # | 规则 | ElementUI | Element Plus |
|---|---|---|---|
| 23 | `current-change` 保留 | — | 保留 |
| 24 | `selection-change` 保留 | — | 保留 |
| 25 | `sort-change` payload | `{ column, prop, order }` | 相同 |
| 26 | `input` 事件 | 触发 v-model | 相同 |
| 27 | `update` 事件 | 部分组件 | 全部统一 |
| 28 | `visible-change` 改 `update:modelValue` | dialog/drawer | dialog/drawer |

## 样式导入

| # | 规则 | ElementUI | Element Plus |
|---|---|---|---|
| 29 | CSS 路径 | `element-ui/lib/theme-chalk/index.css` | `element-plus/dist/index.css` |
| 30 | CSS 路径（旧版） | `element-ui/lib/theme-default/index.css` | 同上 |
| 31 | 按需引入 | `babel-plugin-component` | `unplugin-vue-components` |
| 32 | 字体图标 | `el-icon-xxx` 类 | `<el-icon><Xxx /></el-icon>` |

## 全局方法

| # | 规则 | ElementUI | Element Plus |
|---|---|---|---|
| 33 | `this.$message.success()` | 全局方法 | 仍支持 |
| 34 | `this.$message.error()` | 全局方法 | 仍支持 |
| 35 | `this.$notify.error()` | 静态方法 | `ElNotification({ type: 'error' })` |
| 36 | `this.$alert` / `confirm` / `prompt` | `MessageBox` | 仍支持 |
| 37 | `this.$msgbox` | 同上 | 仍支持 |
| 38 | Loading 指令 `v-loading` | 全局 | 仍支持 |
| 39 | `ElMessage(options)` 静态 | — | 同 `$message` |
| 40 | `ElMessageBox(options)` 静态 | — | 同 `$msgbox` |

## Icon 转换（详细）

**触发模式**:
```html
<!-- Vue 2 -->
<i class="el-icon-search" />
<i class="el-icon-search my-class" />
<i class="el-icon-edit some-icon"></i>
```

**转换结果**:
```html
<!-- Vue 3 -->
<el-icon><Search /></el-icon>
<el-icon class="my-class"><Search /></el-icon>
<el-icon class="some-icon"><Edit /></el-icon>
```

**关键实现**:
- 用 `el.start..el.end` 取**整个 element 范围**（不是 `el.tagNameStart..tagNameEnd` 只取 tag name）
- 类名解析：去掉 `el-icon-xxx` 前缀，剩余类合并到 `<el-icon>` 上
- 名称映射：`search` → `Search`（PascalCase）
- 未识别的 icon name 走 review note

## 已知 issue

见 `KNOWN_ISSUES.md`：
- `#1 $notify.error()` 没有对应方法
- `Element Plus v2.4+` 部分组件 prop 重命名未在规则里
