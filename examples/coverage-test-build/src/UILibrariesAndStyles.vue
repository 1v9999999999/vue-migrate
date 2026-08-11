<!--
  Vue 2 写法穷举 — UILibrariesAndStyles.vue
  iter-086: P3 验证 — 3rd-party UI (element-ui / ant-design / wangeditor / sortablejs) +
  多 style 块 (scoped + global + module) + CSS 特殊 (::v-deep / :deep() / CSS var / @keyframes) +
  custom directive 各种 hook + element-ui icon class
-->
<template>
  <div class="root">
    <!-- ============ 1. element-ui 组件 (iter-036 elementui 改 element-plus) ============ -->
    <section>
      <h3>1. element-ui 组件</h3>
      <el-button type="primary" @click="onClick">Primary</el-button>
      <el-button type="success" size="mini">Success Mini</el-button>
      <el-button-group>
        <el-button>L</el-button>
        <el-button>M</el-button>
        <el-button>R</el-button>
      </el-button-group>

      <el-form :model="loginForm" :rules="rules" ref="loginForm" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="loginForm.username" placeholder="请输入" clearable />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="loginForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSubmit">提交</el-button>
          <el-button @click="onReset">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="rows" stripe border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="status" label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="{ row, $index }">
            <el-button type="text" @click="onEdit(row)">编辑</el-button>
            <el-button type="text" @click="onDelete(row, $index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :total="total"
        :page-size="pageSize"
        :current-page.sync="currentPage"
        layout="total, sizes, prev, pager, next, jumper"
      />
    </section>

    <!-- ============ 2. element-ui icon class (iter-036 + iter-051 el-icon 映射) ============ -->
    <section>
      <h3>2. element-ui icon class</h3>
      <i class="el-icon-edit"></i>
      <i class="el-icon-delete"></i>
      <i class="el-icon-search"></i>
      <i class="el-icon-plus"></i>
      <i class="el-icon-close"></i>
      <i class="el-icon-refresh"></i>
      <i class="el-icon-loading"></i>
      <i class="el-icon-success"></i>
      <i class="el-icon-warning"></i>
      <i class="el-icon-error"></i>
      <i class="el-icon-arrow-up"></i>
      <i class="el-icon-arrow-down"></i>
      <i class="el-icon-caret-top"></i>
      <i class="el-icon-caret-bottom"></i>
      <i class="el-icon-view"></i>
      <i class="el-icon-star-on"></i>
      <i class="el-icon-star-off"></i>
      <i class="el-icon-goods"></i>
      <i class="el-icon-news"></i>
      <i class="el-icon-warning-outline"></i>
      <i class="el-icon-upload"></i>
      <i class="el-icon-download"></i>
      <i class="el-icon-question"></i>
      <i class="el-icon-circle-check"></i>
      <i class="el-icon-circle-close"></i>
      <!-- 嵌套 + modifier -->
      <i :class="['el-icon-check', { 'is-loading': loading }]" @click="toggleLoading"></i>
    </section>

    <!-- ============ 3. ant-design-vue 组件 (迁移到 ant-design-vue 3.x) ============ -->
    <section>
      <h3>3. ant-design-vue 组件</h3>
      <a-button type="primary" @click="onAClick">Primary</a-button>
      <a-button type="default" size="small">Small</a-button>
      <a-button-group>
        <a-button>L</a-button>
        <a-button>M</a-button>
        <a-button>R</a-button>
      </a-button-group>
      <a-form :model="aForm" :rules="aRules" layout="vertical" ref="aForm">
        <a-form-item label="用户名" name="username">
          <a-input v-model:value="aForm.username" placeholder="请输入" allow-clear />
        </a-form-item>
        <a-form-item label="密码" name="password">
          <a-input-password v-model:value="aForm.password" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit">提交</a-button>
        </a-form-item>
      </a-form>
      <a-table :dataSource="aRows" :columns="aColumns" row-key="id" />
      <a-pagination
        :total="aTotal"
        :page-size="aPageSize"
        v-model:current="aCurrent"
        show-size-changer
      />
    </section>

    <!-- ============ 4. wangeditor (富文本) ============ -->
    <section>
      <h3>4. wangeditor (富文本编辑器)</h3>
      <div ref="editor" class="editor"></div>
    </section>

    <!-- ============ 5. sortablejs / vuedraggable (拖拽) ============ -->
    <section>
      <h3>5. sortablejs / vuedraggable (拖拽)</h3>
      <draggable v-model="dragList" :animation="150" ghost-class="dragging">
        <div v-for="item in dragList" :key="item.id" class="drag-item">
          {{ item.name }}
        </div>
      </draggable>
      <ul ref="sortableList" class="sortable">
        <li v-for="item in sortList" :key="item.id" class="sort-item">
          {{ item.text }}
        </li>
      </ul>
    </section>

    <!-- ============ 6. template #default / #header / #footer / #item scoped slot ============ -->
    <section>
      <h3>6. template #default / scoped slots</h3>

      <my-card>
        <template #header>My Card Header</template>
        <template #default="{ data }">
          <p>{{ data.title }}</p>
        </template>
        <template #footer>
          <el-button>Confirm</el-button>
        </template>
      </my-card>

      <my-list :items="rows">
        <template #item="{ item, index }">
          <span>{{ index + 1 }}. {{ item.name }}</span>
        </template>
        <template #empty>
          <p>No items</p>
        </template>
      </my-list>

      <!-- v-slot 完整语法 (template 标签) -->
      <my-tabs v-model="activeTab">
        <template v-slot:default="{ tab, isActive }">
          <p>{{ tab.label }} - {{ isActive ? 'active' : 'inactive' }}</p>
        </template>
        <template v-slot:tab-bar="{ tabs }">
          <div class="custom-bar">{{ tabs.length }} tabs</div>
        </template>
      </my-tabs>
    </section>

    <!-- ============ 7. custom directive 各种 hook ============ -->
    <section>
      <h3>7. custom directive (各种 hook)</h3>
      <div v-once-render>once-render</div>
      <input v-focus />
      <input v-debounce:300="onDebounce" />
      <div v-pin:top="100">Pinned</div>
      <p v-color="'red'">Red text</p>
      <button v-permission="['admin']">Admin only</button>
    </section>
  </div>
</template>

<!-- ============ 1. 普通 scoped style ============ -->
<style scoped>
.root { padding: 1rem; }
h3 { font-size: 16px; color: #303133; margin: 16px 0 8px; }

/* element-ui 子组件样式穿透 (Vue 2 写法) */
.root >>> .el-button { font-size: 12px; }
.root /deep/ .el-input { width: 200px; }
.root ::v-deep .el-form { padding: 8px; }

/* @keyframes */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in { animation: fadeIn 0.3s; }

/* CSS variables (--var) */
.root {
  --primary: #409eff;
  --danger: #f56c6c;
  --font-size: 14px;
}

.primary { color: var(--primary); }
.danger { color: var(--danger); }

/* @media query */
@media (max-width: 768px) {
  .root { padding: 0.5rem; }
  h3 { font-size: 14px; }
}
</style>

<!-- ============ 2. 第二个 style 块 (无 scoped, 全局) ============ -->
<style>
/* 全局样式 — 影响所有子组件 (危险但常见) */
.global-warning {
  color: #e6a23c;
  font-weight: bold;
}

/* 第三方库覆盖 */
.el-button--primary.is-plain {
  background: #ecf5ff;
  color: #409eff;
}

/* ::v-deep 旧写法 (Vue 2) */
.root ::v-deep .el-input__inner {
  border-color: #409eff;
}
</style>

<!-- ============ 3. CSS module style ============ -->
<style module>
.moduleBox {
  border: 1px solid #dcdfe6;
  padding: 12px;
  margin: 8px 0;
}
.moduleTitle {
  font-weight: bold;
  color: #67c23a;
}
</style>

<script>
// ============ Mixin 1: with lifecycle ============
const withLogger = {
  created() {
    console.log('[withLogger] created')
  },
  beforeDestroy() {
    console.log('[withLogger] beforeDestroy')
  }
}

// ============ Mixin 2: with data + methods ============
const withDefaults = {
  data() {
    return {
      mixinDefault: 'from mixin2'
    }
  },
  methods: {
    mixinGreet() {
      return `Hello, ${this.mixinDefault}`
    }
  }
}

// ============ Mixin 3 (生僻): extend-style with minxins ============
const minxins = [withLogger, withDefaults]  // 故意拼错 (用户原话 "minx")

// ============ 自定义指令 — 各种 hook 形式 ============
const directives = {
  // Vue 2 老钩子 (inserted / unbind)
  focus: {
    inserted(el) { el.focus() },
    unbind(el) { el.blur() }
  },
  // Vue 2 老钩子 (bind / update)
  color: {
    bind(el, binding) { el.style.color = binding.value },
    update(el, binding) { el.style.color = binding.value }
  },
  // Vue 3 标准 (mounted / unmounted)
  pin: {
    mounted(el, binding) {
      el.style.position = 'fixed'
      el.style.top = binding.value + 'px'
    }
  },
  // 修饰符 + 动态参数
  debounce: {
    mounted(el, binding) {
      const delay = parseInt(binding.arg) || 300
      let timer
      el.addEventListener('input', () => {
        clearTimeout(timer)
        timer = setTimeout(binding.value, delay)
      })
    }
  },
  // 全局权限
  permission: {
    mounted(el, binding) {
      if (!binding.value.includes('admin')) {
        el.remove()
      }
    }
  },
  // Vue 2 老钩子: inserted+unbind+componentUpdated
  onceRender: {
    inserted(el) { console.log('once') },
    componentUpdated(el) { /* no-op */ },
    unbind(el) { /* no-op */ }
  }
}

// 父组件
export default {
  name: 'UILibrariesAndStyles',

  mixins: minxins,  // iter-086: 用户提到的 "minx" typo, 故意保留

  filters: {  // iter-086: 另一个 filters option 例子
    statusTag: s => s === 'active' ? 'success' : 'info'
  },

  directives,  // iter-086: 多个 custom directive 各种 hook

  // 局部注册的 sub-component
  components: {
    'MyCard': {
      template: '<div class="card"><slot name="header"/><slot :data="data"/><slot name="footer"/></div>',
      data() { return { data: { title: 'Hello' } } }
    },
    'MyList': {
      template: '<ul><slot name="empty" v-if="items.length === 0"/><slot v-for="(item, i) in items" :key="item.id" :item="item" :index="i" name="item"/></ul>',
      props: ['items']
    },
    'MyTabs': {
      template: '<div><slot name="tab-bar"/><slot :tab="active" :isActive="true"/></div>',
      data() { return { active: { label: 'tab1' } } }
    }
  },

  data() {
    return {
      loading: false,
      loginForm: { username: '', password: '' },
      rules: {
        username: [{ required: true, message: '请输入用户名' }],
        password: [{ required: true, min: 6, message: '密码至少 6 位' }]
      },
      rows: [
        { id: 1, name: 'Alice', status: 'active' },
        { id: 2, name: 'Bob', status: 'inactive' }
      ],
      total: 100,
      pageSize: 10,
      currentPage: 1,

      aForm: { username: '', password: '' },
      aRules: {},
      aRows: [{ id: 1, name: 'X' }],
      aColumns: [{ title: 'ID', dataIndex: 'id' }],
      aTotal: 50,
      aPageSize: 10,
      aCurrent: 1,

      dragList: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      sortList: [{ id: 1, text: 'x' }, { id: 2, text: 'y' }],

      activeTab: 0,

      editorContent: '<p>init</p>',
      editor: null
    }
  },

  computed: {
    // iter-086: getter+setter computed (composition 已 review)
    fullName: {
      get() { return `${this.firstName} ${this.lastName}` },
      set(v) { [this.firstName, this.lastName] = v.split(' ') }
    },
    firstName: { get() { return this._first }, set(v) { this._first = v } },
    lastName: { get() { return this._last }, set(v) { this._last = v } }
  },

  methods: {
    onClick() { this.loading = !this.loading },
    onSubmit() { this.$refs.loginForm?.validate() },
    onReset() { this.$refs.loginForm?.resetFields() },
    onEdit(row) { console.log('edit', row) },
    onDelete(row, idx) { this.rows.splice(idx, 1) },
    onAClick() {},
    onDebounce() {},
    toggleLoading() { this.loading = !this.loading },

    // 私有方法 (下划线开头, class fields 形式)
    _formatTime(ts) { return new Date(ts).toLocaleString() },

    // arrow function method (生僻)
    arrowHandler: (e) => console.log('arrow', e.target),

    // async/await (现代语法)
    async fetchData() {
      const res = await this.$http.get('/api')
      return res.data
    }
  },

  // 私有 class field (iter-086: ES2022 private syntax, Vue 2 不支持, 但 .vue 里写不影响)
  // 注意: Vue 2 单文件组件不支持 class fields, 但我们这里展示完整 JS 语法覆盖

  // 多 lifecycle hook
  beforeCreate() { console.log('beforeCreate') },
  created() { console.log('created') },
  beforeMount() {},
  mounted() {
    // 集成 wangeditor (iter-086: 3rd-party editor init)
    import('wangeditor').then(({ default: WangEditor }) => {
      this.editor = new WangEditor(this.$refs.editor)
      this.editor.create()
    })
  },
  beforeDestroy() { this.editor?.destroy() }
}
</script>

<!-- ============ 4. 第三个 style 块: 嵌套 CSS (postcss-nested 语法, 现代项目) ============ -->
<style scoped>
.nested {
  & .child {
    color: red;
    & .grandchild {
      color: blue;
    }
  }
  &:hover {
    background: yellow;
  }
}
</style>
