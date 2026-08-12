// i18n.js
import { createI18n } from 'vue-i18n'

export const i18n = createI18n({
  legacy: false,  // composition API
  locale: localStorage.getItem('lang') || 'zh-CN',
  fallbackLocale: 'en',
  messages: {}  // 初始空
})

// 动态加载
export async function loadLanguage(lang) {
  const messages = await import(`./locales/${lang}.json`)
  i18n.global.setLocaleMessage(lang, messages.default)
  i18n.global.locale.value = lang
  localStorage.setItem('lang', lang)
  document.querySelector('html').setAttribute('lang', lang)
}

// 预加载
loadLanguage(localStorage.getItem('lang') || 'zh-CN')

<script setup>
import { useI18n } from 'vue-i18n'
const { t, locale, availableLocales } = useI18n()

async function switchTo(lang) {
  await loadLanguage(lang)
}
</script>

<template>
  <div>
    <select :value="locale" @change="switchTo($event.target.value)">
      <option v-for="l in availableLocales" :key="l" :value="l">{{ l }}</option>
    </select>
    <h1>{{ t('home.title') }}</h1>
    <p>{{ t('home.welcome', { name: 'admin' }) }}</p>
  </div>
</template>
