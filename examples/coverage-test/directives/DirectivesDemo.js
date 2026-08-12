/**
 * 自定义指令完整示例 — Vue 2 写法
 * Vue 3 钩子名变化: bind→beforeMount, inserted→mounted, update+componentUpdated→beforeUpdate+updated, unbind→unmounted
 */
import Vue from 'vue'

// === 1. 全局注册自定义指令 ===
Vue.directive('focus', {
  inserted(el) {
    el.focus()
  }
})

Vue.directive('permission', {
  inserted(el, binding) {
    const { value } = binding
    const permissions = Vue.prototype.$permissions || []
    if (!permissions.includes(value)) {
      el.parentNode && el.parentNode.removeChild(el)
    }
  }
})

Vue.directive('debounce', {
  inserted(el, binding) {
    const { value, modifiers } = binding
    let timer = null
    const delay = modifiers.long ? 1000 : 300

    el.addEventListener('click', () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        value()
      }, delay)
    })
  }
})

// === 2. 简写形式 (Vue 2: 等于 bind + update) ===
Vue.directive('color', (el, binding) => {
  el.style.color = binding.value
})

Vue.directive('highlight', (el, binding) => {
  el.style.backgroundColor = binding.value || 'yellow'
})

// === 3. 对象指令 (完整钩子) ===
Vue.directive('tooltip', {
  bind(el, binding) {
    // Vue 2 bind → Vue 3 beforeMount
    el._tooltipContent = binding.value
    el._tooltipVisible = false

    el._tooltipMouseEnter = () => {
      el._tooltipVisible = true
      const tooltip = document.createElement('div')
      tooltip.className = 'v-tooltip'
      tooltip.textContent = el._tooltipContent
      tooltip.style.cssText = 'position:absolute;background:#333;color:#fff;padding:4px 8px;border-radius:4px;z-index:9999;'
      document.body.appendChild(tooltip)
      el._tooltipEl = tooltip
      const rect = el.getBoundingClientRect()
      tooltip.style.top = (rect.bottom + 5) + 'px'
      tooltip.style.left = rect.left + 'px'
    }

    el._tooltipMouseLeave = () => {
      el._tooltipVisible = false
      if (el._tooltipEl) {
        document.body.removeChild(el._tooltipEl)
        el._tooltipEl = null
      }
    }

    el.addEventListener('mouseenter', el._tooltipMouseEnter)
    el.addEventListener('mouseleave', el._tooltipMouseLeave)
  },
  inserted(el) {
    // Vue 2 inserted → Vue 3 mounted
    // DOM 已插入
  },
  update(el, binding) {
    // Vue 2 update → Vue 3 beforeUpdate
    el._tooltipContent = binding.value
  },
  componentUpdated(el) {
    // Vue 2 componentUpdated → Vue 3 updated
    // 子组件也更新完
  },
  unbind(el) {
    // Vue 2 unbind → Vue 3 unmounted
    if (el._tooltipEl) {
      document.body.removeChild(el._tooltipEl)
    }
    el.removeEventListener('mouseenter', el._tooltipMouseEnter)
    el.removeEventListener('mouseleave', el._tooltipMouseLeave)
  }
})

// === 4. 指令 + 动态参数 ===
Vue.directive('pin', {
  bind(el, binding) {
    el.style.position = 'fixed'
    const arg = binding.arg || 'top'
    el.style[arg] = binding.value + 'px'
  },
  update(el, binding) {
    const arg = binding.arg || 'top'
    el.style[arg] = binding.value + 'px'
  }
})

// v-pin:top="200" → 固定在顶部 200px
// v-pin:left="100" → 固定在左侧 100px

// === 5. 指令 + 修饰符 ===
Vue.directive('drag', {
  inserted(el, binding) {
    const { modifiers } = binding
    const axis = modifiers.x ? 'x' : modifiers.y ? 'y' : 'both'

    let startX, startY, initialLeft, initialTop

    el.style.cursor = 'move'
    el.style.userSelect = 'none'

    el._dragMouseDown = (e) => {
      startX = e.clientX
      startY = e.clientY
      initialLeft = el.offsetLeft
      initialTop = el.offsetTop
      document.addEventListener('mousemove', el._dragMouseMove)
      document.addEventListener('mouseup', el._dragMouseUp)
      e.preventDefault()
    }

    el._dragMouseMove = (e) => {
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (axis === 'x' || axis === 'both') {
        el.style.left = (initialLeft + dx) + 'px'
      }
      if (axis === 'y' || axis === 'both') {
        el.style.top = (initialTop + dy) + 'px'
      }
    }

    el._dragMouseUp = () => {
      document.removeEventListener('mousemove', el._dragMouseMove)
      document.removeEventListener('mouseup', el._dragMouseUp)
    }

    el.addEventListener('mousedown', el._dragMouseDown)
  },
  unbind(el) {
    el.removeEventListener('mousedown', el._dragMouseDown)
    document.removeEventListener('mousemove', el._dragMouseMove)
    document.removeEventListener('mouseup', el._dragMouseUp)
  }
})

// v-drag          → 自由拖拽
// v-drag.x        → 只能水平拖拽
// v-drag.y        → 只能垂直拖拽

// === 6. 局部指令 (在组件内) ===
export default {
  name: 'DirectivesDemo',
  directives: {
    focus: {
      inserted(el) {
        el.focus()
      }
    },
    'lazy-load': {
      inserted(el, binding) {
        const { value } = binding
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              el.src = value
              observer.unobserve(el)
            }
          })
        })
        observer.observe(el)
        el._lazyObserver = observer
      },
      unbind(el) {
        if (el._lazyObserver) {
          el._lazyObserver.disconnect()
        }
      }
    },
    'long-press': {
      bind(el, binding) {
        const { value, modifiers } = binding
        const duration = modifiers.long ? 2000 : 500
        let timer = null

        el._longPressStart = (e) => {
          timer = setTimeout(() => {
            value(e)
          }, duration)
        }

        el._longPressCancel = () => {
          if (timer) {
            clearTimeout(timer)
            timer = null
          }
        }

        el.addEventListener('touchstart', el._longPressStart)
        el.addEventListener('touchend', el._longPressCancel)
        el.addEventListener('touchmove', el._longPressCancel)
        el.addEventListener('mousedown', el._longPressStart)
        el.addEventListener('mouseup', el._longPressCancel)
        el.addEventListener('mouseleave', el._longPressCancel)
      },
      unbind(el) {
        el.removeEventListener('touchstart', el._longPressStart)
        el.removeEventListener('touchend', el._longPressCancel)
        el.removeEventListener('touchmove', el._longPressCancel)
        el.removeEventListener('mousedown', el._longPressStart)
        el.removeEventListener('mouseup', el._longPressCancel)
        el.removeEventListener('mouseleave', el._longPressCancel)
      }
    }
  },
  data() {
    return {
      color: '#409eff',
      pinTop: 100
    }
  },
  template: `
    <div class="directives-demo">
      <input v-focus placeholder="auto focus" />
      <button v-permission="'edit'" >Edit Button</button>
      <button v-debounce="handleClick">Debounced Click</button>
      <span v-color="color">Colored Text</span>
      <span v-highlight="'#ffeb3b'">Highlighted Text</span>
      <div v-tooltip="'This is a tooltip'">Hover me</div>
      <div v-pin:top="pinTop" class="pinned">Pinned top</div>
      <div v-drag.x class="draggable">Drag me (X only)</div>
      <img v-lazy-load="'/api/image/1'" alt="lazy" />
      <button v-long-press="onLongPress">Long Press Me</button>
      <button v-long-press.long="onLongLongPress">Very Long Press</button>
    </div>
  `,
  methods: {
    handleClick() {
      console.log('debounced click')
    },
    onLongPress() {
      console.log('long pressed!')
    },
    onLongLongPress() {
      console.log('very long pressed!')
    }
  }
}
