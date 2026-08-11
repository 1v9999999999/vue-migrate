// Vuex 模块类型定义 (TS 风格但用 .js 注释方式)
// 注: 真实项目用 .d.ts, 这里演示迁移期的 JS 注释规范

/**
 * @typedef {Object} UserInfo
 * @property {number} id
 * @property {string} username
 * @property {string} nickname
 * @property {string} avatar
 * @property {string[]} roles
 * @property {string[]} permissions
 * @property {string} email
 * @property {string} phone
 * @property {string} department
 */

/**
 * @typedef {Object} UserState
 * @property {string} token
 * @property {UserInfo} userInfo
 * @property {string[]} roles
 * @property {string[]} permissions
 * @property {string} avatar
 * @property {string} name
 */

/**
 * @typedef {Object} AppState
 * @property {{opened: boolean, withoutAnimation: boolean}} sidebar
 * @property {string} device
 * @property {string} size
 * @property {string} language
 */

/**
 * @typedef {Object} SettingsState
 * @property {boolean} showSettings
 * @property {boolean} fixedHeader
 * @property {boolean} sidebarLogo
 * @property {boolean} tagsView
 * @property {string} theme
 * @property {string} themeName
 * @property {string} overallStyle
 * @property {string} layout
 * @property {boolean} collapsed
 */

/**
 * @typedef {Object} PermissionState
 * @property {import('vue-router').RouteConfig[]} routes
 * @property {import('vue-router').RouteConfig[]} addRoutes
 */

/**
 * @typedef {Object} RootState
 * @property {boolean} globalLoading
 * @property {boolean} sidebarVisible
 */

// Mutation types 常量
export const MUTATION_TYPES = {
  // user
  USER_SET_TOKEN: 'user/SET_TOKEN',
  USER_SET_USER_INFO: 'user/SET_USER_INFO',
  USER_SET_ROLES: 'user/SET_ROLES',
  USER_SET_PERMISSIONS: 'user/SET_PERMISSIONS',
  USER_SET_AVATAR: 'user/SET_AVATAR',
  USER_SET_NAME: 'user/SET_NAME',
  USER_CLEAR_USER: 'user/CLEAR_USER',
  // app
  APP_TOGGLE_SIDEBAR: 'app/TOGGLE_SIDEBAR',
  APP_CLOSE_SIDEBAR: 'app/CLOSE_SIDEBAR',
  APP_TOGGLE_DEVICE: 'app/TOGGLE_DEVICE',
  APP_SET_SIZE: 'app/SET_SIZE',
  APP_SET_LANGUAGE: 'app/SET_LANGUAGE',
  // settings
  SETTINGS_CHANGE_SETTING: 'settings/CHANGE_SETTING',
  SETTINGS_SET_THEME: 'settings/SET_THEME',
  SETTINGS_SET_OVERALL_STYLE: 'settings/SET_OVERALL_STYLE',
  SETTINGS_SET_LAYOUT: 'settings/SET_LAYOUT',
  SETTINGS_SET_COLLAPSED: 'settings/SET_COLLAPSED',
  // permission
  PERMISSION_SET_ROUTES: 'permission/SET_ROUTES',
  PERMISSION_RESET_ROUTES: 'permission/RESET_ROUTES',
  // global
  GLOBAL_SET_GLOBAL_LOADING: 'SET_GLOBAL_LOADING',
  GLOBAL_TOGGLE_SIDEBAR: 'TOGGLE_SIDEBAR',
  GLOBAL_RESET_ALL: 'RESET_ALL'
}

// Action types 常量
export const ACTION_TYPES = {
  USER_LOGIN: 'user/login',
  USER_LOGOUT: 'user/logout',
  USER_GET_INFO: 'user/getInfo',
  USER_FED_LOGOUT: 'user/fedLogout',
  USER_RESET_TOKEN: 'user/resetToken',
  USER_CHANGE_ROLES: 'user/changeRoles',
  APP_TOGGLE_SIDE_BAR: 'app/toggleSideBar',
  APP_CLOSE_SIDE_BAR: 'app/closeSideBar',
  APP_TOGGLE_DEVICE: 'app/toggleDevice',
  APP_SET_SIZE: 'app/setSize',
  APP_SET_LANGUAGE: 'app/setLanguage',
  SETTINGS_CHANGE_SETTING: 'settings/changeSetting',
  SETTINGS_SET_THEME: 'settings/setTheme',
  SETTINGS_SET_OVERALL_STYLE: 'settings/setOverallStyle',
  SETTINGS_SET_LAYOUT: 'settings/setLayout',
  SETTINGS_RESET_SETTINGS: 'settings/resetSettings',
  PERMISSION_GENERATE_ROUTES: 'permission/generateRoutes',
  PERMISSION_RESET_ROUTES: 'permission/resetRoutes',
  GLOBAL_TOGGLE_SIDEBAR: 'toggleSidebar',
  GLOBAL_RESET_ALL: 'resetAll'
}
