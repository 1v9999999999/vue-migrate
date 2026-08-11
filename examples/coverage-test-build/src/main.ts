// main.ts - 极简入口
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { createPinia } from 'pinia'

// 样式入口 (用 @use 串联所有)
import './styles/index.scss'

// Stylus 文件单独 import (不能用 SCSS @use)
import './styles/typography.styl'

// LESS 文件单独 import (不能用 SCSS @use)
import './styles/ant-overrides.less'

// Element Plus
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

// Ant Design Vue
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

const app = createApp(App)

// 注册 Element Plus icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(Antd)
app.mount('#app')
