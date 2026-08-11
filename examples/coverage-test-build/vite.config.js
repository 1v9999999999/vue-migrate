// Vite 配置文件 - 极简 build verification
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'src')
    }
  },
  css: {
    preprocessorOptions: {
      // additionalData 用 @use 重复触发, 改成空, 让 .vue 自己 @import
      scss: {
        api: 'modern-compiler'
      },
      less: {
        // @primary-color 注入 (用 @modifyvars 一样效果)
      },
      stylus: {
        // stylus 默认全局变量
      }
    }
  },
  build: {
    target: 'es2020',
    minify: false,
    sourcemap: true,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html')
      }
    }
  }
})
