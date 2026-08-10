# @vue-migrate/plugin-elementui

ElementUI 2.x (Vue 2) → Element Plus (Vue 3) 自动转换插件。

## 已实现的规则

| 编号 | 规则 | 状态 |
|------|------|------|
| E.1 | `import 'element-ui'` → `'element-plus'` | ✅ |
| E.2 | `import { X } from 'element-ui'` → 同名 from 'element-plus' | ✅ |
| E.3 | CSS 路径调整 | ✅ |
| E.5 | `size="medium"` → `"default"` | ✅ |
| E.8 | `this.$message` → `ElMessage` | ✅ |
| E.9 | `this.$msgbox` → `ElMessageBox` | ✅ |
| E.10 | `this.$notify` → `ElNotification` | ✅ |
| E.11 | `this.$alert/$confirm/$prompt` → `ElMessageBox.alert/.confirm/.prompt` | ✅ |
| E.12 | `this.$loading` → `ElLoading` | ✅ |
| E.13 | `size="mini"` → `"small"` | ✅ |
| E.16 | `<el-dialog :visible.sync>` → `v-model` | ✅ |
| E.17 | `<el-drawer :visible.sync>` → `v-model` | ✅ |
| E.25 | `<el-submenu>` → `<el-sub-menu>` | ✅ |

## 标 review（不自动改）

| 编号 | 规则 | 原因 |
|------|------|------|
| E.6 | `class="el-icon-xxx"` | 需要用 icon 组件形式 |
| E.27 | `icon="el-icon-xxx"` 属性 | 需要用 icon 组件形式 |
| E.31 | `:current-page.sync` | 标 review |
| E.34 | `this.$refs.formRef.validate(cb)` | 回调→Promise 需人工 |
| E.36 | `<el-upload :before-upload>` | 签名变化 |
| E.38 | 自定义主题 | 需重新配置 |

## 关键设计

- **import 路径**：用 babel traverse 改 `ImportDeclaration.source`
- **默认导入改名**：用 babel traverse 改所有 `Identifier.name`（排除 import 声明里的源 ident）
- **this.$xxx 替换**：用 babel traverse 改 `MemberExpression.object`（this → ElXxx）
- **自动 import**：先扫用到哪些 API，再补 import
- **template**：复用 vue3-template 的 scanner + sfc-source 工具，避免重复造轮子

## 输入/输出示例

### 输入

```vue
<script>
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import { Message } from 'element-ui'

export default {
  methods: {
    submit() {
      this.$message.success('ok')
      this.$alert('hi', 'title')
    }
  }
}
</script>

<template>
  <el-dialog :visible.sync="show" size="medium">
    <el-button icon="el-icon-search">搜索</el-button>
  </el-dialog>
  <el-submenu index="1">
    <el-menu-item index="1-1">子项</el-menu-item>
  </el-submenu>
</template>
```

### 输出

```vue
<script>
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { ElMessage, ElMessageBox } from 'element-plus'

export default {
  methods: {
    submit() {
      ElMessage.success('ok')
      ElMessageBox.alert('hi', 'title')
    }
  }
}
</script>

<template>
  <el-dialog v-model="show" size="default">
    <el-button>搜索</el-button>  <!-- icon 标 review -->
  </el-dialog>
  <el-sub-menu index="1">
    <el-menu-item index="1-1">子项</el-menu-item>
  </el-sub-menu>
</template>
```

## 已知限制

- 工具类 utils（template-scanner / sfc-source）从 vue3-template 复制，**未做去重**。后续 core 可以统一抽到 core 包。
- `<el-button icon="el-icon-xxx">` 仅标 review，未自动改成 icon 组件形式（语义变化大）。
- 不处理 ElementUI 的 locale 配置（需人工）。
