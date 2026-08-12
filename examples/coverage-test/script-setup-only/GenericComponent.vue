<script setup lang="ts" generic="T extends string | number, V = unknown">
// Vue 3.3+ 泛型组件
// 使用: <MyGeneric :items="['a','b']" :selected="'a'" @select="..." />

interface Props {
  items: T[]
  selected?: T
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  selected: undefined,
  disabled: false
})

const emit = defineEmits<{
  select: [item: T, index: number]
  'update:selected': [item: T]
}>()

const selectedIndex = computed(() => props.items.indexOf(props.selected as T))

function handleClick(item: T, index: number) {
  if (props.disabled) return
  emit('select', item, index)
  emit('update:selected', item)
}
</script>

<template>
  <ul class="generic-list">
    <li
      v-for="(item, i) in items"
      :key="String(item)"
      :class="{ active: i === selectedIndex, disabled }"
      @click="handleClick(item, i)"
    >
      <slot :item="item" :index="i" :active="i === selectedIndex">
        {{ item }}
      </slot>
    </li>
  </ul>
</template>
