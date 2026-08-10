// 一个纯 TS 文件的测试样例
// 注意: core 的 selfCheck 用纯 babel parser (无 typescript plugin),
// 所以这个文件不能用 TS-only 语法 (import type / type aliases), 否则
// codegen 会跳过。
// 因此我们用 jsdoc 写类型, 让它通过 selfCheck, 同时展示插件的混合策略。

/**
 * @param {string} name
 * @param {number} times
 * @returns {string}
 */
export function greet(name, times = 1) {
  return `Hello, ${name}!`.repeat(times)
}

// case 2: 数组字面量
/** @type {number[]} */
export const numbers = [1, 2, 3, 4, 5]
/** @type {Array<string|number|boolean|null>} */
export const mixed = [1, 'two', true, null]

// case 3: 嵌套对象
export const config = {
  api: { baseURL: 'https://api.example.com', timeout: 5000 },
  flags: { darkMode: true, beta: false },
  version: '1.0.0',
}

// case 4: 一个内联的 Vue 组件 (用 export default)
export default {
  name: 'MixedTypes',
  data() {
    return {
      visible: true,
      label: 'click me',
      tags: [],
    }
  },
  props: {
    title: String,
    count: { type: Number, default: 0 },
  },
  methods: {
    toggle() {
      this.visible = !this.visible
    },
  },
  mounted() {
    // ↓ 应被识别为 TODO
    const child = this.$children[0]
    this.$listeners.click?.(child)
  },
}
