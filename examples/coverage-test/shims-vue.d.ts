// shims-vue.d.ts - 让 .ts 文件识别 .vue 模块 (Vue 2.7 + TypeScript)
declare module '*.vue' {
  import Vue from 'vue'
  // Vue 2.7 VueConstructor 写法
  const component: Vue.ComponentOptions<Vue>
  export default component
}

declare module '*.vue?vue&type=script' {
  import Vue from 'vue'
  const component: Vue.ComponentOptions<Vue>
  export default component
}

// 静态资源声明
declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.gif' {
  const src: string
  export default src
}

declare module '*.webp' {
  const src: string
  export default src
}

declare module '*.mp4' {
  const src: string
  export default src
}

declare module '*.mp3' {
  const src: string
  export default src
}

declare module '*.md' {
  const content: string
  export default content
}

// 全局变量 (process.env.VUE_APP_*)
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test' | 'staging'
    VUE_APP_ENV: 'development' | 'production' | 'staging' | 'test' | 'local'
    VUE_APP_TITLE: string
    VUE_APP_VERSION: string
    VUE_APP_LANGUAGE: string
    VUE_APP_BASE_URL: string
    VUE_APP_API_BASE: string
    VUE_APP_API_VERSION: string
    VUE_APP_PROXY_TARGET: string
    VUE_APP_UPLOAD_BASE: string
    VUE_APP_UPLOAD_URL: string
    VUE_APP_WS_URL: string
    VUE_APP_GA_ID: string
    VUE_APP_SENTRY_DSN: string
    VUE_APP_BAIDU_MAP_AK: string
    VUE_APP_AMAP_AK: string
    VUE_APP_DEBUG: string
    VUE_APP_LOG_LEVEL: string
    VUE_APP_SHOW_ERROR: string
    VUE_APP_PERFORMANCE: string
    VUE_APP_VCONSOLE: string
    VUE_APP_ERUDA: string
    VUE_APP_USE_MOCK: string
    VUE_APP_USE_CDN: string
    VUE_APP_USE_NEW_FEATURE: string
    VUE_APP_SHOW_EXPERIMENTAL: string
    VUE_APP_PORT: string
    VUE_APP_OUTPUT_DIR: string
    VUE_APP_API_TIMEOUT: string
    VUE_APP_UPLOAD_TIMEOUT: string
  }
}
