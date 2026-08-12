<template>
  <div class="p-4 max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-center text-blue-600 mb-4">
      Tailwind CSS + Vue 2.7.16
    </h1>

    <!--
      真实集成场景:
      本项目已安装 tailwindcss@2.2.19, 通过 postcss 配置生成 utility class.
      注意: 模板中的 class="..." 会被 tailwind 扫描, 生成对应 CSS.

      Vue 集成配置:
        1. postcss.config.js: { plugins: { tailwindcss: {}, autoprefixer: {} } }
        2. tailwind.config.js: { content: ['./src/**/*.{vue,js,ts}'] }
        3. main.js: import 'tailwindcss/tailwind.css'

      优势:
        - 零运行时, 编译时生成
        - 设计 token 统一 (theme.extend)
        - 暗色模式: dark: 前缀
        - 响应式: sm: md: lg: 前缀
    -->

    <h2 class="text-xl font-semibold text-gray-800 mb-2">Grid Layout</h2>
    <div class="grid grid-cols-3 gap-4 mt-4">
      <div
        v-for="item in items"
        :key="item.id"
        class="p-4 bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer"
        @click="onItemClick(item)"
      >
        <h3 class="font-semibold text-gray-900">{{ item.title }}</h3>
        <p class="text-sm text-gray-600 mt-1">{{ item.description }}</p>
        <span
          class="inline-block mt-2 px-2 py-1 text-xs rounded"
          :class="item.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'"
        >
          {{ item.priority }}
        </span>
      </div>
    </div>

    <h2 class="text-xl font-semibold text-gray-800 mt-6 mb-2">Form</h2>
    <div class="space-y-3">
      <input
        v-model="formInput"
        type="text"
        class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Type something..."
      />
      <button
        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 active:bg-blue-700 transition"
        @click="addItem"
      >
        Add Item
      </button>
    </div>

    <h2 class="text-xl font-semibold text-gray-800 mt-6 mb-2">Status</h2>
    <div
      class="p-3 rounded"
      :class="lastAdded ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'"
    >
      <p class="text-sm" :class="lastAdded ? 'text-green-700' : 'text-gray-500'">
        {{ lastAdded ? `Last added: ${lastAdded}` : 'No items added yet' }}
      </p>
    </div>

    <hr class="my-6 border-gray-200" />

    <p class="text-xs text-gray-500 font-mono leading-relaxed">
      ✅ Tailwind 完整支持:
      <br />1. utility class: p-4, grid, flex, text-xl
      <br />2. 状态: hover:, focus:, active:, disabled:
      <br />3. 响应式: sm: md: lg: xl:
      <br />4. 暗色: dark:bg-gray-800
      <br />5. 自定义: tailwind.config.js theme.extend
    </p>
  </div>
</template>

<script>
/**
 * Tailwind CSS 集成
 *
 * 依赖: tailwindcss@2.2.19 (项目已装)
 * 配置:
 *   - postcss.config.js
 *   - tailwind.config.js
 *
 * 注意:
 *   1. 必须配置 content 路径包含 .vue 文件
 *   2. JIT 模式默认开启 (Tailwind 3+), 2.x 需要 mode: 'jit'
 *   3. @apply 指令可在 <style> 中使用, 提取重复样式
 */

let _id = 100
const nextId = () => ++_id

export default {
  name: 'TailwindDirectives',
  data() {
    return {
      formInput: '',
      lastAdded: '',
      items: [
        { id: 1, title: 'Vue 2', description: 'Options API', priority: 'high' },
        { id: 2, title: 'Vue 3', description: 'Composition API', priority: 'high' },
        { id: 3, title: 'Tailwind', description: 'Utility-first CSS', priority: 'medium' }
      ]
    }
  },
  methods: {
    addItem() {
      if (!this.formInput.trim()) return
      this.items.unshift({
        id: nextId(),
        title: this.formInput,
        description: 'newly added',
        priority: 'low'
      })
      this.lastAdded = this.formInput
      this.formInput = ''
    },
    onItemClick(item) {
      console.log('clicked:', item)
    }
  }
}
</script>

<style scoped>
/*
  scoped 会给 class 加 [data-v-xxx] 属性选择器,
  Tailwind 的 utility class 不受影响 (因为它在外部生成).
  复杂组合样式仍可写在 <style> 中, 配合 @apply:

  .my-card {
    @apply p-4 bg-white rounded shadow;
  }
*/
</style>
