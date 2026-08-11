// 路由工具
import path from 'path-browserify'

/**
 * 过滤异步路由, 返回当前角色可访问的路由
 * @param {RouteConfig[]} routes - 异步路由表
 * @param {string[]} roles - 角色列表
 */
export function filterAsyncRoutes(routes, roles) {
  const res = []
  routes.forEach(route => {
    const tmp = { ...route }
    if (tmp.children) {
      tmp.children = filterAsyncRoutes(tmp.children, roles)
    }
    if (hasPermission(roles, tmp)) {
      res.push(tmp)
    }
  })
  return res
}

function hasPermission(roles, route) {
  if (route.meta && route.meta.roles) {
    return roles.some(role => route.meta.roles.includes(role))
  }
  return true
}

/**
 * 排序路由 (按 sort 字段升序)
 */
export function sortRoutes(routes) {
  return routes.map(route => {
    if (route.children && route.children.length) {
      route.children = sortRoutes(route.children)
    }
    if (route.meta && typeof route.meta.sort !== 'undefined') {
      return route
    }
    return { ...route, meta: { ...route.meta, sort: 0 } }
  }).sort((a, b) => (a.meta?.sort || 0) - (b.meta?.sort || 0))
}

/**
 * 解析面包屑
 */
export function getBreadcrumbs(route) {
  let matched = route.matched.filter(item => item.meta && item.meta.title)
  if (!matched.length) return []
  return [{
    path: '/dashboard',
    meta: { title: '首页' }
  }].concat(matched)
}

/**
 * 扁平化路由表 (树形 → 一维数组, 给菜单组件用)
 */
export function flattenRoutes(routes) {
  const result = []
  const walk = (list) => {
    list.forEach(r => {
      if (r.meta && r.meta.title) {
        result.push({
          path: r.path,
          name: r.name,
          title: r.meta.title,
          icon: r.meta.icon,
          hidden: r.hidden
        })
      }
      if (r.children) walk(r.children)
    })
  }
  walk(routes)
  return result
}
