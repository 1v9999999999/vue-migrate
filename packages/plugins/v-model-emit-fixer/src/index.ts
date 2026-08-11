/**
 * @vue-migrate/plugin-v-model-emit-fixer
 *
 * iter-049a P1 #15: 修 v-model 双向不通问题
 *
 * 问题:
 *   Vue 2 v-model 默认: prop `value` + emit `input`
 *   Vue 3 v-model 默认: prop `modelValue` + emit `update:modelValue`
 *
 *   iter-048 B 阶段转换的子组件保留了 Vue 2 风格:
 *     - `const emit = defineEmits(['input'])`
 *     - `emit('input', value)`
 *   但父级 v-model 仍期望 update:modelValue → v-model 双向不通
 *
 * 受影响文件 (iter-049 扫到的):
 *   - views/excel/components/{FilenameOption,AutoWidthOption,BookTypeOption}.vue
 *   - components/Upload/{SingleImage,SingleImage2,SingleImage3}.vue
 *   - components/MDinput/index.vue
 *   - components/MarkdownEditor/index.vue
 *   - components/Tinymce/index.vue
 *   - components/JsonEditor/index.vue
 *   - components/ImageCropper/index.vue
 *   - views/example/components/Dropdown/{SourceUrl,Platform,Comment}.vue
 *
 * 修法 (保守):
 *   1) `defineEmits(['input'])`         → `defineEmits(['update:modelValue'])`
 *   2) `emit('input', x)`                → `emit('update:modelValue', x)`
 *   3) 不动 prop 名 (保守策略, 加 manualReview 提示用户改 `value` → `modelValue` 也跟着改)
 *
 * 为什么不动 prop 名:
 *   - 父级可能用 `:value="..."` 显式传 (Vue 2 习惯)
 *   - 改 prop 名是 breaking change
 *   - 让用户决定更稳
 *
 * Priority: -20 (在 composition 之后跑; 看到的是 setup 后的 source, 此时 emit('input') 模式才出现)
 */

import {
  registerPlugin,
  type TransformPlugin,
  type TransformContext,
} from '@vue-migrate/core'

/**
 * 在 source 字符串中:
 *  - 替换 `defineEmits([... 'input' ...])`  →  `defineEmits([... 'update:modelValue' ...])`
 *  - 替换 `emit('input', ...)`  →  `emit('update:modelValue', ...)`
 *
 * 返回 { changed, newSource, fixedCount }
 */
export function fixVModelEmits(source: string): {
  changed: boolean
  newSource: string
  fixedCount: number
} {
  let newSource = source
  let fixedCount = 0

  // 1) defineEmits(['input']) 整体替换 — 多种引号风格 + 在数组里多个 emit 都支持
  //    匹配: defineEmits([ ..., 'input', ... ])
  //    简单方案: 把整个 defineEmits 列表里出现的 'input' / "input" 替换为 'update:modelValue' / "update:modelValue"
  //    但要避免误替换 — 只有在 defineEmits 调用的参数列表里才改

  // 匹配 defineEmits(...) 的整段, 然后在它内部处理 'input'
  const defineEmitsRe = /defineEmits\s*\(\s*(\[[\s\S]*?\])\s*\)/g
  newSource = newSource.replace(defineEmitsRe, (match, arrayContent) => {
    // 在数组内容里, 把 'input' / "input" 单独项改成 'update:modelValue'
    // 注意: 不要替换 "'update-input'" 或 "'onInput'" 之类
    const newArray = arrayContent.replace(
      /(['"])input\1/g,
      '$1update:modelValue$1',
    )
    if (newArray !== arrayContent) {
      fixedCount++
    }
    return `defineEmits(${newArray})`
  })

  // 2) emit('input', ...) 替换
  //    匹配: emit('input' 或 emit("input"
  //    注意: emit('onInput') 不匹配
  const emitRe = /\bemit\s*\(\s*(['"])input\1\s*,/g
  const newSourceAfterEmit = newSource.replace(emitRe, (match) => {
    fixedCount++
    return match.replace(/(['"])input\1/, '$1update:modelValue$1')
  })
  newSource = newSourceAfterEmit

  return {
    changed: newSource !== source,
    newSource,
    fixedCount,
  }
}

/** 判断 file 是否需要 fix (含 defineEmits('input') 或 emit('input', ...)) */
export function needsFix(source: string): boolean {
  if (/\bdefineEmits\s*\(\s*\[[\s\S]*?(['"])input\1/.test(source)) return true
  if (/\bemit\s*\(\s*(['"])input\1\s*,/.test(source)) return true
  return false
}

const plugin: TransformPlugin = {
  name: 'v-model-emit-fixer',
  description:
    'Replace Vue 2 style emit(\'input\', ...) with Vue 3 emit(\'update:modelValue\', ...) in <script setup>. Solves v-model two-way binding failures (P1 #15).',
  priority: -20,
  fileKinds: ['vue'],

  transform(ctx: TransformContext) {
    const { file, utils } = ctx
    const source = file.source
    if (!source) return
    if (!needsFix(source)) return

    const r = fixVModelEmits(source)
    if (!r.changed) return

    file.source = r.newSource
    file.useRawSource = true
    utils.markChanged(`[v-model-emit-fixer] 修复 ${r.fixedCount} 处 emit('input')`)
    utils.manualReview(
      `[v-model-emit-fixer] 已在 ${file.relativePath} 把 defineEmits + emit('input', ...) 改成 update:modelValue。` +
      `⚠ 如果父级用 v-model="x" 且子组件 props 仍叫 value, 请同时把 defineProps 的 value 改名 modelValue 以匹配 Vue 3 v-model 默认协议。` +
      `(我们没自动改 prop 名, 因为这可能影响其他 :value= 引用。)`,
    )
  },
}

registerPlugin(plugin)
export default plugin

// 暴露给单测
export const _testable = {
  fixVModelEmits,
  needsFix,
}
