/**
 * JSX render function 组件 — Vue 2 写法
 * Vue 3 改法: h() from 'vue', JSX 改用 @vue/babel-plugin-jsx
 */
export default {
  name: 'JsxRender',

  props: {
    level: { type: Number, default: 1 },
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false }
  },

  data() {
    return {
      activeIndex: 0,
      hoverIndex: -1
    }
  },

  computed: {
    activeItem() {
      return this.items[this.activeIndex] || null
    }
  },

  methods: {
    handleClick(index) {
      this.activeIndex = index
      this.$emit('select', this.items[index])
    },

    handleHover(index) {
      this.hoverIndex = index
    },

    renderHeader() {
      const tag = `h${this.level}`
      return <tag class="jsx-header">JSX Header Level {this.level}</tag>
    },

    renderList() {
      if (this.loading) {
        return <div class="loading">Loading...</div>
      }

      if (!this.items.length) {
        return <div class="empty">No items</div>
      }

      return (
        <ul class="jsx-list">
          {this.items.map((item, index) => (
            <li
              key={item.id || index}
              class={{
                'list-item': true,
                active: index === this.activeIndex,
                hover: index === this.hoverIndex
              }}
              on-click={() => this.handleClick(index)}
              on-mouseenter={() => this.handleHover(index)}
              on-mouseleave={() => this.handleHover(-1)}
            >
              <span class="item-index">{index + 1}</span>
              <span class="item-label">{item.label}</span>
              {item.badge && <span class="item-badge">{item.badge}</span>}
            </li>
          ))}
        </ul>
      )
    },

    renderDetail() {
      if (!this.activeItem) return null

      return (
        <div class="jsx-detail">
          <h3>{this.activeItem.label}</h3>
          <p>{this.activeItem.description || 'No description'}</p>
          {this.activeItem.tags && this.activeItem.tags.length > 0 && (
            <div class="tag-list">
              {this.activeItem.tags.map(tag => (
                <span key={tag} class="tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )
    },

    renderSlots() {
      // 使用 $slots 和 $scopedSlots
      const headerSlot = this.$slots.header
      const defaultSlot = this.$scopedSlots.default
        ? this.$scopedSlots.default({ item: this.activeItem })
        : this.$slots.default
      const footerSlot = this.$slots.footer

      return (
        <div class="jsx-slots">
          {headerSlot && <div class="slot-header">{headerSlot}</div>}
          {defaultSlot && <div class="slot-default">{defaultSlot}</div>}
          {footerSlot && <div class="slot-footer">{footerSlot}</div>}
        </div>
      )
    }
  },

  // JSX render function (Vue 2)
  render(h) {
    return (
      <div class="jsx-render-container">
        {this.renderHeader()}
        <div class="jsx-content">
          <div class="jsx-left">{this.renderList()}</div>
          <div class="jsx-right">{this.renderDetail()}</div>
        </div>
        {this.renderSlots()}
      </div>
    )
  }
}
