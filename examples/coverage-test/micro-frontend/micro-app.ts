// 主应用 main.ts
import microApp from '@micro-zoe/micro-app'

microApp.start({
  'router-mode': 'history',
  'disable-scopecss': false,
  'disable-sandbox': false,
  inline: true
})
