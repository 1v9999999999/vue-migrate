/**
 * iter-121: a-modal @click 拆分 review
 *
 * 1.x: <a-modal @click="handleClick" />  (用 click 事件承担 OK/Cancel 双重职责)
 * 2.x: <a-modal @ok="onOk" @cancel="onCancel" />  (拆成两个事件)
 *
 * 检测: a-modal 元素有 @click (或 v-on:click) 但没有 @ok/@cancel
 */

import { hasClickWithoutOkCancel, type ElementLite } from '../utils/template-scanner.js'

export function reviewModalEvents(elements: ElementLite[]): string[] {
  const reviews: string[] = []
  for (const el of elements) {
    if (el.tagName.toLowerCase() !== 'a-modal') continue
    const { hasClick, hasOkOrCancel } = hasClickWithoutOkCancel(el)
    if (hasClick && !hasOkOrCancel) {
      reviews.push(
        `<a-modal @click="..."> — ant-design-vue 2.x 把 click 拆成 @ok 和 @cancel, 1.x 的 @click 含义模糊(可能是确认也可能是关闭), 需手动拆成 @ok + @cancel`,
      )
    }
  }
  return reviews
}
