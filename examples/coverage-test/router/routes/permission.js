import Layout from '@/layout/index.vue'

const permissionRoutes = [
  {
    path: '/permission',
    component: Layout,
    redirect: '/permission/page',
    name: 'Permission',
    meta: { title: '权限测试', icon: 'lock', roles: ['admin', 'editor'] },
    alwaysShow: true,
    children: [
      {
        path: 'page',
        name: 'PermissionPage',
        component: () => import('@/views/permission/page.vue'),
        meta: { title: '页面权限', roles: ['admin'] }
      },
      {
        path: 'directive',
        name: 'PermissionDirective',
        component: () => import('@/views/permission/directive.vue'),
        meta: { title: '指令权限' }
      },
      {
        path: 'role',
        name: 'PermissionRole',
        component: () => import('@/views/permission/role.vue'),
        meta: { title: '角色权限', roles: ['admin'] }
      }
    ]
  }
]

export default permissionRoutes
