<template>
  <div class="inline-template-demo">
    <h2>inline-template 示例（Vue 3 已移除）</h2>

    <!-- ====== 1. 基本 inline-template ====== -->
    <!-- Vue 2: inline-template 让子组件用父组件的作用域渲染 -->
    <!-- Vue 3: 完全移除，需用默认 slot 替代 -->
    <InlineCounter inline-template :start="count" @increment="onIncrement">
      <div class="counter-display">
        <h3>内联模板计数器</h3>
        <p>start prop: {{ start }}</p>
        <p>父组件 count: {{ count }}</p>
        <p>自身 localNum: {{ localNum }}</p>
        <button @click="increment">+1 (内联模板内调用)</button>
        <p>computed doubled: {{ doubled }}</p>
      </div>
    </InlineCounter>

    <hr />

    <!-- ====== 2. inline-template + 多个 props 混合 ====== -->
    <UserProfile inline-template :user="currentUser" :editable="canEdit">
      <div class="profile-card">
        <h3>用户资料卡（inline-template）</h3>
        <p>姓名：{{ user.name }}</p>
        <p>年龄：{{ user.age }}</p>
        <p>可编辑：{{ editable }}</p>
        <p>格式化：{{ formattedName }}</p>
        <input
          v-if="editable"
          :value="user.name"
          @input="$emit('update:name', $event.target.value)"
          placeholder="编辑姓名"
        />
        <button @click="toggleEdit">{{ editable ? '锁定' : '解锁' }}</button>
      </div>
    </UserProfile>

    <hr />

    <!-- ====== 3. inline-template 中使用 v-for / v-if ====== -->
    <InlineList inline-template :items="tasks">
      <ul class="task-list">
        <li v-for="task in items" :key="task.id" :class="{ done: task.completed }">
          <span>{{ task.text }}</span>
          <button @click="toggle(task)">{{ task.completed ? '撤销' : '完成' }}</button>
        </li>
      </ul>
    </InlineList>

    <p class="note">
      ⚠️ Vue 3 移除了 inline-template。迁移方案：用默认 slot 替代，
      父组件通过 scoped slot 传值。
    </p>
  </div>
</template>

<script>
/* eslint-disable vue/no-deprecated-inline-template */

/**
 * inline-template（Vue 2 专属，Vue 3 移除）：
 * - 子组件标记 inline-template 后，其内容成为子组件的模板
 * - 但渲染时使用父组件的作用域（可访问父组件 data/methods）
 * - 子组件自身的 data/computed/methods 也可在 inline 模板中访问
 * - props 照常传入
 *
 * Vue 3 迁移：用默认 slot 或 scoped slot 替代
 */

const InlineCounter = {
  name: 'InlineCounter',
  props: {
    start: { type: Number, default: 0 }
  },
  data() {
    return {
      localNum: 0
    }
  },
  created() {
    this.localNum = this.start
  },
  computed: {
    doubled() {
      return this.localNum * 2
    }
  },
  methods: {
    increment() {
      this.localNum++
      this.$emit('increment', this.localNum)
    }
  }
  // 注意：没有 template 选项，模板来自父组件的 inline-template 内容
}

const UserProfile = {
  name: 'UserProfile',
  props: {
    user: { type: Object, required: true },
    editable: { type: Boolean, default: false }
  },
  computed: {
    formattedName() {
      if (!this.user || !this.user.name) return ''
      return this.user.name.charAt(0).toUpperCase() + this.user.name.slice(1)
    }
  },
  methods: {
    toggleEdit() {
      this.$emit('toggle-edit')
    }
  }
}

const InlineList = {
  name: 'InlineList',
  props: {
    items: { type: Array, default: () => [] }
  },
  methods: {
    toggle(task) {
      this.$emit('toggle-task', task)
    }
  }
}

export default {
  name: 'InlineTemplate',
  components: { InlineCounter, UserProfile, InlineList },
  data() {
    return {
      count: 10,
      canEdit: true,
      currentUser: { name: '张三', age: 28 },
      tasks: [
        { id: 1, text: '学习 Vue 2', completed: true },
        { id: 2, text: '迁移到 Vue 3', completed: false },
        { id: 3, text: '测试 inline-template', completed: false }
      ]
    }
  },
  methods: {
    onIncrement(val) {
      this.count = val
    },
    toggleEdit() {
      this.canEdit = !this.canEdit
    },
    toggleTask(task) {
      task.completed = !task.completed
    }
  }
}
</script>

<style scoped>
.inline-template-demo {
  padding: 20px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  font-family: sans-serif;
}
.inline-template-demo h2 {
  color: #9c27b0;
  margin-top: 0;
}
.counter-display {
  background: #f3e5f5;
  padding: 12px;
  border-radius: 4px;
}
.profile-card {
  background: #e8f5e9;
  padding: 12px;
  border-radius: 4px;
}
.task-list {
  list-style: none;
  padding: 0;
}
.task-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
}
.task-list li.done span {
  text-decoration: line-through;
  color: #c0c4cc;
}
.task-list button {
  padding: 4px 12px;
  cursor: pointer;
}
.note {
  margin-top: 16px;
  padding: 12px;
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 4px;
  color: #856404;
}
hr {
  border: none;
  border-top: 1px solid #ebeef5;
  margin: 16px 0;
}
</style>
