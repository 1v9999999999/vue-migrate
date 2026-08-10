<template>
  <div class="stress-test">
    <!-- 1. slot 各种用法（vue3-template 规则 2.1/2.2） -->
    <child-component>
      <h1 slot="header">页面标题</h1>
      <p slot-scope="props">{{ props.text }}</p>
      <template slot="footer" slot-scope="foot">
        <span>{{ foot.author }}</span>
      </template>
      <div slot="empty">暂无数据</div>
    </child-component>

    <!-- 2. v-bind.sync（vue3-template 规则 2.4） -->
    <modal :visible.sync="modalVisible" :title.sync="modalTitle" />

    <!-- 3. keycode 数字修饰符（vue3-directives 规则 5.1） -->
    <input @keyup.13="onEnter" @keydown.27="onEsc" @keyup.32="onSpace" placeholder="按键测试" />

    <!-- 4. v-if + v-for 同节点（vue3-directives 规则 5.3） -->
    <ul>
      <li v-for="item in items" v-if="item.active" :key="item.id">
        {{ item.name }}
      </li>
    </ul>

    <!-- 5. :value + @input 组合（vue3-directives 规则 5.4） -->
    <input :value="searchText" @input="searchText = $event.target.value" placeholder="搜索" />
    <textarea :value="content" @input="content = $event.target.value" placeholder="内容"></textarea>

    <!-- 6. keep-alive :include 字符串形式（vue3-directives 规则 5.5） -->
    <keep-alive :include="'UserCard,UserList,UserDetail'">
      <component :is="currentView" />
    </keep-alive>

    <!-- 7. inline-template（vue3-template 规则 2.9） -->
    <my-card inline-template>
      <div>{{ title }}</div>
    </my-card>

    <!-- 8. 模板 filter 链（vue3-directives 规则 2.3） -->
    <p>价格：{{ price | formatPrice | addDollar }}</p>
    <p>摘要：{{ description | truncate(50) | uppercase }}</p>
    <p>日期：{{ publishDate | formatDate('YYYY-MM-DD') }}</p>

    <!-- 9. this.$scopedSlots（vue3-template 规则 2.7） -->
    <info-panel ref="panel">
      <template v-slot:title>信息面板</template>
    </info-panel>

    <!-- 10. 自定义指令（vue3-directives 规则 6.1/6.2） -->
    <div v-my-directive="value" v-focus="focused" v-tooltip="tooltipText">指令测试</div>

    <!-- 11. ElementUI 组件用法（ElementUI → Element Plus 转换测试） -->
    <el-form :model="form" :rules="formRules" ref="formRef" label-width="120px" size="medium">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" placeholder="请输入用户名" clearable />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" type="password" show-password />
      </el-form-item>
      <el-form-item label="类型" prop="category">
        <el-select v-model="form.category" placeholder="请选择" clearable filterable>
          <el-option label="技术" value="tech" />
          <el-option label="图书" value="book" />
        </el-select>
      </el-form-item>
      <el-form-item label="日期" prop="date">
        <el-date-picker v-model="form.date" type="daterange" value-format="yyyy-MM-dd" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="mini" icon="el-icon-search" @click="onSubmit">提交</el-button>
        <el-button size="medium" @click="onCancel">取消</el-button>
        <el-button type="text" @click="onInfo">info 按钮</el-button>
      </el-form-item>
    </el-form>

    <!-- 12. ElementUI Dialog 旧写法 -->
    <el-dialog :visible.sync="dialogVisible" title="提示" width="500px">
      <span>这是一段内容</span>
      <span slot="footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onConfirm">确定</el-button>
      </span>
    </el-dialog>

    <!-- 13. ElementUI Drawer 旧写法 -->
    <el-drawer :visible.sync="drawerVisible" direction="rtl" size="50%">
      <p>抽屉内容</p>
    </el-drawer>

    <!-- 14. ElementUI Menu（el-submenu 重命名） -->
    <el-menu :default-active="activeMenu" mode="horizontal">
      <el-menu-item index="1">首页</el-menu-item>
      <el-submenu index="2">
        <template slot="title">产品</template>
        <el-menu-item index="2-1">产品 A</el-menu-item>
        <el-menu-item index="2-2">产品 B</el-menu-item>
      </el-submenu>
      <el-menu-item index="3">关于</el-menu-item>
    </el-menu>

    <!-- 15. ElementUI Pagination（current-page.sync） -->
    <el-pagination :current-page.sync="currentPage" :page-size="pageSize" :total="total" @current-change="onPageChange" />

    <!-- 16. ElementUI Table -->
    <el-table :data="tableData" border stripe @selection-change="onSelectionChange" @row-click="onRowClick">
      <el-table-column type="selection" width="55" />
      <el-table-column type="index" label="#" width="80" />
      <el-table-column prop="name" label="姓名" />
      <el-table-column prop="age" label="年龄" sortable />
      <el-table-column label="操作">
        <template slot-scope="scope">
          <el-button type="text" @click="onEdit(scope.row)"><i class="el-icon-edit"></i>编辑</el-button>
          <el-button type="text" @click="onDelete(scope.row)"><i class="el-icon-delete"></i>删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
import Vue from 'vue'
import moment from 'moment'
import ChildComponent from './ChildComponent.vue'
import Modal from './Modal.vue'
import MyCard from './MyCard.vue'
import InfoPanel from './InfoPanel.vue'

// 11. Vue.extend（vue2-compat 规则 1.2）
const BaseWidget = Vue.extend({
  name: 'BaseWidget',
  data() {
    return {
      size: 'medium',
      theme: 'light'
    }
  },
  props: {
    value: { type: [String, Number], default: '' }
  },
  methods: {
    setSize(s) {
      this.size = s
    }
  }
})

// 11.5 ElementUI 引入
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import { Message, MessageBox, Notification, Loading } from 'element-ui'

// 12. 复杂数据：覆盖 vue3-types 类型推断
export default {
  name: 'StressTest',
  components: {
    ChildComponent,
    Modal,
    MyCard,
    InfoPanel
  },

  // 13. 多种 props 形式（vue3-types 规则 4.2）
  props: {
    // 基础类型
    title: String,
    count: Number,
    enabled: Boolean,
    // 联合类型
    status: { type: String, default: 'pending' },
    // 数字默认
    maxLength: { type: Number, default: 100 },
    // 必填字符串
    userId: { type: String, required: true },
    // 对象类型带函数默认值
    config: { type: Object, default: () => ({ debug: false, version: 1 }) },
    // 数组类型
    tags: { type: Array, default: () => [] }
  },

  // 14. data() 返回丰富类型（vue3-types 规则 4.1）
  data() {
    return {
      // 基本类型
      modalVisible: false,
      modalTitle: '默认标题',
      searchText: '',
      content: '',
      // 数字
      price: 99.5,
      pageSize: 20,
      // 字符串
      description: '这是一个用于测试的描述文本',
      // 布尔
      focused: false,
      // 数组
      items: [
        { id: 1, name: '苹果', active: true, price: 5 },
        { id: 2, name: '香蕉', active: false, price: 3 },
        { id: 3, name: '橘子', active: true, price: 4 }
      ],
      // 对象
      currentUser: {
        id: 1001,
        name: '张三',
        email: 'zhangsan@example.com',
        age: 28,
        active: true,
        profile: {
          avatar: 'https://example.com/avatar.jpg',
          bio: '软件工程师'
        }
      },
      // 嵌套数组
      matrix: [
        [1, 2, 3],
        [4, 5, 6]
      ],
      // null
      maybeNull: null,
      // 日期
      publishDate: new Date(),
      // 简单数组
      tagsList: ['vue', 'js', 'css'],
      // ElementUI 状态
      form: {
        username: '',
        password: '',
        category: '',
        date: null
      },
      formRules: {
        username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
        password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
        category: [{ required: true, message: '请选择类型', trigger: 'change' }]
      },
      dialogVisible: false,
      drawerVisible: false,
      activeMenu: '1',
      currentPage: 1,
      total: 100,
      tableData: [
        { id: 1, name: '张三', age: 28 },
        { id: 2, name: '李四', age: 32 },
        { id: 3, name: '王五', age: 25 }
      ],
      selectedRows: []
    }
  },

  // 15. 计算属性（含 this 引用 - 留作 TODO）
  computed: {
    fullTitle() {
      return this.title + ' - ' + this.modalTitle
    },
    activeItems() {
      return this.items.filter(item => item.active)
    },
    totalPrice() {
      return this.activeItems.reduce((sum, item) => sum + item.price, 0)
    },
    isAdmin() {
      return this.currentUser && this.currentUser.id === 1001
    }
  },

  // 16. methods（含 this.xxx 大量使用）
  methods: {
    // 简单事件
    onEnter() {
      console.log('enter pressed, search:', this.searchText)
    },
    onEsc() {
      this.searchText = ''
    },
    onSpace() {
      console.log('space')
    },

    // 18. 自定义指令：bind/inserted/update/componentUpdated/unbind 完整生命周期
    initDirectives() {
      // this.$listeners（vue3-template 规则 2.5）
      console.log('listeners:', this.$listeners)
      // this.$children（应标 TODO）
      console.log('children:', this.$children)
      // this.$scopedSlots（vue3-template 规则 2.7）
      if (this.$scopedSlots.title) {
        this.$scopedSlots.title({ data: 'xxx' })
      }
    },

    // 19. 操作 data
    addItem() {
      const newId = this.items.length + 1
      this.items.push({
        id: newId,
        name: '新项目' + newId,
        active: true,
        price: 10
      })
    },
    removeItem(id) {
      this.items = this.items.filter(item => item.id !== id)
    },
    toggleItem(id) {
      const item = this.items.find(i => i.id === id)
      if (item) item.active = !item.active
    },

    // 20. 调用 this.$refs（应标 TODO）
    focusPanel() {
      const panel = this.$refs.panel
      if (panel) panel.focus()
    },

    // 21. 调用 this.$store（应标 TODO）
    loadUserFromStore() {
      const name = this.$store.state.user.name
      return name
    },

    // 22. 调用 this.$route（应标 TODO）
    getRouteParam() {
      return this.$route.params.id
    },

    // 23. 模板 filter 函数（filters 选项，应被识别标 TODO）
    formatDate(v, fmt) {
      return moment(v).format(fmt || 'YYYY-MM-DD HH:mm:ss')
    },
    truncate(v, n) {
      if (!v) return ''
      return v.length > n ? v.slice(0, n) + '...' : v
    },
    uppercase(v) {
      return v ? v.toUpperCase() : ''
    },
    formatPrice(v) {
      return Number(v).toFixed(2)
    },
    addDollar(v) {
      return '$' + v
    },

    // 24. ElementUI 事件处理
    onSubmit() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.$message.success('提交成功')
        } else {
          this.$message.error('表单校验失败')
          return false
        }
      })
    },
    onCancel() {
      this.$message.info('已取消')
    },
    onInfo() {
      this.$notify({
        title: '提示',
        message: '这是一条通知',
        type: 'info'
      })
    },
    onConfirm() {
      this.$msgbox.confirm('确定要执行此操作吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }).then(() => {
        this.$message.success('操作成功')
      }).catch(() => {
        this.$message.info('已取消操作')
      })
    },
    onPageChange(page) {
      this.currentPage = page
    },
    onSelectionChange(rows) {
      this.selectedRows = rows
    },
    onRowClick(row) {
      console.log('row clicked:', row)
    },
    onEdit(row) {
      this.$alert('编辑 ' + row.name, '编辑', { type: 'info' })
    },
    onDelete(row) {
      this.$confirm('确定删除 ' + row.name + ' 吗？', '提示', {
        type: 'warning'
      }).then(() => {
        this.$message.success('删除成功')
      }).catch(() => {
        this.$message.info('已取消删除')
      })
    },

    // 测试 $loading
    async loadData() {
      const loading = this.$loading({
        lock: true,
        text: '加载中...',
        spinner: 'el-icon-loading',
        background: 'rgba(0, 0, 0, 0.7)'
      })
      try {
        await new Promise(resolve => setTimeout(resolve, 1000))
        this.$message.success('加载完成')
      } finally {
        loading.close()
      }
    }
  },

  // 24. filters 选项（vue3-directives 规则 2.3）
  filters: {
    formatDate(v, fmt) {
      return moment(v).format(fmt || 'YYYY-MM-DD HH:mm:ss')
    },
    truncate(v, n) {
      if (!v) return ''
      return v.length > n ? v.slice(0, n) + '...' : v
    },
    uppercase(v) {
      return v ? v.toUpperCase() : ''
    },
    formatPrice(v) {
      return Number(v).toFixed(2)
    },
    addDollar(v) {
      return '$' + v
    }
  },

  // 25. 自定义指令定义
  directives: {
    'my-directive': {
      bind(el, binding) {
        el.dataset.value = binding.value
        console.log('bind', el.tagName)
      },
      inserted(el) {
        el.classList.add('inserted')
      },
      update(el, binding) {
        el.dataset.value = binding.value
      },
      componentUpdated(el) {
        el.classList.add('updated')
      },
      unbind(el) {
        delete el.dataset.value
      }
    },
    'focus': {
      inserted(el) {
        el.focus()
      }
    },
    'tooltip': {
      bind(el, binding) {
        el.title = binding.value
      }
    }
  },

  // 26. 生命周期：含 beforeDestroy/destroyed（vue2-compat 规则 1.4/1.5）
  beforeCreate() {
    console.log('beforeCreate')
  },
  created() {
    console.log('created, items:', this.items.length)
  },
  beforeMount() {
    console.log('beforeMount')
  },
  mounted() {
    console.log('mounted, title=', this.title)
    this.initDirectives()
    // 27. watch（Vue2 特性）
    this.$watch('searchText', function(newVal, oldVal) {
      console.log('searchText changed:', oldVal, '->', newVal)
    })
    this.$watch('items', function(newVal) {
      console.log('items changed, count=', newVal.length)
    }, { deep: true })
  },
  beforeUpdate() {
    console.log('beforeUpdate')
  },
  updated() {
    console.log('updated')
  },
  activated() {
    console.log('activated')
  },
  deactivated() {
    console.log('deactivated')
  },
  // 28. errorCaptured（Vue2.5+）
  errorCaptured(err, vm, info) {
    console.error('errorCaptured:', err, info)
    return false
  },
  // 关键：应改为 beforeUnmount
  beforeDestroy() {
    console.log('before destroy, cleaning up...')
    if (this.$listeners.resize) {
      // 清理逻辑
    }
    // 29. 全局事件总线 $on/$off/$once（应标 TODO）
    if (this.$bus) {
      this.$bus.$off('globalEvent', this.handleGlobalEvent)
    }
  },
  // 关键：应改为 unmounted
  destroyed() {
    console.log('destroyed')
  },

  // 30. watch 选项形式
  watch: {
    title(newVal, oldVal) {
      console.log('title:', oldVal, '->', newVal)
    },
    'currentUser.name'(newVal) {
      console.log('username changed:', newVal)
    },
    items: {
      handler(newVal) {
        console.log('items deep changed')
      },
      deep: true
    },
    modalVisible: {
      handler(newVal) {
        if (newVal) {
          console.log('modal opened')
        }
      }
    }
  }
}

// 31. 业务逻辑方法（模拟真实项目规模）
function buildValidationRules() {
  const rules = []
  rules.push({ field: 'title', required: true, min: 2, max: 50, message: '标题 2-50 字' })
  rules.push({ field: 'description', required: true, min: 5, max: 500, message: '描述 5-500 字' })
  rules.push({ field: 'price', required: true, type: 'number', min: 0, max: 999999, message: '价格 0-999999' })
  rules.push({ field: 'email', required: false, type: 'email', message: '邮箱格式不正确' })
  rules.push({ field: 'phone', required: false, pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' })
  rules.push({ field: 'age', required: false, type: 'integer', min: 0, max: 150, message: '年龄 0-150' })
  rules.push({ field: 'tags', required: false, type: 'array', max: 10, message: '最多 10 个标签' })
  rules.push({ field: 'category', required: true, type: 'enum', values: ['food', 'book', 'tech'], message: '分类必须指定' })
  rules.push({ field: 'publishDate', required: true, type: 'date', message: '发布日期必填' })
  rules.push({ field: 'author', required: true, min: 2, max: 20, message: '作者名 2-20 字' })
  return rules
}

function buildMockApiData() {
  return {
    users: [
      { id: 1, name: 'Alice', role: 'admin', age: 28, active: true },
      { id: 2, name: 'Bob', role: 'user', age: 32, active: true },
      { id: 3, name: 'Charlie', role: 'guest', age: 24, active: false },
      { id: 4, name: 'David', role: 'user', age: 45, active: true },
      { id: 5, name: 'Eve', role: 'admin', age: 29, active: true }
    ],
    products: [
      { id: 'p1', name: 'iPhone', price: 6999, stock: 100, category: 'tech' },
      { id: 'p2', name: 'MacBook', price: 12999, stock: 50, category: 'tech' },
      { id: 'p3', name: 'iPad', price: 3999, stock: 200, category: 'tech' },
      { id: 'p4', name: '《Vue 实战》', price: 89, stock: 1000, category: 'book' },
      { id: 'p5', name: '《深入 React》', price: 99, stock: 800, category: 'book' }
    ],
    orders: [
      { id: 'o1', userId: 1, items: ['p1', 'p2'], total: 19998, status: 'paid' },
      { id: 'o2', userId: 2, items: ['p4', 'p5'], total: 188, status: 'pending' },
      { id: 'o3', userId: 1, items: ['p3'], total: 3999, status: 'shipped' }
    ]
  }
}

function buildPermissionMatrix() {
  const matrix = {
    admin: { read: true, write: true, delete: true, export: true, import: true },
    editor: { read: true, write: true, delete: false, export: true, import: false },
    author: { read: true, write: true, delete: false, export: false, import: false },
    user: { read: true, write: false, delete: false, export: false, import: false },
    guest: { read: true, write: false, delete: false, export: false, import: false }
  }
  return matrix
}

function buildStateTransitions() {
  const transitions = {
    pending: ['approved', 'rejected', 'cancelled'],
    approved: ['shipped', 'cancelled'],
    shipped: ['delivered', 'returned'],
    delivered: ['returned'],
    returned: ['refunded'],
    refunded: [],
    rejected: [],
    cancelled: []
  }
  return transitions
}

function canTransition(from, to) {
  const transitions = buildStateTransitions()
  return transitions[from] && transitions[from].includes(to)
}

function buildI18nMessages() {
  return {
    'zh-CN': {
      common: { save: '保存', cancel: '取消', confirm: '确认', delete: '删除', edit: '编辑' },
      user: { name: '姓名', email: '邮箱', phone: '电话', age: '年龄' },
      order: { pending: '待处理', paid: '已支付', shipped: '已发货', delivered: '已送达' }
    },
    'en-US': {
      common: { save: 'Save', cancel: 'Cancel', confirm: 'Confirm', delete: 'Delete', edit: 'Edit' },
      user: { name: 'Name', email: 'Email', phone: 'Phone', age: 'Age' },
      order: { pending: 'Pending', paid: 'Paid', shipped: 'Shipped', delivered: 'Delivered' }
    },
    'ja-JP': {
      common: { save: '保存', cancel: 'キャンセル', confirm: '確認', delete: '削除', edit: '編集' },
      user: { name: '名前', email: 'メール', phone: '電話', age: '年齢' },
      order: { pending: '保留中', paid: '支払済', shipped: '発送済', delivered: '配達済' }
    }
  }
}

function buildFeatureFlags() {
  return {
    'new-dashboard': { enabled: true, rollout: 100, whitelist: [] },
    'ai-assistant': { enabled: false, rollout: 5, whitelist: [1, 2, 1001] },
    'beta-checkout': { enabled: true, rollout: 50, whitelist: [] },
    'experimental-search': { enabled: false, rollout: 0, whitelist: [] },
    'dark-mode-v2': { enabled: true, rollout: 100, whitelist: [] }
  }
}

function buildThemeConfig() {
  return {
    light: {
      primary: '#1890ff',
      success: '#52c41a',
      warning: '#faad14',
      danger: '#ff4d4f',
      bg: '#ffffff',
      text: '#333333'
    },
    dark: {
      primary: '#177ddc',
      success: '#49aa19',
      warning: '#d89614',
      danger: '#d32029',
      bg: '#1f1f1f',
      text: 'rgba(255,255,255,0.85)'
    }
  }
}

function buildShortcutKeys() {
  return {
    'ctrl+s': { action: 'save', desc: '保存' },
    'ctrl+c': { action: 'copy', desc: '复制' },
    'ctrl+v': { action: 'paste', desc: '粘贴' },
    'ctrl+x': { action: 'cut', desc: '剪切' },
    'ctrl+z': { action: 'undo', desc: '撤销' },
    'ctrl+y': { action: 'redo', desc: '重做' },
    'ctrl+a': { action: 'selectAll', desc: '全选' },
    'ctrl+f': { action: 'find', desc: '查找' },
    'ctrl+h': { action: 'replace', desc: '替换' },
    'ctrl+shift+f': { action: 'findInFiles', desc: '在文件中查找' },
    'esc': { action: 'cancel', desc: '取消' },
    'enter': { action: 'confirm', desc: '确认' },
    'tab': { action: 'next', desc: '下一项' },
    'shift+tab': { action: 'prev', desc: '上一项' }
  }
}

function buildFormSchemas() {
  return [
    { key: 'login', fields: ['username', 'password', 'remember'] },
    { key: 'register', fields: ['username', 'email', 'password', 'confirm', 'agree'] },
    { key: 'profile', fields: ['name', 'avatar', 'bio', 'email', 'phone'] },
    { key: 'address', fields: ['name', 'phone', 'province', 'city', 'district', 'detail'] },
    { key: 'payment', fields: ['method', 'cardNo', 'cvv', 'expire'] }
  ]
}

function buildMenuTree() {
  return [
    {
      id: 1, name: '仪表盘', icon: 'dashboard', path: '/dashboard', children: []
    },
    {
      id: 2, name: '用户管理', icon: 'user', path: '/users',
      children: [
        { id: 21, name: '用户列表', path: '/users/list' },
        { id: 22, name: '角色管理', path: '/users/roles' },
        { id: 23, name: '权限管理', path: '/users/permissions' }
      ]
    },
    {
      id: 3, name: '订单管理', icon: 'order', path: '/orders',
      children: [
        { id: 31, name: '全部订单', path: '/orders/all' },
        { id: 32, name: '待处理', path: '/orders/pending' },
        { id: 33, name: '已完成', path: '/orders/done' }
      ]
    },
    {
      id: 4, name: '商品管理', icon: 'product', path: '/products',
      children: [
        { id: 41, name: '商品列表', path: '/products/list' },
        { id: 42, name: '分类管理', path: '/products/categories' },
        { id: 43, name: '库存管理', path: '/products/stock' }
      ]
    },
    {
      id: 5, name: '系统设置', icon: 'settings', path: '/settings',
      children: [
        { id: 51, name: '基础设置', path: '/settings/basic' },
        { id: 52, name: '邮件配置', path: '/settings/email' },
        { id: 53, name: '短信配置', path: '/settings/sms' }
      ]
    }
  ]
}

function buildNotificationTemplates() {
  return {
    order_paid: { title: '订单已支付', content: '您的订单 {orderId} 已完成支付' },
    order_shipped: { title: '订单已发货', content: '您的订单 {orderId} 已发货，快递单号 {trackingNo}' },
    order_delivered: { title: '订单已送达', content: '您的订单 {orderId} 已送达，请及时确认收货' },
    user_register: { title: '欢迎注册', content: '欢迎 {username} 加入我们' },
    password_reset: { title: '密码重置', content: '点击链接重置密码：{url}' }
  }
}

function buildApiEndpoints() {
  return {
    auth: { login: '/api/auth/login', logout: '/api/auth/logout', register: '/api/auth/register' },
    user: { list: '/api/users', detail: '/api/users/:id', update: '/api/users/:id', delete: '/api/users/:id' },
    order: { list: '/api/orders', create: '/api/orders', update: '/api/orders/:id', cancel: '/api/orders/:id/cancel' },
    product: { list: '/api/products', search: '/api/products/search', detail: '/api/products/:id' },
    upload: { image: '/api/upload/image', file: '/api/upload/file' }
  }
}

const VALIDATION_RULES = buildValidationRules()
const MOCK_API_DATA = buildMockApiData()
const PERMISSION_MATRIX = buildPermissionMatrix()
const I18N_MESSAGES = buildI18nMessages()
const FEATURE_FLAGS = buildFeatureFlags()
const THEME_CONFIG = buildThemeConfig()
const SHORTCUT_KEYS = buildShortcutKeys()
const FORM_SCHEMAS = buildFormSchemas()
const MENU_TREE = buildMenuTree()
const NOTIFICATION_TEMPLATES = buildNotificationTemplates()
const API_ENDPOINTS = buildApiEndpoints()

export { VALIDATION_RULES, MOCK_API_DATA, PERMISSION_MATRIX, I18N_MESSAGES, FEATURE_FLAGS, THEME_CONFIG, SHORTCUT_KEYS, FORM_SCHEMAS, MENU_TREE, NOTIFICATION_TEMPLATES, API_ENDPOINTS }

// 32. 业务工具函数（Vue2 项目常见的工具代码）
function debounce(fn, delay) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

function throttle(fn, threshold) {
  let last = 0
  let timer = null
  return function (...args) {
    const now = Date.now()
    if (now - last >= threshold) {
      last = now
      fn.apply(this, args)
    } else {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        last = Date.now()
        fn.apply(this, args)
      }, threshold - (now - last))
    }
  }
}

function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (obj instanceof Object) {
    const copy = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = deepClone(obj[key])
      }
    }
    return copy
  }
}

function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return a === b
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (!keysB.includes(key)) return false
    if (!deepEqual(a[key], b[key])) return false
  }
  return true
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i]
}

function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms'
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's'
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's'
  return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm'
}

function generateId(prefix = '') {
  return prefix + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
}

function parseQueryString(qs) {
  const result = {}
  if (!qs) return result
  const pairs = qs.replace(/^\?/, '').split('&')
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key) {
      result[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ''
    }
  }
  return result
}

function buildQueryString(params) {
  const parts = []
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    }
  }
  return parts.length ? '?' + parts.join('&') : ''
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  if (match) return decodeURIComponent(match[2])
  return null
}

function setCookie(name, value, days) {
  const expires = new Date()
  expires.setTime(expires.getTime() + (days || 30) * 24 * 60 * 60 * 1000)
  document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + expires.toUTCString() + ';path=/'
}

function deleteCookie(name) {
  setCookie(name, '', -1)
}

function localStorageGet(key, defaultValue = null) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : defaultValue
  } catch (e) {
    return defaultValue
  }
}

function localStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (e) {
    return false
  }
}

function localStorageRemove(key) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (e) {
    return false
  }
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(phone)
}

function validateIdCard(id) {
  return /^\d{17}[\dXx]$/.test(id)
}

function validateUrl(url) {
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

function validateIpv4(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  for (const p of parts) {
    const n = Number(p)
    if (isNaN(n) || n < 0 || n > 255 || (p.length > 1 && p[0] === '0')) return false
  }
  return true
}

function maskString(s, start, end, char = '*') {
  if (!s) return ''
  if (start >= s.length) return s
  if (end > s.length) end = s.length
  return s.substring(0, start) + char.repeat(end - start) + s.substring(end)
}

function escapeHtml(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function unescapeHtml(s) {
  if (!s) return ''
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function truncateText(s, max, suffix = '...') {
  if (!s) return ''
  if (s.length <= max) return s
  return s.substring(0, max - suffix.length) + suffix
}

function toTitleCase(s) {
  return s.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

function toCamelCase(s) {
  return s.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
}

function toKebabCase(s) {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase()
}

function toSnakeCase(s) {
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[\s-]+/g, '_').toLowerCase()
}

function chunkArray(arr, size) {
  const chunks = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function uniqueArray(arr, key) {
  if (!key) return [...new Set(arr)]
  const seen = new Set()
  return arr.filter(item => {
    const k = item[key]
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function groupBy(arr, key) {
  return arr.reduce((groups, item) => {
    const k = typeof key === 'function' ? key(item) : item[key]
    if (!groups[k]) groups[k] = []
    groups[k].push(item)
    return groups
  }, {})
}

function sortBy(arr, key, order = 'asc') {
  return [...arr].sort((a, b) => {
    const av = typeof key === 'function' ? key(a) : a[key]
    const bv = typeof key === 'function' ? key(b) : b[key]
    if (av === bv) return 0
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    return (av < bv ? -1 : 1) * (order === 'asc' ? 1 : -1)
  })
}

function pick(obj, keys) {
  const result = {}
  for (const key of keys) {
    if (key in obj) result[key] = obj[key]
  }
  return result
}

function omit(obj, keys) {
  const result = {}
  for (const key in obj) {
    if (!keys.includes(key)) result[key] = obj[key]
  }
  return result
}

function isEmpty(v) {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.length === 0
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v).length === 0
  return false
}

function safeJsonParse(s, defaultValue = null) {
  try {
    return JSON.parse(s)
  } catch (e) {
    return defaultValue
  }
}

function safeJsonStringify(v, defaultValue = '') {
  try {
    return JSON.stringify(v)
  } catch (e) {
    return defaultValue
  }
}

export {
  debounce, throttle, deepClone, deepEqual,
  formatBytes, formatDuration, generateId,
  parseQueryString, buildQueryString,
  getCookie, setCookie, deleteCookie,
  localStorageGet, localStorageSet, localStorageRemove,
  validateEmail, validatePhone, validateIdCard, validateUrl, validateIpv4,
  maskString, escapeHtml, unescapeHtml, truncateText,
  toTitleCase, toCamelCase, toKebabCase, toSnakeCase,
  chunkArray, uniqueArray, groupBy, sortBy,
  pick, omit, isEmpty,
  safeJsonParse, safeJsonStringify
}
</script>

<style scoped>
.stress-test {
  padding: 16px;
}
ul {
  list-style: none;
}
li {
  padding: 4px 0;
}
.inserted {
  outline: 2px solid green;
}
.updated {
  background: yellow;
}
.stress-test .header {
  font-size: 18px;
  font-weight: bold;
  color: #333;
  margin-bottom: 12px;
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 8px;
}
.stress-test .section {
  margin: 16px 0;
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
}
.stress-test .section-title {
  font-size: 14px;
  font-weight: 600;
  color: #666;
  margin-bottom: 8px;
}
.stress-test .toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.stress-test .toolbar button {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}
.stress-test .toolbar button:hover {
  border-color: #1890ff;
  color: #1890ff;
}
.stress-test .toolbar button.primary {
  background: #1890ff;
  border-color: #1890ff;
  color: #fff;
}
.stress-test .toolbar button.danger {
  background: #ff4d4f;
  border-color: #ff4d4f;
  color: #fff;
}
.stress-test .grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.stress-test .card {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  padding: 12px;
  background: #fff;
  transition: all 0.2s;
}
.stress-test .card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.stress-test .card-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.stress-test .card-body {
  color: #666;
  font-size: 13px;
}
.stress-test .badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 2px;
  font-size: 12px;
  background: #f0f0f0;
  color: #666;
  margin-right: 4px;
}
.stress-test .badge.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}
.stress-test .badge.warning {
  background: #fffbe6;
  color: #faad14;
  border: 1px solid #ffe58f;
}
.stress-test .badge.danger {
  background: #fff2f0;
  color: #ff4d4f;
  border: 1px solid #ffa39e;
}
.stress-test input,
.stress-test textarea {
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  width: 100%;
  box-sizing: border-box;
}
.stress-test input:focus,
.stress-test textarea:focus {
  border-color: #1890ff;
}
.stress-test .item-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.stress-test .item-list li {
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.stress-test .item-list li.active {
  background: #e6f7ff;
  border-color: #91d5ff;
}
.stress-test .item-actions {
  display: flex;
  gap: 4px;
}
.stress-test .item-actions button {
  padding: 2px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 2px;
  cursor: pointer;
}
@media (max-width: 768px) {
  .stress-test {
    padding: 8px;
  }
  .stress-test .grid {
    grid-template-columns: 1fr;
  }
  .stress-test .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
