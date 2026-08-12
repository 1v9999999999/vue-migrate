/**
 * 规则: TSX/JSX class component 处理 (iter-120)
 *
 * Vue 2 TSX class component (vue-property-decorator + JSX):
 *
 *   // MyTsx.tsx
 *   import { Component, Vue } from 'vue-property-decorator'
 *
 *   @Component
 *   export default class MyTsx extends Vue {
 *     render() {
 *       return <div>...</div>
 *     }
 *   }
 *
 * Vue 3 兼容写法 (推荐: 保留 JSX, 标记 review):
 *   - 直接使用 @vitejs/plugin-vue-jsx 配合 <script setup lang="tsx">
 *   - Vue 3 仍然支持 JSX 语法 (h() 调用形式)
 *   - 转换路径: 把整个 .tsx 包装成 .vue (含 <script setup lang="tsx">)
 *     或者保持 .tsx + 加 review 提示用户用 @vitejs/plugin-vue-jsx
 *
 * iter-120 策略:
 *   1. 检测 .tsx / .jsx 文件中是否有 @Component + class extends Vue
 *   2. 如果有, 标 review 提示用户:
 *      - Vue 3 + JSX 需要 @vitejs/plugin-vue-jsx
 *      - @Component 装饰器建议手动拆解为 <script setup>
 *   3. 不修改源代码 (ts-decorator 会做转换, 但仅在它的 babel parser 能解析时)
 *
 * 替代方案 (激进): 把整个 .tsx 包成 .vue
 *   <script setup lang="tsx">
 *   ...原始内容...
 *   </script>
 *
 *   但这样用户得手动重命名为 .vue, 也不解决 JSX 解析. 所以 iter-120
 *   选择保守路径: 标 review + 让 ts-decorator 处理
 *
 *   实际上 ts-decorator 不解析 JSX, 所以会 bail. 那我们要 fallback:
 *     - 加更显眼的 review
 *     - 不修改 source (避免破坏)
 */

import type { FileNode } from '@vue-migrate/core'

export interface TsxClassWrapResult {
  modifications: number
  changes: string[]
  reviewItems: string[]
}

export function reviewTsxClassComponent(file: FileNode): TsxClassWrapResult {
  const reviewItems: string[] = []
  const changes: string[] = []
  let modifications = 0

  if (file.kind !== 'tsx' && file.kind !== 'jsx') {
    return { modifications, changes, reviewItems }
  }

  const source = file.source
  // 检测: @Component decorator + class extends Vue/mixins
  const isClassComponent =
    /@Component\b/.test(source) &&
    /\bclass\s+\w+\s+extends\s+(?:Vue|mixins)/.test(source)

  if (!isClassComponent) {
    return { modifications, changes, reviewItems }
  }

  // 检测 JSX (render() 方法里有 <tag 或 <>)
  const hasJsx = /render\s*\([^)]*\)\s*\{[^}]*<(?:[A-Za-z]|\/)/.test(source) ||
    /return\s*\(\s*\n?\s*</.test(source)

  if (!hasJsx) {
    // 纯 TS class, ts-decorator 会处理, 我们不插手
    return { modifications, changes, reviewItems }
  }

  // TSX class with JSX: 标 review
  reviewItems.push(
    `iter-120: TSX class component with JSX syntax. ts-decorator 不解析 JSX 语法, 自动转换未执行. ` +
      `建议 (任选一): (1) 用 @vitejs/plugin-vue-jsx + 重命名为 .vue (含 <script setup lang="tsx">); ` +
      `(2) 手动把 @Component class 拆为 <script setup>, JSX 改为 h() 调用; ` +
      `(3) 保留 .tsx 文件, 在 vite.config.ts 配置 @vitejs/plugin-vue-jsx, 确保 Vue 3 + JSX 运行时兼容.`,
  )
  modifications++
  changes.push('TSX class component with JSX: review added (auto-conversion skipped due to JSX parse complexity)')

  return { modifications, changes, reviewItems }
}
