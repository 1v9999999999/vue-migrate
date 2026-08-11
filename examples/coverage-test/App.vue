<template>
  <a-config-provider :locale="zh_CN">
    <a-locale-provider :locale="zh_CN">
      <error-boundary>
        <div id="app" :class="appClassName">
          <!-- 顶部进度条 (路由切换) -->
          <nprogress-container />

          <!-- 主体 layout: sidebar + main + (tags-view) -->
          <el-container direction="vertical" class="app-container">
            <el-header v-if="showHeader" height="60px" class="app-header">
              <app-header />
            </el-header>

            <el-container class="app-body">
              <el-aside v-if="showSidebar" :width="sidebarWidth" class="app-aside">
                <app-sidebar />
              </el-aside>

              <el-main class="app-main">
                <!-- transition + keep-alive + router-view 三件套 -->
                <app-tags-view v-if="showTagsView" />

                <transition name="fade-transform" mode="out-in">
                  <keep-alive :include="cachedViews" :exclude="excludeCachedViews">
                    <router-view v-if="isRouterAlive" :key="$route.fullPath" />
                  </keep-alive>
                </transition>
              </el-main>
            </el-container>
          </el-container>

          <!-- 全局 service 组件 -->
          <error-log />
          <screenfull-modal />
          <theme-picker />

          <!-- i18n key 全集测试 -->
          <i18n-test-panel v-if="VUE_APP_DEBUG" />

          <!-- 第三方 widget (右下角) -->
          <customer-service-widget v-if="showCSWidget" />
        </div>
      </error-boundary>
    </a-locale-provider>
  </a-config-provider>
</template>

<script>
import zh_CN from 'ant-design-vue/lib/locale-provider/zh_CN'
import en_US from 'ant-design-vue/lib/locale-provider/en_US'
import { AppHeader, AppSidebar, AppTagsView } from '@/layout/components'
import ErrorBoundary from '@/components/ErrorBoundary'
import ErrorLog from '@/components/ErrorLog'
import ScreenfullModal from '@/components/ScreenfullModal'
import ThemePicker from '@/components/ThemePicker'
import I18nTestPanel from '@/components/I18nTestPanel'
import CustomerServiceWidget from '@/components/CustomerServiceWidget'
import NprogressContainer from '@/components/NprogressContainer'

export default {
  name: 'App',
  components: {
    AppHeader,
    AppSidebar,
    AppTagsView,
    ErrorBoundary,
    ErrorLog,
    ScreenfullModal,
    ThemePicker,
    I18nTestPanel,
    CustomerServiceWidget,
    NprogressContainer
  },
  data() {
    return {
      zh_CN,
      en_US,
      isRouterAlive: true,
      // 错误测试用 flag
      errorTestMode: false,
      timer: null
    }
  },
  computed: {
    VUE_APP_DEBUG() {
      return process.env.VUE_APP_DEBUG === 'true'
    },
    showCSWidget() {
      return this.$store.getters.userInfo && this.$store.getters.userInfo.id
    },
    showHeader() {
      return this.$route.meta.showHeader !== false
    },
    showSidebar() {
      return this.$route.meta.showSidebar !== false
    },
    showTagsView() {
      return this.$store.getters.tagsView && this.$route.meta.showTagsView !== false
    },
    sidebarWidth() {
      return this.$store.state.app.sidebar.opened ? '210px' : '64px'
    },
    appClassName() {
      return {
        'app-mobile': this.$store.state.app.device === 'mobile',
        'app-desktop': this.$store.state.app.device === 'desktop'
      }
    },
    cachedViews() {
      return this.$store.state.tagsView.cachedViews
    },
    excludeCachedViews() {
      return this.$store.state.tagsView.excludeCachedViews
    }
  },
  watch: {
    '$route.path': {
      handler(path) {
        // 记录 PV
        this.$log.pv(path)
      },
      immediate: true
    },
    '$i18n.locale'(val) {
      document.title = this.$t('app.title')
    }
  },
  created() {
    this.$nextTick(() => {
      // 注册全局错误处理
      this.$once('hook:beforeDestroy', () => {
        console.log('App destroying')
      })
    })
  },
  mounted() {
    // 动态注入百度统计
    this.injectAnalytics()
    // 全局快捷键
    this.bindShortcuts()
  },
  beforeDestroy() {
    if (this.timer) clearTimeout(this.timer)
    window.removeEventListener('keydown', this.onKeyDown)
  },
  errorCaptured(err, vm, info) {
    console.error('[errorCaptured]', err, info)
    this.$notify.error({
      title: '组件渲染错误',
      message: err.message
    })
    // 不向上传播
    return false
  },
  methods: {
    injectAnalytics() {
      if (!process.env.VUE_APP_GA_ID || this.$route.meta.disableAnalytics) return
      const script = document.createElement('script')
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${process.env.VUE_APP_GA_ID}`
      document.head.appendChild(script)
    },
    bindShortcuts() {
      window.addEventListener('keydown', this.onKeyDown)
    },
    onKeyDown(e) {
      // Ctrl+K 打开搜索
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        this.$bus.$emit('open-search')
      }
      // Ctrl+R 重载
      if (e.ctrlKey && e.key === 'r' && e.shiftKey) {
        e.preventDefault()
        this.reload()
      }
    },
    reload() {
      this.isRouterAlive = false
      this.$nextTick(() => {
        this.isRouterAlive = true
        this.$message.success('重载完成')
      })
    }
  }
}
</script>

<style lang="scss">
@import '@/styles/variables.scss';
@import '@/styles/mixins.scss';
@import '@/styles/transitions.scss';

html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: $font-family-base;
  font-size: $font-size-base;
  color: $text-primary;
}

#app {
  position: relative;
}

.app-container {
  height: 100%;
}

.app-header {
  background: $header-bg;
  border-bottom: 1px solid $border-color;
}

.app-aside {
  background: $sidebar-bg;
  transition: width 0.28s;
}

.app-main {
  background: $body-bg;
  padding: 16px;
  overflow-y: auto;
}

// 路由切换动画
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s;
}
.fade-transform-enter {
  opacity: 0;
  transform: translateX(-30px);
}
.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

// 移动端
@media (max-width: 768px) {
  .app-aside { display: none; }
}

// 打印样式
@media print {
  .app-header, .app-aside { display: none; }
}
</style>
