<template>
  <div class="vuedraggable-demo">
    <h3>vuedraggable 基础 (4.x for Vue 2 旧 API)</h3>
    <draggable
      v-model="myList"
      :animation="200"
      :handle="'.drag-handle'"
      @start="onStart"
      @end="onEnd"
      @change="onChange"
      ghost-class="ghost"
    >
      <div v-for="element in myList" :key="element.id" class="list-item">
        <a-icon type="bars" class="drag-handle" />
        <span>{{ element.name }}</span>
        <a-button size="small" type="link" @click="remove(element)">删除</a-button>
      </div>
    </draggable>
    <a-button @click="addItem">添加</a-button>

    <h3>vuedraggable component (组件写法)</h3>
    <draggable v-model="myList" item-key="id" tag="ul" :component-data="{ class: 'custom-list' }">
      <template #item="{ element }">
        <li class="custom-item">{{ element.name }} ({{ element.id }})</li>
      </template>
    </draggable>

    <h3>sort + filter + preventOnFilter</h3>
    <draggable
      v-model="filterList"
      :sort="true"
      :filter="'.no-drag'"
      :prevent-on-filter="true"
    >
      <div v-for="item in filterList" :key="item.id" class="list-item">
        <span class="no-drag" @click="onNoDrag(item)">点击无效</span>
        <span>{{ item.text }}</span>
      </div>
    </draggable>

    <h3>group 互拖 (use a for v-model swap)</h3>
    <div style="display: flex; gap: 16px">
      <draggable
        v-model="groupA"
        group="people"
        @change="evt => onGroupChange('A', evt)"
        style="width: 200px"
      >
        <div v-for="p in groupA" :key="p.id" class="list-item">{{ p.name }}</div>
      </draggable>
      <draggable
        v-model="groupB"
        group="people"
        @change="evt => onGroupChange('B', evt)"
        style="width: 200px"
      >
        <div v-for="p in groupB" :key="p.id" class="list-item">{{ p.name }}</div>
      </draggable>
    </div>

    <h3>move callback (拒绝特定移动)</h3>
    <draggable v-model="myList" :move="onMove">
      <div v-for="element in myList" :key="element.id" class="list-item">
        {{ element.name }}
      </div>
    </draggable>

    <h3>clone function (拖过去是副本)</h3>
    <draggable v-model="srcList" :clone="cloneItem" group="clone-grp">
      <div v-for="item in srcList" :key="item.id" class="list-item">{{ item.text }}</div>
    </draggable>
    <draggable v-model="dstList" group="clone-grp">
      <div v-for="item in dstList" :key="item.id" class="list-item">{{ item.text }}</div>
    </draggable>
  </div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
  name: 'VuedraggableDemo',
  components: { draggable },
  data() {
    return {
      myList: [
        { id: 1, name: 'Vue 2' },
        { id: 2, name: 'Vue 3' },
        { id: 3, name: 'React' },
        { id: 4, name: 'Angular' }
      ],
      filterList: [
        { id: 1, text: '可拖 1' },
        { id: 2, text: '可拖 2' },
        { id: 3, text: '可拖 3' }
      ],
      groupA: [
        { id: 'a1', name: 'Alice' },
        { id: 'a2', name: 'Bob' }
      ],
      groupB: [
        { id: 'b1', name: 'Carol' },
        { id: 'b2', name: 'Dave' }
      ],
      srcList: [
        { id: 1, text: '源 A' },
        { id: 2, text: '源 B' }
      ],
      dstList: []
    }
  },
  methods: {
    onStart(evt) { console.log('start', evt) },
    onEnd(evt) { console.log('end', evt) },
    onChange(evt) { console.log('change', evt) },
    addItem() {
      this.myList.push({ id: Date.now(), name: `Item ${this.myList.length + 1}` })
    },
    remove(item) {
      const idx = this.myList.indexOf(item)
      if (idx !== -1) this.myList.splice(idx, 1)
    },
    onNoDrag(item) {
      this.$message.info(`点击 ${item.text}, 不触发拖动`)
    },
    onGroupChange(group, evt) {
      console.log(`group ${group} change`, evt)
    },
    onMove(evt, originalEvent) {
      // 拒绝 "Vue 2" 移动到 index 0
      if (evt.draggedContext.element.name === 'Vue 2' && evt.relatedContext.index === 0) {
        return false
      }
      return true
    },
    cloneItem(item) {
      return { ...item, id: `${item.id}-clone-${Date.now()}` }
    }
  }
}
</script>

<style scoped>
.list-item { padding: 8px 12px; background: #fff; border: 1px solid #e8e8e8; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
.drag-handle { cursor: move; }
.ghost { opacity: 0.4; background: #c2e0ff; }
.no-drag { cursor: pointer; }
.custom-list { list-style: none; padding: 0; }
.custom-item { padding: 6px 10px; background: #f6ffed; border: 1px dashed #b7eb8f; margin-bottom: 4px; }
</style>
