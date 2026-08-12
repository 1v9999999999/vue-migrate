// iter-122a: Pinia-only project 覆盖率测试
//   这个项目没有 vuex, 全部用 pinia. vuex-pinia 应该 short-circuit + log info.

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
