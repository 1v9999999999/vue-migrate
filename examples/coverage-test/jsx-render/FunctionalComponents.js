/**
 * Functional component + JSX — Vue 2 写法
 * Vue 3: functional 选项移除, 用函数组件 (props) => h(...)
 */

// === 1. 简单 functional 组件 ===
export const SimpleFunctional = {
  functional: true,
  props: {
    type: { type: String, default: 'default' }
  },
  render(h, ctx) {
    return h(
      'span',
      {
        class: ['tag', `tag-${ctx.props.type}`]
      },
      ctx.children
    )
  }
}

// === 2. functional + JSX ===
export const JsxFunctional = {
  functional: true,
  props: {
    label: String,
    value: [String, Number],
    required: { type: Boolean, default: false }
  },
  render(h, ctx) {
    const { label, value, required } = ctx.props
    return (
      <div class="form-item-functional">
        <label class={{ 'form-label': true, 'is-required': required }}>
          {label}
          {required && <span class="required-mark">*</span>}
        </label>
        <div class="form-value">{value}</div>
      </div>
    )
  }
}

// === 3. functional + ctx.data 透传 attrs ===
export const TransparentWrapper = {
  functional: true,
  render(h, ctx) {
    // 透传所有 attrs/listeners/class/style
    return h(
      'div',
      {
        ...ctx.data,
        class: ['transparent-wrapper', ctx.data.class],
        on: {
          ...ctx.listeners,
          click: (e) => {
            ctx.listeners.click && ctx.listeners.click(e)
            console.log('wrapper click')
          }
        }
      },
      ctx.children
    )
  }
}

// === 4. functional + slots ===
export const FunctionalWithSlots = {
  functional: true,
  props: {
    title: String
  },
  render(h, ctx) {
    const slots = ctx.slots()
    const scopedSlots = ctx.scopedSlots || {}

    return (
      <div class="functional-card">
        <div class="card-title">{ctx.props.title}</div>
        <div class="card-body">
          {scopedSlots.default ? scopedSlots.default({ title: ctx.props.title }) : slots.default}
        </div>
        {slots.footer && <div class="card-footer">{slots.footer}</div>}
      </div>
    )
  }
}

// === 5. functional 组件数组渲染 ===
export const FunctionalList = {
  functional: true,
  props: {
    items: { type: Array, default: () => [] },
    renderItem: { type: Function, default: null }
  },
  render(h, ctx) {
    const { items, renderItem } = ctx.props

    return (
      <div class="functional-list">
        {items.map((item, index) => {
          if (renderItem) {
            return renderItem(h, item, index)
          }
          return (
            <div key={item.id || index} class="list-item">
              {item.label || item.name || JSON.stringify(item)}
            </div>
          )
        })}
      </div>
    )
  }
}

// === 6. functional 条件渲染 ===
export const ConditionalRender = {
  functional: true,
  props: {
    condition: { type: Boolean, default: false },
    tag: { type: String, default: 'div' },
    loading: { type: Boolean, default: false }
  },
  render(h, ctx) {
    const { condition, tag, loading } = ctx.props

    if (loading) {
      return <div class="conditional-loading">Loading...</div>
    }

    if (!condition) {
      return <div class="conditional-empty">Empty</div>
    }

    return h(tag, { class: 'conditional-content' }, ctx.children)
  }
}

// === 7. 复杂 functional — 表格行渲染器 ===
export const TableRow = {
  functional: true,
  props: {
    row: { type: Object, required: true },
    columns: { type: Array, default: () => [] },
    index: { type: Number, default: 0 }
  },
  render(h, ctx) {
    const { row, columns, index } = ctx.props

    return (
      <tr
        class={{ 'table-row': true, 'is-odd': index % 2 === 0 }}
        on-click={() => ctx.listeners.rowclick && ctx.listeners.rowclick(row, index)}
      >
        {columns.map(col => (
          <td key={col.prop} class={{ 'table-cell': true, [`col-${col.prop}`]: true }}>
            {col.render
              ? col.render(h, row[col.prop], row, index)
              : row[col.prop]}
          </td>
        ))}
      </tr>
    )
  }
}
