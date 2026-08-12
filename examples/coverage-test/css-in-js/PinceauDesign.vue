<template>
  <div class="flex flex-col p-4 gap-2">
    <h1 class="text-2xl font-bold text-primary-500">Pinceau / UnoCSS Design Token</h1>
    <p class="text-base text-primary-900">
      原子化 CSS + design token 集成, 类似 tailwindcss 但支持 config.ts 类型化 token
    </p>

    <!--
      真实集成场景:
      Pinceau 是 Vue 生态的 design token + utility-first 方案,
      UnoCSS 是更通用的 atomic CSS 引擎, Tailwind 的现代替代.

      区别:
        - Tailwind: 配置在 tailwind.config.js, 设计 token 通过 theme.extend
        - UnoCSS: 配置在 uno.config.ts, 支持 preset-wind3 / preset-uno
        - Pinceau: 配置在 app.config.ts, 强类型 design token

      共同点:
        - utility class 直接写 class 即可: p-4, text-blue-500, grid grid-cols-3
        - 无需写 CSS 块
        - JIT 编译, 只生成用到的 class
        - 与 scoped / CSS module 兼容 (通过 :class 数组)
    -->

    <h2 class="text-xl font-semibold text-primary-900">组件示例</h2>

    <button class="bg-primary-500 hover:bg-primary-900 text-white px-4 py-2 rounded transition">
      Primary Action
    </button>
    <button class="bg-white border border-primary-500 text-primary-500 hover:bg-primary-50 px-4 py-2 rounded">
      Secondary
    </button>

    <input
      class="border border-primary-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
      placeholder="input"
    />

    <hr class="border-t border-primary-50 my-2" />

    <h3 class="text-lg font-medium text-primary-900">Card</h3>
    <div class="grid grid-cols-3 gap-4">
      <div class="p-4 bg-white rounded-lg shadow hover:shadow-lg transition">
        <h4 class="font-semibold text-primary-900">Card 1</h4>
        <p class="text-gray-600">Description</p>
      </div>
      <div class="p-4 bg-white rounded-lg shadow hover:shadow-lg transition">
        <h4 class="font-semibold text-primary-900">Card 2</h4>
        <p class="text-gray-600">Description</p>
      </div>
      <div class="p-4 bg-white rounded-lg shadow hover:shadow-lg transition">
        <h4 class="font-semibold text-primary-900">Card 3</h4>
        <p class="text-gray-600">Description</p>
      </div>
    </div>

    <hr class="border-t border-primary-50 my-2" />

    <p class="comment">
      ✅ 优势:
      <br />1. 零运行时, 编译时生成 CSS
      <br />2. design token 集中管理
      <br />3. 与 Vue 2/3 兼容 (无运行时依赖)
      <br />4. IDE 智能提示 (UnoCSS / Pinceau 都提供)
    </p>
  </div>
</template>

<script>
/**
 * Pinceau / UnoCSS Design Token 集成
 *
 * 依赖 (二选一):
 *   - npm i -D @unocss/preset-wind3 unocss
 *   - npm i -D @pinceau/vue @pinceau/sharp
 *
 * 配置 uno.config.ts:
 *   import { defineConfig, presetWind3 } from 'unocss'
 *   export default defineConfig({
 *     presets: [presetWind3()],
 *     theme: {
 *       colors: {
 *         primary: {
 *           50: '#f0f9f4',
 *           500: '#42b983',
 *           900: '#2c6e4f'
 *         }
 *       }
 *     }
 *   })
 *
 * Vite 配置:
 *   import UnoCSS from 'unocss/vite'
 *   export default { plugins: [UnoCSS()] }
 *
 * main.js:
 *   import 'virtual:uno.css'
 */

const config = {
  colors: {
    primary: {
      50: '#f0f9f4',
      500: '#42b983',
      900: '#2c6e4f'
    },
    gray: {
      600: '#909399'
    }
  },
  spacing: {
    1: '4px',
    2: '8px',
    4: '16px'
  }
}

export default {
  name: 'PinceauDesign',
  data() {
    return { config }
  }
}
</script>

<style scoped>
/* 实际 CSS 由 UnoCSS / Pinceau 在编译时生成, 此处仅 fallback */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.p-2 { padding: 8px; }
.p-4 { padding: 16px; }
.gap-2 { gap: 8px; }
.gap-4 { gap: 16px; }
.text-base { font-size: 14px; }
.text-lg { font-size: 18px; }
.text-xl { font-size: 20px; }
.text-2xl { font-size: 24px; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.text-white { color: #fff; }
.bg-white { background: #fff; }
.bg-primary-50 { background: #f0f9f4; }
.bg-primary-500 { background: #42b983; }
.text-primary-500 { color: #42b983; }
.text-primary-900 { color: #2c6e4f; }
.text-gray-600 { color: #909399; }
.border { border: 1px solid currentColor; }
.border-primary-50 { border-color: #f0f9f4; }
.border-primary-500 { border-color: #42b983; }
.rounded { border-radius: 4px; }
.rounded-lg { border-radius: 8px; }
.shadow { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05); }
.shadow-lg { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
.transition { transition: all 0.2s; }
.grid { display: grid; }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
.px-2 { padding-left: 8px; padding-right: 8px; }
.px-4 { padding-left: 16px; padding-right: 16px; }
.py-1 { padding-top: 4px; padding-bottom: 4px; }
.py-2 { padding-top: 8px; padding-bottom: 8px; }
.my-2 { margin-top: 8px; margin-bottom: 8px; }
.focus\:outline-none:focus { outline: none; }
.focus\:ring-2:focus { box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.5); }
.focus\:ring-primary-500:focus { box-shadow: 0 0 0 2px rgba(66, 185, 131, 0.5); }
.hover\:bg-primary-900:hover { background: #2c6e4f; }
.hover\:bg-primary-50:hover { background: #f0f9f4; }
.hover\:shadow-lg:hover { box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
.border-t { border-top: 1px solid; }
.comment {
  font-family: monospace;
  font-size: 12px;
  background: #f5f7fa;
  padding: 8px 12px;
  border-radius: 4px;
  line-height: 1.6;
  color: #606266;
  margin-top: 8px;
}
hr {
  border: none;
}
</style>
