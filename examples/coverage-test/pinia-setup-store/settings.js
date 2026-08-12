// iter-coverage: Pinia setup-style store + 持久化 plugin (subscribe / $onAction)
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref(localStorage.getItem('theme') || 'light')
  const sidebar = ref(true)
  const language = ref('zh-CN')
  const density = ref('default')

  // watch 自动持久化
  watch(theme, (v) => localStorage.setItem('theme', v))
  watch(language, (v) => localStorage.setItem('language', v))

  function toggleTheme() { theme.value = theme.value === 'light' ? 'dark' : 'light' }
  function toggleSidebar() { sidebar.value = !sidebar.value }

  return { theme, sidebar, language, density, toggleTheme, toggleSidebar }
})

// 配套的持久化 plugin
export function persistPlugin({ store }) {
  const saved = localStorage.getItem(`pinia-${store.$id}`)
  if (saved) store.$patch(JSON.parse(saved))
  store.$subscribe((mutation, state) => {
    localStorage.setItem(`pinia-${store.$id}`, JSON.stringify(state))
  })
}
