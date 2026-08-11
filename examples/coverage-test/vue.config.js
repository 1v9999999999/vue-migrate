// vue.config.js 完整配置 (vue-cli 4.5)
// 用于 Vue 2.x 项目

const path = require('path')
const webpack = require('webpack')
const CompressionWebpackPlugin = require('compression-webpack-plugin')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
const TerserPlugin = require('terser-webpack-plugin')

function resolve(dir) {
  return path.join(__dirname, dir)
}

const isProd = process.env.NODE_ENV === 'production'

module.exports = {
  // 部署应用包时的基本 URL
  publicPath: process.env.VUE_APP_BASE_URL || '/',
  // 构建时输出文件目录
  outputDir: process.env.VUE_APP_OUTPUT_DIR || 'dist',
  // 静态资源目录
  assetsDir: 'static',
  // 生产环境是否生成 sourceMap
  productionSourceMap: !isProd,
  // 默认所有 gzip
  productionGzip: false,
  productionGzipExtensions: ['js', 'css'],
  // CSS 相关选项
  css: {
    loaderOptions: {
      sass: {
        // 全局 SCSS 变量
        additionalData: `@import "@/styles/variables.scss";`
      },
      less: {
        // 全局 LESS 变量
        lessOptions: {
          modifyVars: {
            'primary-color': '#1890ff'
          }
        }
      },
      postcss: {
        plugins: [
          require('autoprefixer')(),
          require('postcss-px-to-viewport')({
            unitToConvert: 'px',
            viewportWidth: 1920,
            unitPrecision: 5,
            propList: ['*'],
            selectorBlackList: ['.ignore-px'],
            minPixelValue: 1,
            mediaQuery: false,
            replace: true
          })
        ]
      }
    }
  },
  // 启用 hash
  filenameHashing: isProd,
  // 移除末尾的 .vue 后缀
  chainWebpack: config => {
    // 别名设置
    config.resolve.alias
      .set('@', resolve('src'))
      .set('~', resolve('src'))
      .set('assets', resolve('src/assets'))
      .set('components', resolve('src/components'))
      .set('views', resolve('src/views'))
      .set('utils', resolve('src/utils'))
      .set('api', resolve('src/api'))
      .set('store', resolve('src/store'))
      .set('router', resolve('src/router'))

    // 注入全局变量 (Vue.use, etc)
    config.plugin('provide').use(webpack.ProvidePlugin, [{
      '$': 'jquery',
      'jQuery': 'jquery',
      'window.jQuery': 'jquery',
      'moment': 'moment',
      '_': 'lodash'
    }])

    // 优化: 单独打包 element-ui / echarts
    config.optimization.splitChunks({
      chunks: 'all',
      cacheGroups: {
        elementUI: {
          name: 'chunk-elementUI',
          test: /[\\/]node_modules[\\/]element-ui[\\/]/,
          priority: 30,
          chunks: 'all'
        },
        antDesignVue: {
          name: 'chunk-antDesign',
          test: /[\\/]node_modules[\\/]ant-design-vue[\\/]/,
          priority: 30,
          chunks: 'all'
        },
        echarts: {
          name: 'chunk-echarts',
          test: /[\\/]node_modules[\\/](echarts|v-echarts)[\\/]/,
          priority: 20,
          chunks: 'all'
        },
        vendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: 10,
          chunks: 'initial'
        },
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: 5,
          chunks: 'initial',
          reuseExistingChunk: true
        }
      }
    })

    // 修复 DuplicatePlugin 报错
    config.plugin('copy').tap(args => {
      args[0].ignore.push('*.map')
      return args
    })

    // 关闭 prefetch (太影响首屏)
    config.plugins.delete('prefetch-index')
  },
  // 关闭 webpack4 默认 polyfill, 自己处理
  configureWebpack: (config) => {
    if (isProd) {
      // 生产环境配置
      config.plugins.push(
        new CompressionWebpackPlugin({
          test: /\.(js|css|html|svg)$/,
          threshold: 10240,
          minRatio: 0.8
        })
      )
      // Bundle 分析
      if (process.env.ANALYZE) {
        config.plugins.push(new BundleAnalyzerPlugin())
      }
      // 优化
      config.optimization.minimizer = [
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true, // 移除 console
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info']
            }
          }
        })
      ]
    }
    // 外部扩展 (CDN)
    if (process.env.VUE_APP_USE_CDN === 'true') {
      config.externals = {
        'vue': 'Vue',
        'vue-router': 'VueRouter',
        'vuex': 'Vuex',
        'axios': 'axios',
        'element-ui': 'ELEMENT',
        'echarts': 'echarts',
        'moment': 'moment',
        'lodash': '_'
      }
    }
    // 性能提示
    config.performance = {
      hints: isProd ? 'warning' : false,
      maxAssetSize: 250000,
      maxEntrypointSize: 250000,
      assetFilter: assetFilename => !/(\.map$)|(hot-update\.js$)/.test(assetFilename)
    }
  },
  // dev server 配置
  devServer: {
    host: '0.0.0.0',
    port: process.env.VUE_APP_PORT || 8080,
    open: true,
    https: false,
    hotOnly: false,
    disableHostCheck: true,
    overlay: {
      warnings: false,
      errors: true
    },
    proxy: {
      '/api': {
        target: process.env.VUE_APP_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
        ws: true,
        logLevel: 'debug'
      },
      '/upload': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        pathRewrite: { '^/upload': '/api/upload' }
      }
    },
    // history API fallback for SPA
    historyApiFallback: {
      rewrites: [
        { from: /^\/api/, to: '/' }
      ]
    },
    // gzip
    compress: true,
    // client log level
    clientLogLevel: 'warning',
    // 进度
    progress: false,
    // quiet
    quiet: false
  },
  // 第三方插件配置
  pluginOptions: {
    'style-resources-loader': {
      preProcessor: 'scss',
      patterns: [
        resolve('src/styles/variables.scss'),
        resolve('src/styles/mixins.scss')
      ]
    }
  },
  // 平行模式 (multi-page app)
  pages: undefined,
  // lint on save
  lintOnSave: process.env.NODE_ENV === 'development',
  // runtime compiler (Vue 2.x)
  runtimeCompiler: true,
  // transpile dependencies
  transpileDependencies: ['element-ui', 'ant-design-vue', 'wangeditor', 'tinymce']
}
