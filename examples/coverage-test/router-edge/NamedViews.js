// 命名视图 (components 复数) —— 一个路由同时渲染多个 <router-view name="...">
import Layout from '@/layout/index.vue'

export default [
  {
    path: '/',
    name: 'HomeNamed',
    components: {
      default: () => import('@/views/home/index.vue'),
      sidebar: () => import('@/layout/components/Sidebar/index.vue'),
      header: () => import('@/layout/components/Navbar/index.vue'),
      footer: () => import('@/layout/components/Footer.vue')
    },
    meta: { title: '首页', keepAlive: true }
  },
  {
    path: '/user/:id',
    name: 'UserNamed',
    components: {
      default: () => import('@/views/user/detail.vue'),
      sidebar: () => import('@/views/user/sidebar.vue')
    },
    // 不同命名视图分别传 props
    props: { default: true, sidebar: false }
  },
  {
    path: '/settings',
    component: Layout,
    children: [
      {
        // 子路由也可使用命名视图
        path: 'profile',
        components: {
          default: () => import('@/views/settings/profile.vue'),
          sidebar: () => import('@/views/settings/menu.vue')
        }
      }
    ]
  },
  {
    // 命名视图 + 重定向到具名路由
    path: '/dashboard-legacy',
    redirect: { name: 'HomeNamed' }
  }
]
