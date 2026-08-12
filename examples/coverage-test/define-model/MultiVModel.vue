<!--
  父组件使用:
  <template>
    <MultiVModel
      v-model:title="article.title"
      v-model:content="article.content"
      v-model:author="article.author"
      v-model:tags="article.tags"
      v-model:visible="showEditor"
      v-model:draft="isDraft"
    />
  </template>
-->

<script setup>
// iter-coverage: 多个 v-model 绑定 (Vue 2 用 :prop.sync, Vue 3 用 v-model:arg)
defineProps(['title', 'content', 'author', 'tags', 'visible', 'draft'])
const emit = defineEmits([
  'update:title', 'update:content', 'update:author',
  'update:tags', 'update:visible', 'update:draft'
])

// 用 defineModel 简化 (Vue 3.4+)
const title = defineModel('title', { type: String, required: true })
const content = defineModel('content', { type: String, default: '' })
const author = defineModel('author')
const tags = defineModel('tags', { default: () => [] })
const visible = defineModel('visible', { type: Boolean, default: false })
const draft = defineModel('draft', { type: Boolean, default: true })
</script>

<template>
  <div v-if="visible" class="editor">
    <input v-model="title" placeholder="title" />
    <textarea v-model="content" />
    <input v-model="author" placeholder="author" />
    <div>
      <input v-for="(t, i) in tags" :key="i" :value="t" @input="tags[i] = $event.target.value" />
      <button @click="tags.push('new')">+ tag</button>
    </div>
    <label><input type="checkbox" v-model="draft" /> 草稿</label>
  </div>
</template>
