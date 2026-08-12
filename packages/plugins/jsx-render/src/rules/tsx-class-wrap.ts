/**
 * 规则: TSX/JSX class component 处理 (iter-120, updated iter-123)
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
 * iter-123 update:
 *   - ts-decorator 现在支持 .tsx (添加 'jsx' 到 babel parser plugins)
 *   - 因此 .tsx class component 会被 ts-decorator 自动转换为 <script setup> 形式
 *   - 本规则只对"ts-decorator 未能处理"的情况 (例如 syntax 太复杂 babel 解析失败) 标 review
 *   - 若 file.useRawSource === true, 说明 ts-decorator 已改过 source, 不再标 review
 *
 * iter-120 original strategy:
 *   1. 检测 .tsx / .jsx 文件中是否有 @Component + class extends Vue
 *   2. 如果有, 标 review 提示用户:
 *      - Vue 3 + JSX 需要 @vitejs/plugin-vue-jsx
 *      - @Component 装饰器建议手动拆解为 <script setup>
 *   3. 不修改源代码
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

  // iter-123: 若 ts-decorator 已改过 (useRawSource === true), 不再标 review
  //   ts-decorator 现在支持 JSX 解析, 成功转换的 .tsx 文件不该再被本规则 flag
  if ((file as any).useRawSource) {
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

  // iter-123: 检查是否 @vitejs/plugin-vue-jsx / 已配置 .tsx 处理
  //   若 setup 已配, 不需要 review
  // TSX class with JSX: 标 review (仅当 ts-decorator 失败时, 即 source 仍含 @Component + class extends Vue + JSX)
  reviewItems.push(
    `iter-120: TSX class component with JSX syntax detected. ts-decorator 应该已自动转换, 但 source 仍含 class — ` +
      `可能 babel 解析失败. 建议: (1) 用 @vitejs/plugin-vue-jsx + 重命名为 .vue (含 <script setup lang="tsx">); ` +
      `(2) 手动把 @Component class 拆为 <script setup>, JSX 改为 h() 调用; ` +
      `(3) 保留 .tsx 文件, 在 vite.config.ts 配置 @vitejs/plugin-vue-jsx, 确保 Vue 3 + JSX 运行时兼容.`,
  )
  modifications++
  changes.push('TSX class component with JSX: review added (iter-123 fallback for unconverted files)')

  return { modifications, changes, reviewItems }
}
