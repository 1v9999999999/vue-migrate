<script setup>
import { computed, useTemplateRef } from 'vue'

defineOptions({ name: 'AllMacros', inheritAttrs: false })

const props = defineProps({
  msg: { type: String, required: true },
  count: { type: Number, default: 0 }
})

const emit = defineEmits(['change', 'submit'])

const model = defineModel()

const slots = defineSlots()

const localRef = useTemplateRef('localEl')

const doubled = computed(() => props.count * 2)

defineExpose({ doubled, localRef })

function handleClick() { emit('change', doubled.value) }
</script>

<template>
  <div ref="localEl" @click="handleClick">
    <input v-model="model" />
    <p>{{ props.msg }} - {{ doubled }}</p>
    <slot />
  </div>
</template>
