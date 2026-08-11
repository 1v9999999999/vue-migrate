<template>
  <div class="multi-group">
    <h3>多 group 互拖 (group.pull + group.put)</h3>
    <div style="display: flex; gap: 16px">
      <div class="group">
        <h4>待办 (todo)</h4>
        <ul ref="todoRef" class="list">
          <li v-for="item in todo" :key="item.id" :data-id="item.id">
            {{ item.text }}
          </li>
        </ul>
      </div>
      <div class="group">
        <h4>进行中 (doing)</h4>
        <ul ref="doingRef" class="list">
          <li v-for="item in doing" :key="item.id" :data-id="item.id">
            {{ item.text }}
          </li>
        </ul>
      </div>
      <div class="group">
        <h4>完成 (done)</h4>
        <ul ref="doneRef" class="list">
          <li v-for="item in done" :key="item.id" :data-id="item.id">
            {{ item.text }}
          </li>
        </ul>
      </div>
    </div>

    <h3>clone mode (拖过去会复制)</h3>
    <a-button @click="resetGroups">重置</a-button>
  </div>
</template>

<script>
import Sortable from 'sortablejs'

export default {
  name: 'MultiGroupDemo',
  data() {
    return {
      todo: [
        { id: 1, text: '需求评审' },
        { id: 2, text: '原型设计' },
        { id: 3, text: '技术选型' }
      ],
      doing: [
        { id: 4, text: '后端 API' },
        { id: 5, text: '前端联调' }
      ],
      done: [
        { id: 6, text: '项目搭建' },
        { id: 7, text: 'UI 走查' }
      ],
      sortables: []
    }
  },
  mounted() {
    this.initGroups()
  },
  beforeDestroy() {
    this.sortables.forEach(s => s.destroy())
  },
  methods: {
    initGroups() {
      // 待办 → 双向
      this.sortables.push(Sortable.create(this.$refs.todoRef, {
        group: { name: 'kanban', pull: true, put: true },
        animation: 150,
        onAdd: (evt) => this.syncFromDOM(this.$refs.todoRef, 'todo'),
        onUpdate: (evt) => this.syncFromDOM(this.$refs.todoRef, 'todo'),
        onRemove: (evt) => this.syncFromDOM(this.$refs.todoRef, 'todo')
      }))
      // 进行中 → 双向
      this.sortables.push(Sortable.create(this.$refs.doingRef, {
        group: 'kanban',
        animation: 150,
        onAdd: (evt) => this.syncFromDOM(this.$refs.doingRef, 'doing'),
        onUpdate: (evt) => this.syncFromDOM(this.$refs.doingRef, 'doing'),
        onRemove: (evt) => this.syncFromDOM(this.$refs.doingRef, 'doing')
      }))
      // 完成 → 只出不进
      this.sortables.push(Sortable.create(this.$refs.doneRef, {
        group: { name: 'kanban', pull: 'clone', put: false },
        sort: false,
        animation: 150
      }))
    },
    syncFromDOM(ref, key) {
      const items = Array.from(ref.children)
      this[key] = items.map(el => ({
        id: parseInt(el.dataset.id),
        text: el.textContent.trim()
      }))
    },
    resetGroups() {
      this.todo = [
        { id: 1, text: '需求评审' },
        { id: 2, text: '原型设计' },
        { id: 3, text: '技术选型' }
      ]
      this.doing = [
        { id: 4, text: '后端 API' },
        { id: 5, text: '前端联调' }
      ]
      this.done = [
        { id: 6, text: '项目搭建' },
        { id: 7, text: 'UI 走查' }
      ]
    }
  }
}
</script>

<style scoped>
.list { list-style: none; padding: 8px; min-height: 200px; background: #f0f2f5; min-width: 200px; }
.list li { padding: 8px 12px; background: #fff; border: 1px solid #d9d9d9; margin-bottom: 4px; cursor: move; }
.group h4 { margin: 0 0 8px; }
</style>
