// vite.config.js 完整配置 (Vite 2.x 时代)
// 同时覆盖 Vue 2 + Vue 3 双场景

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue2' // Vue 2 用
// import vue from '@vitejs/plugin-vue' // Vue 3 用
import path from 'path'
import Components from 'unplugin-vue-components/vite'
import { AntDesignVueResolver, ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import AutoImport from 'unplugin-auto-import/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import viteImagemin from 'vite-plugin-imagemin'
import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'
import legacy from '@vitejs/plugin-legacy'
import basicSsl from '@vitejs/plugin-basic-ssl'

function resolve(dir) {
  return path.resolve(__dirname, dir)
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'

  return {
    base: env.VITE_BASE_URL || '/',
    publicDir: 'public',
    root: '.',
    mode,

    // 服务器配置
    server: {
      host: '0.0.0.0',
      port: 5173,
      open: true,
      cors: true,
      strictPort: false,
      // 代理
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, '')
        },
        '/upload': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      },
      // HMR
      hmr: {
        overlay: true
      },
      // fs allow
      fs: {
        strict: true,
        allow: [resolve('..'), resolve('.')]
      }
    },

    // 构建配置
    build: {
      target: 'es2015',
      cssTarget: 'chrome61',
      outDir: 'dist',
      assetsDir: 'assets',
      assetsInlineLimit: 4096,
      sourcemap: !isProd,
      minify: isProd ? 'esbuild' : false,
      cssCodeSplit: true,
      sourcemapClassName: 'source-map',
      terserOptions: {
        compress: {
          drop_console: isProd,
          drop_debugger: true
        }
      },
      // chunk 分割
      rollupOptions: {
        input: {
          main: resolve('index.html')
        },
        output: {
          // 拆 chunk
          manualChunks: {
            'element-ui': ['element-ui'],
            'ant-design-vue': ['ant-design-vue'],
            'echarts': ['echarts', 'vue-echarts'],
            'vxe-table': ['vxe-table', 'xe-utils'],
            'wangeditor': ['wangeditor'],
            'tinymce': ['tinymce'],
            'vue-core': ['vue', 'vue-router', 'vuex']
          },
          // 文件命名
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          // external
          format: 'es'
        },
        // 外部化 CDN
        external: env.VITE_USE_CDN === 'true' ? ['vue', 'vue-router', 'vuex', 'element-ui', 'echarts', 'lodash', 'axios'] : []
      },
      // 性能预算
      chunkSizeWarningLimit: 1500,
      // 复制 public
      copyPublicDir: true
    },

    // 缓存
    cacheDir: 'node_modules/.vite',

    // CSS 配置
    css: {
      devSourcemap: true,
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: '[name]__[local]__[hash:base64:5]'
      },
      preprocessorOptions: {
        scss: {
          additionalData: `@import "@/styles/variables.scss";`,
          api: 'sass'
        },
        less: {
          modifyVars: {
            'primary-color': '#1890ff',
            'info-color': '#1890ff'
          },
          javascriptEnabled: true
        },
        stylus: {
          imports: ['@/styles/mixins.styl']
        }
      },
      postcss: {
        plugins: [
          require('autoprefixer'),
          require('postcss-px-to-viewport')({
            unitToConvert: 'px',
            viewportWidth: 1920,
            unitPrecision: 5,
            propList: ['*'],
            mediaQuery: false
          })
        ]
      }
    },

    // 解析别名
    resolve: {
      alias: {
        '@': resolve('src'),
        '~': resolve('src'),
        'assets': resolve('src/assets'),
        'components': resolve('src/components'),
        'views': resolve('src/views'),
        'utils': resolve('src/utils'),
        'api': resolve('src/api'),
        'store': resolve('src/store'),
        'router': resolve('src/router')
      },
      extensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.vue', '.mjs', '.cjs'],
      dedupe: ['vue', 'vue-router', 'vuex']
    },

    // 优化依赖
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'vuex',
        'axios',
        'lodash',
        'moment',
        'dayjs',
        'echarts',
        'element-ui',
        'ant-design-vue',
        'sortablejs',
        'wangeditor'
      ],
      exclude: ['tinymce', 'vue-cropper'],
      esbuildOptions: {
        target: 'es2015'
      }
    },

    // 插件
    plugins: [
      vue({
        // template 选项
        template: {
          compilerOptions: {
            // 处理 v-model 默认行为
            whitespace: 'preserve'
          }
        }
      }),
      // 自动按需引入组件
      Components({
        resolvers: [
          ElementPlusResolver({ importStyle: 'sass' }),
          AntDesignVueResolver({ importStyle: 'css' })
        ],
        dts: 'types/components.d.ts',
        dirs: ['src/components']
      }),
      // 自动 import
      AutoImport({
        imports: ['vue', 'vue-router', 'vuex'],
        dts: 'types/auto-imports.d.ts',
        resolvers: [
          ElementPlusResolver(),
          AntDesignVueResolver()
        ]
      }),
      // SVG sprite
      createSvgIconsPlugin({
        iconDirs: [path.resolve(process.cwd(), 'src/icons/svg')],
        symbolId: 'icon-[dir]-[name]'
      }),
      // 压缩
      viteCompression({
        verbose: false,
        disable: false,
        threshold: 10240,
        algorithm: 'gzip',
        ext: '.gz'
      }),
      // 图片压缩
      viteImagemin({
        gifsicle: { optimizationLevel: 7 },
        mozjpeg: { quality: 75 },
        pngquant: { quality: [0.65, 0.8] },
        svgo: { plugins: [{ removeViewBox: false }] }
      }),
      // 体积分析
      isProd && visualizer({
        open: false,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/stats.html'
      }),
      // 旧浏览器支持
      legacy({
        targets: ['ie >= 11', 'chrome >= 50'],
        additionalLegacyPolyfills: ['regenerator-runtime/runtime']
      }),
      // HTTPS
      mode === 'https' && basicSsl()
    ].filter(Boolean),

    // 全局变量
    define: {
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      'process.env': {}
    },

    // esbuild 配置
    esbuild: {
      target: 'es2015',
      legalComments: 'none',
      treeShaking: true
    },

    // 日志
    logLevel: 'info',
    clearScreen: false
  }
})
