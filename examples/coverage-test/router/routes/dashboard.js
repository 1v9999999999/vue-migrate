// 业务路由分模块配置
import Layout from '@/layout/index.vue'

// dashboard 模块
const dashboardRoutes = [
  {
    path: '/dashboard',
    component: Layout,
    children: [
      {
        path: 'index',
        name: 'DashboardIndex',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '首页', icon: 'home', affix: true, keepAlive: true }
      },
      {
        path: 'analysis',
        name: 'DashboardAnalysis',
        component: () => import('@/views/dashboard/analysis.vue'),
        meta: { title: '分析页', icon: 'fund', roles: ['admin', 'editor'] }
      }
    ]
  }
]

export default dashboardRoutes
