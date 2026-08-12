// 懒加载各种写法 (含 Vue 2 / webpack 旧写法, 多为迁移重点)
export default [
  // 1. 标准动态 import
  {
    path: '/a',
    name: 'A',
    component: () => import('@/views/A.vue')
  },

  // 2. 带 webpackChunkName 魔法注释 (分包命名)
  {
    path: '/b',
    name: 'B',
    component: () => import(/* webpackChunkName: "group-b" */ '@/views/B.vue')
  },

  // 3. import().then 取 default (兼容 CommonJS 默认导出)
  {
    path: '/c',
    name: 'C',
    component: () => import('@/views/C.vue').then(m => m.default)
  },

  // 4. AMD require 旧写法 —— Vue 3 已废弃
  {
    path: '/d',
    name: 'D',
    component: resolve => require(['@/views/D.vue'], resolve)
  },

  // 5. webpack require.ensure 旧写法 (chunk 拆分)
  {
    path: '/e',
    name: 'E',
    component: resolve => require.ensure([], () => resolve(require('@/views/E.vue')))
  },

  // 6. alias 路径 (@ -> src)
  {
    path: '/f',
    name: 'F',
    component: () => import('@/views/F.vue')
  },

  // 7. 动态拼接路径 (按需加载, 注意 Vue 3 推荐用静态 import)
  {
    path: '/g/:type',
    name: 'G',
    component: route => import(`@/views/dynamic/${route.params.type}.vue`)
  },

  // 8. 命名视图懒加载 (components 复数, 每个视图各自懒加载)
  {
    path: '/h',
    name: 'H',
    components: {
      default: () => import('@/views/H.vue'),
      sidebar: () => import('@/views/Hsidebar.vue')
    }
  },

  // 9. 预取标记
  {
    path: '/i',
    name: 'I',
    component: () =>
      import(/* webpackPrefetch: true, webpackChunkName: "prefetch-i" */ '@/views/I.vue')
  }
]
