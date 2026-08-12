<script setup>
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const userInput = ref('<script>alert("XSS")</script><img src=x onerror=alert(1)><b>safe</b>')
const safeHtml = computed(() => DOMPurify.sanitize(userInput.value))
const markdownHtml = computed(() => DOMPurify.sanitize(marked(userInput.value)))

// 配置 DOMPurify
const config = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'title'],
  ALLOW_DATA_ATTR: false
}

const strictSafe = computed(() => DOMPurify.sanitize(userInput.value, config))
</script>

<template>
  <div>
    <textarea v-model="userInput" rows="4" />
    <h3>安全 HTML</h3>
    <div v-html="safeHtml"></div>
    <h3>Markdown</h3>
    <div v-html="markdownHtml"></div>
    <h3>严格白名单</h3>
    <div v-html="strictSafe"></div>
  </div>
</template>
