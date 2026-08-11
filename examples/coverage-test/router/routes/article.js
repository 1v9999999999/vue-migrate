import Layout from '@/layout/index.vue'

const articleRoutes = [
  {
    path: '/article',
    component: Layout,
    redirect: '/article/list',
    name: 'Article',
    meta: { title: '文章管理', icon: 'file-text', roles: ['admin', 'editor'] },
    children: [
      {
        path: 'list',
        name: 'ArticleList',
        component: () => import('@/views/article/list.vue'),
        meta: { title: '文章列表', icon: 'unordered-list', keepAlive: true }
      },
      {
        path: 'create',
        name: 'ArticleCreate',
        component: () => import('@/views/article/create.vue'),
        meta: { title: '创建文章', icon: 'edit', activeMenu: '/article/list' }
      },
      {
        path: 'edit/:id(\\d+)',
        name: 'ArticleEdit',
        component: () => import('@/views/article/edit.vue'),
        meta: { title: '编辑文章', noCache: true, activeMenu: '/article/list' },
        hidden: true,
        props: true
      },
      {
        path: 'category',
        name: 'ArticleCategory',
        component: () => import('@/views/article/category.vue'),
        meta: { title: '分类管理', icon: 'apartment' }
      }
    ]
  }
]

export default articleRoutes
