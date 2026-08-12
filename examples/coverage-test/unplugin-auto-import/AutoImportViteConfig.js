import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import { FileSystemIconLoader } from 'unplugin-icons/loaders'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
      eslintrc: { enabled: true },
      resolvers: [
        IconsResolver({ prefix: 'Icon' })
      ]
    }),
    Components({
      dirs: ['src/components'],
      dts: 'src/components.d.ts',
      resolvers: [
        ElementPlusResolver(),
        IconsResolver({ enabledCollections: ['ep', 'mdi', 'carbon'] }),
        FileSystemIconLoader('src/assets/icons')
      ]
    }),
    Icons({ autoInstall: true, compiler: 'vue3' })
  ]
})
