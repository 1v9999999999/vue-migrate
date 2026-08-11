<template>
  <div class="basic-sortable">
    <h3>SortableJS 基础 (v-model + group)</h3>
    <a-button @click="addItem">Add</a-button>
    <a-button @click="shuffle">Shuffle</a-button>
    <a-button @click="reverse">Reverse</a-button>

    <ul ref="listRef" class="sortable-list">
      <li v-for="item in list" :key="item.id" :data-id="item.id" class="sortable-item">
        <a-icon type="drag" /> {{ item.text }}
        <a-button size="small" type="link" @click="removeItem(item)">删除</a-button>
      </li>
    </ul>

    <h3>onEnd / onStart / onAdd / onUpdate / onRemove (5 事件)</h3>
    <a-tag v-for="log in logs" :key="log.id" color="blue">{{ log.text }}</a-tag>
  </div>
</template>

<script>
import Sortable from 'sortablejs'

export default {
  name: 'BasicSortableDemo',
  data() {
    return {
      list: [
        { id: 1, text: 'Item 1' },
        { id: 2, text: 'Item 2' },
        { id: 3, text: 'Item 3' },
        { id: 4, text: 'Item 4' },
        { id: 5, text: 'Item 5' }
      ],
      logs: [],
      sortable: null
    }
  },
  mounted() {
    this.initSortable()
  },
  beforeDestroy() {
    if (this.sortable) this.sortable.destroy()
  },
  methods: {
    initSortable() {
      this.sortable = Sortable.create(this.$refs.listRef, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        handle: '.anticon-drag',
        filter: '.ant-btn',
        preventOnFilter: true,
        onStart: (evt) => {
          this.addLog('start', evt)
        },
        onEnd: (evt) => {
          this.addLog('end', evt)
          // sync list
          const items = Array.from(evt.from.children)
          this.list = items.map((el, i) => ({
            id: parseInt(el.dataset.id),
            text: el.innerText.trim()
          }))
        },
        onAdd: (evt) => this.addLog('add', evt),
        onUpdate: (evt) => this.addLog('update', evt),
        onRemove: (evt) => this.addLog('remove', evt),
        onChoose: (evt) => this.addLog('choose', evt),
        onUnchoose: (evt) => this.addLog('unchoose', evt),
        onMove: (evt, originalEvent) => {
          this.addLog('move', evt)
          return true
        },
        onChange: (evt) => this.addLog('change', evt)
      })
    },
    addItem() {
      this.list.push({ id: Date.now(), text: `Item ${this.list.length + 1}` })
    },
    removeItem(item) {
      const idx = this.list.indexOf(item)
      if (idx !== -1) this.list.splice(idx, 1)
    },
    shuffle() {
      this.list = this.list.slice().sort(() => Math.random() - 0.5)
    },
    reverse() {
      this.list = this.list.slice().reverse()
    },
    addLog(type, evt) {
      this.logs.push({ id: Date.now() + Math.random(), text: `${type} #${evt.oldIndex}→${evt.newIndex}` })
      if (this.logs.length > 10) this.logs.shift()
    }
  }
}
</script>

<style scoped>
.sortable-list { list-style: none; padding: 0; }
.sortable-item { padding: 8px 12px; background: #fafafa; border: 1px solid #e8e8e8; margin-bottom: 4px; cursor: move; }
.sortable-ghost { opacity: 0.4; background: #c2e0ff; }
</style>
