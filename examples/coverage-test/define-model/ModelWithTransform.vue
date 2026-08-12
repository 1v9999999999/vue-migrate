<script setup>
// iter-coverage: defineModel + get/set transform
const date = defineModel('date', {
  // 自动从 string 转 Date
  get(value) { return value ? new Date(value) : null },
  set(value) { return value instanceof Date ? value.toISOString().split('T')[0] : value }
})

const tags = defineModel('tags', {
  default: () => [],
  // 数组: 始终返回新引用 (避免直接 mutate props 报错)
  get(value) { return Array.isArray(value) ? value : [] },
  set(value) { return Array.isArray(value) ? [...value] : [] }
})

function remove(t) {
  const i = tags.value.indexOf(t)
  if (i >= 0) tags.value = tags.value.filter(x => x !== t)
}
function add(v) {
  if (!v) return
  tags.value = [...tags.value, v]
}
</script>

<template>
  <input type="date" :value="date" @input="date = $event.target.value" />
  <div>
    <span v-for="tag in tags" :key="tag">{{ tag }} <button @click="remove(tag)">×</button></span>
    <input @keyup.enter="add($event.target.value)" placeholder="add tag" />
  </div>
</template>
