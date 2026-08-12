<template>
  <div class="h-render">
    <button
      :class="classes"
      :type="buttonType"
      :disabled="disabled"
      @click="handleClick"
      @mouseenter="handleEnter"
      @mouseleave="handleLeave"
    >
      <i v-if="icon" :class="['h-button__icon', `icon-${icon}`]"></i>
      <span class="h-button__text">
        <slot></slot>
      </span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'HRender',

  props: {
    type: { type: String, default: 'primary' },
    size: { type: String, default: 'medium' },
    disabled: { type: Boolean, default: false },
    icon: { type: String, default: '' }
  },

  data() {
    return {
      hover: false
    }
  },

  computed: {
    classes() {
      return [
        'h-button',
        `h-button--${this.type}`,
        `h-button--${this.size}`,
        {
          'is-disabled': this.disabled,
          'is-hover': this.hover
        }
      ]
    },
    buttonType() {
      return 'button'
    }
  },

  methods: {
    handleClick(e) {
      if (this.disabled) return
      this.$emit('click', e)
    },

    handleEnter() {
      this.hover = true
    },

    handleLeave() {
      this.hover = false
    }
  },

  // Vue 2 render function (h 参数: (tag, data, children))
  render(h) {
    // children: icon + slot
    const children = []
    if (this.icon) {
      children.push(h('i', { class: ['h-button__icon', `icon-${this.icon}`] }))
    }
    if (this.$slots.default) {
      children.push(h('span', { class: 'h-button__text' }, this.$slots.default))
    }

    return h(
      'button',
      {
        class: this.classes,
        attrs: {
          type: 'button',
          disabled: this.disabled
        },
        on: {
          click: this.handleClick,
          mouseenter: this.handleEnter,
          mouseleave: this.handleLeave
        }
      },
      children
    )
  }
}
</script>

<style scoped>
.h-render {
  display: inline-block;
}
button {
  border: none;
  cursor: pointer;
  padding: 8px 16px;
}
.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
