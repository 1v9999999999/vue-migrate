// 主应用 main.js (qiankun 2.x 兼容 Vue 3)
import { createApp } from 'vue'
import { registerMicroApps, start, setDefaultMountApp, addGlobalUncaughtErrorHandler } from 'qiankun'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')

// 注册子应用
registerMicroApps([
  {
    name: 'sub-react',
    entry: '//localhost:7100',
    container: '#subapp-react',
    activeRule: '/react',
    props: { msg: 'from main' }
  },
  {
    name: 'sub-vue3',
    entry: '//localhost:7101',
    container: '#subapp-vue',
    activeRule: '/vue3',
    props: { token: getToken() }
  },
  {
    name: 'sub-vue2',
    entry: '//localhost:7102',
    container: '#subapp-vue2',
    activeRule: '/vue2'
  }
], {
  beforeLoad: (app) => {
    console.log('before load', app.name)
    return Promise.resolve()
  },
  beforeMount: (app) => console.log('before mount', app.name),
  afterMount: (app) => console.log('after mount', app.name),
  beforeUnmount: (app) => console.log('before unmount', app.name)
})

setDefaultMountApp('/vue3')
addGlobalUncaughtErrorHandler((event) => console.error('qiankun error:', event))
start({ sandbox: { strictStyleIsolation: true, experimentalStyleIsolation: true } })
