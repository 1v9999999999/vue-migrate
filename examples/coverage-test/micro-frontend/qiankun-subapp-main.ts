// 子应用 main.ts (qiankun)
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'

let instance = null

function render(props = {}) {
  const { container } = props
  instance = createApp(App)
  instance.use(createPinia())
  instance.use(router)
  instance.mount(container ? container.querySelector('#app') : '#app')
}

// 独立运行
if (!window.__POWERED_BY_QIANKUN__) {
  render()
}

// qiankun 生命周期
export async function bootstrap() {
  console.log('vue3 app bootstraped')
}
export async function mount(props) {
  console.log('vue3 app mount', props)
  render(props)
}
export async function unmount() {
  instance?.unmount()
  instance = null
}
