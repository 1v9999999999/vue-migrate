// 主应用 - wujie
import { createApp } from 'vue'
import { setupApp } from 'wujie-vue3'
import App from './App.vue'

const app = createApp(App)
app.use(setupApp, {
  name: 'main',
  url: 'http://localhost:8080',
  attrs: { /* iframe attrs */ },
  plugins: [
    { cssBefore: () => import('@/styles/main.css') }
  ],
  beforeLoad: () => console.log('before load'),
  beforeMount: () => console.log('before mount'),
  afterMount: () => console.log('after mount')
})
app.mount('#app')
