<template functional>
  <div class="functional-template" v-bind="data.attrs">
    <h3>{{ props.title }}</h3>
    <p>{{ props.subtitle }}</p>
    <div class="children"><slot /></div>
  </div>
</template>

<script>
// 1) functional + render(h, ctx) + ctx.props + ctx.children + ctx.slots()
export const FunctionalRender = {
  name: 'FunctionalRender',
  functional: true,
  props: {
    title: String,
    subtitle: String
  },
  render(h, ctx) {
    // ctx.props 读取属性
    const title = ctx.props.title
    const subtitle = ctx.props.subtitle

    // ctx.children 读取子节点
    const children = ctx.children

    // ctx.slots() 读取插槽
    const slots = ctx.slots()

    // ctx.data 透传 attrs / on 等
    return h(
      'div',
      {
        class: 'functional-render',
        attrs: ctx.data.attrs,
        on: ctx.data.on
      },
      [
        h('h3', title),
        h('p', subtitle),
        h('div', { class: 'children' }, children),
        slots.header ? h('div', { class: 'header-slot' }, slots.header) : null
      ]
    )
  }
}

// 2) 主导出: functional + ctx.data 透传 attrs 的纯 render 形式
export default {
  name: 'FunctionalComponent',
  functional: true,
  props: {
    title: {
      type: String,
      default: 'Functional Component'
    }
  },
  render(h, ctx) {
    // ctx.data 透传 attrs —— 把外部传入的属性原样透传给根元素
    return h('div', ctx.data, [
      h('h3', ctx.props.title),
      // ctx.children 透传子节点
      h('div', ctx.children)
    ])
  }
}
</script>

<style scoped>
.functional-template {
  padding: 16px;
  border: 1px solid #eee;
}
</style>
