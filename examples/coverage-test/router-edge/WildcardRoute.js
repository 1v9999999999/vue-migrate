// 通配符路由边缘场景 (Vue 2 写法)
// Vue 3 (vue-router 4) 废弃 * 通配符, 需迁移为 /:pathMatch(.*)*
import Layout from '@/layout/index.vue'

const NotFound = () => import('@/views/error/404.vue')
const Admin = () => import('@/views/admin/index.vue')

export default [
  // 1. 全局通配符兜底 —— Vue 3 需改为 { path: '/:pathMatch(.*)*', ... }
  { path: '*', name: 'NotFound', component: NotFound },

  // 2. 带前缀的通配符 —— Vue 3 需改为 '/admin/:pathMatch(.*)*'
  { path: '/admin/*', component: Admin },

  // 3. 中间通配符 —— Vue 3 不再支持, 需用自定义正则参数
  { path: '/docs/*/detail', component: () => import('@/views/docs/detail.vue') },

  // 4. 通配符重定向 (动态拼接新路径)
  {
    path: '/old/*',
    redirect: to => `/new${to.path.replace('/old', '')}`
  },

  // 5. 带命名参数的通配符 (通过 to.params.pathMatch 获取剩余路径)
  {
    path: '/files/*',
    name: 'FileCatchAll',
    component: () => import('@/views/files/index.vue')
  },

  // 6. 多段前缀通配
  { path: '/old-api/v1/*', component: () => import('@/views/legacy/api.vue') },

  // 7. 命名参数 + 通配符混合
  { path: '/:lang/docs/*', component: () => import('@/views/docs/index.vue') },

  // 8. 嵌套路由内的通配子路由
  {
    path: '/external',
    component: Layout,
    children: [
      { path: 'docs/*', component: () => import('@/views/external/docs.vue') }
    ]
  }
]
