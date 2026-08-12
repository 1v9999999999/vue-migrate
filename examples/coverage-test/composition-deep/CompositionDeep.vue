<script setup>
import { ref, computed, provide, inject, readonly, watch } from 'vue'

// === 1. provide / inject + ref ===
const theme = ref('dark')
const user = ref({ name: 'admin', role: 'admin' })
const config = ref({ apiBase: '/api', timeout: 5000 })

// readonly 防止子组件改
provide('theme', readonly(theme))
provide('user', readonly(user))
provide('config', readonly(config))
provide('updateTheme', (newTheme) => { theme.value = newTheme })

// === 2. 跨组件共享的 ref + computed + watch 深组合 ===
const items = ref([])
const filter = ref('')
const sortBy = ref('name')
const sortOrder = ref('asc')

const filteredItems = computed(() => {
  if (!filter.value) return items.value
  return items.value.filter(i => i.name.includes(filter.value))
})

const sortedItems = computed(() => {
  const arr = [...filteredItems.value]
  arr.sort((a, b) => {
    const av = a[sortBy.value]
    const bv = b[sortBy.value]
    if (av < bv) return sortOrder.value === 'asc' ? -1 : 1
    if (av > bv) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })
  return arr
})

// 复杂的 watch: 多 source + immediate + deep
watch(
  [items, filter, sortBy, sortOrder],
  ([newItems, newFilter]) => {
    console.log('items or filters changed:', newItems.length, newFilter)
  },
  { deep: true, immediate: true }
)

// === 3. watch + flush + once + deep 组合 ===
watch(items, (newVal) => {
  console.log('items changed (post-flush):', newVal)
}, { flush: 'post', deep: true })

// === 4. ref + watchEffect 自动追踪 ===
import { ref as createRef, watchEffect } from 'vue'
const localState = createRef({ a: 1, b: 2 })
watchEffect(() => {
  // 自动追踪 localState.value.a 和 localState.value.b
  console.log('localState changed:', localState.value.a, localState.value.b)
})

// === 5. computed 链 (复杂派生) ===
const fullName = computed(() => `${user.value.name} (${user.value.role})`)
const summary = computed(() => {
  return `${fullName.value}, items: ${sortedItems.value.length}`
})

function addItem(item) {
  items.value.push(item)
}

function toggleSort(key) {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = key
    sortOrder.value = 'asc'
  }
}
</script>

<template>
  <div class="composition-deep">
    <h2>{{ summary }}</h2>
    <input v-model="filter" placeholder="过滤" />
    <button @click="toggleSort('name')">按名称排序</button>
    <button @click="toggleSort('id')">按 ID 排序</button>
    <button @click="addItem({ id: Date.now(), name: 'new item' })">添加</button>
    <ul>
      <li v-for="item in sortedItems" :key="item.id">
        {{ item.name }} (id={{ item.id }})
      </li>
    </ul>
  </div>
</template>
