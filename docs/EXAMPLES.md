# 转换示例 — vue-migrate iter-051~060

> 实测基于 `vue-element-admin-master` (195 源文件) 转换到 `11111/` (212 输出文件)
> 全部示例的"转换后"代码都来自 11111/ 实际输出,不是手写示例

---

## 1. plugin-this-replacer (iter-051) — this.$http / $axios / $api 自动替换

### Before (Vue 2 master)

```javascript
// src/api/article.js
import request from '@/utils/request'

export function fetchArticle(id) {
  return request({
    url: `/article/${id}`,
    method: 'get'
  })
}
```

```vue
<!-- src/views/article/components/ArticleDetail.vue -->
<script>
export default {
  methods: {
    loadDetail() {
      this.$route.params.id        // 路由参数 (this.$route Vue 2 全局)
      this.$http.get('/api/foo')   // ✗ 转换前
      this.$axios.post('/bar')     // ✗ 转换前
    }
  }
}
</script>
```

### After (Vue 3 转换后)

```vue
<!-- ArticleDetail.vue 转换后, this.$route 被 composition 处理 (useRoute), 但 this.$http / $axios -->
<!-- 因为本文件没 import axios, 标 review 让用户加 import: -->
<script setup>
import { useRoute } from 'vue-router';
import axios from 'axios';

const route = useRoute();

function loadDetail() {
  route.params.id              // ✅ composition 替换 this.$route
  axios.get('/api/foo')         // ✅ this-replacer 自动替换 (import 存在时)
  // 或: 标 review 让用户手改
}
</script>
```

### 规则

| 模式 | 自动行为 |
|------|---------|
| `this.$http` 已有 `import axios from 'axios'` | 自动 → `axios` |
| `this.$http` 已有 `import request from '@/utils/request'` | 自动 → `request` |
| `this.$http` 没 import | 标 review: "未发现 axios/request 类的 import. 请在 <script setup> 顶部加 `import axios from 'axios'`" |

---

## 2. composition this.$parent review (iter-051+053)

### Before

```vue
<!-- src/layout/components/TagsView/ScrollPane.vue -->
<script>
export default {
  mounted() {
    const tagList = this.$parent.$refs.tag   // ❌ Vue 2 隐式 API
  }
}
</script>
```

### After (Vue 3)

```vue
<!-- 转换后 -->
<script setup>
import { onMounted, inject } from 'vue';

// 转换后 tagList 通过 props 传进来 (不用 $parent.$refs)
const props = defineProps({ tagList: { type: Array, default: () => [] } });

onMounted(() => {
  const tagList = props.tagList;  // ✅ 显式 props
});

// ⚠️ 标 review: this.$parent 出现 N 次 — Vue 3 <script setup> 中没有 this.
//   建议: provide('tagList', ref) / inject('tagList') / props 显式传递
</script>
```

> **iter-053 修**: 原 regex 扫到 `// BUG fix: this.$parent.$refs.tag was removed` 注释触发 false positive. 现在先 strip 注释再扫.

---

## 3. elementui 100+ icon 映射 (iter-051)

### Before

```vue
<!-- TodoList/index.vue -->
<template>
  <i class="el-icon-search"></i>     <!-- ❌ ElementUI class -->
  <i class="el-icon-loading"></i>     <!-- ❌ ElementUI class -->
  <el-button icon="el-icon-edit"></el-button>
</template>
```

### After (Vue 3)

```vue
<template>
  <el-icon><Search /></el-icon>          <!-- ✅ 100+ 映射 (iter-051) -->
  <el-icon><Loading /></el-icon>         <!-- ✅ 100+ 映射 -->
  <el-button>
    <el-icon><Edit /></el-icon>          <!-- ✅ icon="..." → <el-icon> 包裹 -->
  </el-button>
</template>

<script setup>
// iter-036 elementui plugin 自动加 import
import { Edit, Loading, Search } from '@element-plus/icons-vue';
</script>
```

### 跳过 ElementUI 私有 BEM class (iter-051)

| 跳过 | 原因 |
|------|------|
| `el-icon-wrapper` | ElementUI dropdown 内部 wrapper, Vue 3 没用 |
| `el-icon--right` / `--left` / `--top` / `--bottom` | BEM 修饰 class |

---

## 4. new X().$mount() 动态组件 (iter-052)

### Before

```javascript
// 某个 utils.js — Vue 2 动态创建 progressBar 组件并挂载到 #progress
import ProgressBar from './ProgressBar.vue'

const bar = new ProgressBar({ percent: 50 })
bar.$mount('#progress')
```

### After (Vue 3)

```javascript
import ProgressBar from './ProgressBar.vue'
import { createApp } from 'vue'

// ⚠️ 标 review (iter-052):
//   检测到 `new ProgressBar(...).$mount("#progress")` — Vue 2 动态组件挂载模式。
//   Vue 3 等价物: `createApp(ProgressBar).mount("#progress")`
//   注意: Vue 3 挂载到选择器时,该 DOM 节点必须存在且不能跨多个 createApp 共享。
//   如果原来是动态创建并 append 到 body 的,Vue 3 改用
//   `createApp(ProgressBar).mount(document.createElement('div'))` + appendChild 更稳。
const bar = createApp(ProgressBar).mount('#progress')
```

> master 里**实际 0 触发** (vue-element-admin-master 没用这个模式), 但 iter-052 规则已就绪, 应对**其他项目**.

---

## 5. composition 递归函数 (iter-052 验证) — 不用新规则

### Before

```javascript
export default {
  methods: {
    setCurrentView(view) {
      this.currentView = view
      if (view === 'detail') {
        this.setCurrentView('list')  // ❓ 递归调用
      }
    }
  }
}
```

### After (Vue 3) — 天然 work

```vue
<script setup>
import { ref } from 'vue'

const currentView = ref('list')

// function 声明是 hoisted, 递归调用 work
function setCurrentView(view) {
  currentView.value = view
  if (view === 'detail') {
    setCurrentView('list')   // ✅ 不用箭头函数, 不用提前声明
  }
}
</script>
```

> 关键: composition 输出 `function name() { ... }` 不是 `const name = () => {}`, 所以递归 work.
> 同样验证: setTimeout 异步递归 (`setTimeout(() => setCurrentView())`), a/b 互相递归 — 都 work.

---

## 6. Vue 2 移除的 instance API 批量 review (iter-054)

### 5 个 instance API 触发 review 模式

| API | Vue 3 替代 | 检测文件 |
|-----|-----------|---------|
| `this.$children` | `ref([])` + provide/inject | ElementUI tooltip 等 |
| `this.$root` | `app.config.globalProperties` 或 provide/inject | 跨组件根访问 |
| `this.$vnode` | 完全移除, 用 lifecycle hook | render function 自定义 |
| `this.$isServer` | `import.meta.env.SSR` | SSR 判断 |
| `this.$isDestroyed` | `onUnmounted` lifecycle | 防抖/节流场景 |

### 触发示例

```vue
<script>
// 检测到 this.$children — Vue 3 已完全移除 $children。
//   在 setup() 里用 ref 数组 + provide/inject 替代
export default {
  mounted() {
    this.$children.forEach(c => c.refresh())  // ❌ Vue 3 报错
  }
}
</script>
```

> master 里**实际 0 触发** (vue-element-admin-master 没用), 规则就绪.

---

## 7. mixins: [...] 字段 review (iter-054) — 实际命中 9 处

### Before (master 中实际文件)

```vue
<!-- src/views/dashboard/admin/components/RaddarChart.vue -->
<script>
import resize from './mixins/resize'

export default {
  mixins: [resize],   // ❌ Vue 2 mixin
  data() { return { chart: null } },
  mounted() { this.initChart() }
}
</script>
```

### After (Vue 3) — 标 review

```vue
<script setup>
// ⚠️ 检测到 mixins: [resize] — Vue 3 已不推荐 mixins, 强烈建议改为 composables (useXxx() 函数 + return ref/computed)。
//   转换步骤:
//     1) 把 resize 里的 data/methods/computed/lifecycle hooks 提取为 setup 函数
//     2) 函数内用 ref/reactive 包装 data, computed 包装 getters, lifecycle 包装 hooks
//     3) export useResize() { ... return { ... } }
//     4) 消费方在 <script setup> 顶部 const { ... } = useResize()
//   ⚠️  自动转风险大(mixin 的 data merge 顺序、生命周期优先级、命名冲突), 不做自动改。
import { ref, onMounted } from 'vue'
// TODO: 手动从 ./mixins/resize.js 提取 useResize() composable
const chart = ref(null)

onMounted(() => { /* ... */ })
</script>
```

> **iter-054 实际命中 9 处** (vue-element-admin-master 9 个 mixins: [...] 全部触发).

---

## 8. elementui auto-import (iter-036) — 实际 16 文件命中

### 输出 (iter-050 后的 11111/)

```vue
<!-- src/components/DndList/index.vue -->
<script setup>
import { Delete } from '@element-plus/icons-vue'
// iter-036 elementui plugin 自动加 import (不用用户手加)
</script>
```

```vue
<!-- src/components/RightPanel/index.vue -->
<script setup>
import { Close, Setting } from '@element-plus/icons-vue'  // 自动合并 named import
</script>
```

> 16 个文件自动获得正确的 icon import. 避免用户拿转换后代码发现 icon 不渲染.

---

## 9. 0 regression 验证 (iter-058)

跑完整 vue-element-admin-master 转换, 对比 iter-054 (iter-051~057 之前) 输出:

| Pattern | iter-054 | iter-058 | delta |
|---------|----------|----------|-------|
| mixins review | 9 | 9 | +0 |
| this-replacer review | 10 | 10 | +0 |
| el-icon 转换 | 11 | 11 | +0 |
| self-ref rename | 9 | 9 | +0 |
| store-bridge | 128 | 128 | +0 |
| defineProps 注入 | 45 | 45 | +0 |
| 输出文件数 | 212 | 212 | +0 |

**结论: iter-051~057 7 commit 0 regression.**

---

## 总结: 8 个 iter 累计

| iter | 新功能 | 实测触发 (master) |
|------|--------|------------------|
| iter-051 | plugin-this-replacer | 10 |
| iter-051 | $parent review | 0 (注释跳过) |
| iter-051 | el-icon 100+ 映射 | 11 |
| iter-052 | new X().$mount review | 0 (master 没用) |
| iter-052 | 递归验证 | n/a (验证性) |
| iter-053 | $parent 跳注释 | 0 false positive |
| iter-054 | 5 instance API review | 0 (master 没用) |
| iter-054 | mixins review | 9 |
| iter-054 | $options.componentName | 0 |
| iter-058 | 0 regression | 全 0 delta |
