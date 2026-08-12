/**
 * iter-121: v-decorator 指令 review
 *
 * 1.x 用 v-decorator="['field', { rules: [...] }]" 自动双向绑定
 * 2.x 改成: Form.useForm() 拿到 formModel, 在 <a-form-item name="field" :rules="[...]"> 上声明
 *
 * 设计：只 review, 不自动改 (form 改造涉及 data 结构调整, 业务决策多)
 */

import { hasDecorator, type ElementLite } from '../utils/template-scanner.js'

export function reviewVDecorator(elements: ElementLite[]): string[] {
  const reviews: string[] = []
  for (const el of elements) {
    if (hasDecorator(el)) {
      reviews.push(
        `<${el.tagName} v-decorator="..."> — ant-design-vue 2.x 移除 v-decorator, 改用 Form.useForm() + <a-form-item name="..." :rules="..."> + v-model 绑定 formModel.x`,
      )
    }
  }
  return reviews
}
