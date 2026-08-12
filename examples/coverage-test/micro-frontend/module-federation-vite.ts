// host/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import federation from '@originjs/vite-plugin-federation'

export default defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'host',
      remotes: {
        remote_app: 'http://localhost:5001/assets/remoteEntry.js'
      },
      shared: ['vue', 'vue-router', 'pinia']
    })
  ]
})

// remote/vite.config.ts
export const remoteConfig = defineConfig({
  plugins: [
    vue(),
    federation({
      name: 'remote_app',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button.vue',
        './Header': './src/components/Header.vue'
      },
      shared: ['vue', 'vue-router', 'pinia']
    })
  ]
})
