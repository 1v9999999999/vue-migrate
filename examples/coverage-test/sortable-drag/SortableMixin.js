// 通用 Sortable 工具 mixin + 指令封装 (Vue 2 旧写法)

// 1. 通用 sortable mixin
export const sortableMixin = {
  props: {
    list: { type: Array, required: true },
    group: { type: [String, Object], default: null },
    handle: { type: String, default: '' },
    filter: { type: String, default: '' },
    animation: { type: Number, default: 150 },
    disabled: { type: Boolean, default: false }
  },
  data() {
    return {
      _sortable: null
    }
  },
  mounted() {
    this.$nextTick(() => this.init())
  },
  beforeDestroy() {
    this.destroy()
  },
  watch: {
    disabled(val) {
      if (this._sortable) this._sortable.option('disabled', val)
    }
  },
  methods: {
    init() {
      if (this._sortable) this._sortable.destroy()
      if (typeof Sortable === 'undefined') {
        console.warn('Sortable not loaded')
        return
      }
      this._sortable = Sortable.create(this.$refs.sortableRef, {
        animation: this.animation,
        group: this.group,
        handle: this.handle,
        filter: this.filter,
        disabled: this.disabled,
        onEnd: (evt) => this.$emit('sort-end', evt, this.list),
        onStart: (evt) => this.$emit('sort-start', evt),
        onAdd: (evt) => this.$emit('sort-add', evt),
        onUpdate: (evt) => this.$emit('sort-update', evt),
        onRemove: (evt) => this.$emit('sort-remove', evt)
      })
    },
    destroy() {
      if (this._sortable) {
        this._sortable.destroy()
        this._sortable = null
      }
    }
  }
}

// 2. 自定义指令 v-sortable (Vue 2 全局指令)
export const sortableDirective = {
  inserted(el, binding, vnode) {
    const options = typeof binding.value === 'object' ? binding.value : {}
    const onChange = options.onChange || (() => {})
    el._sortable = Sortable.create(el, {
      ...options,
      onEnd: (evt) => {
        // sync to v-model
        const model = vnode.data.model
        if (model && model.expression) {
          const items = Array.from(el.children)
          const newValue = items.map(child => {
            const id = child.dataset.id
            return options.list ? options.list.find(i => String(i.id) === id) : { id, text: child.textContent.trim() }
          })
          vnode.context[model.expression] = newValue
        }
        onChange(evt)
      }
    })
  },
  unbind(el) {
    if (el._sortable) {
      el._sortable.destroy()
      el._sortable = null
    }
  }
}

// 3. Vue 2 旧 prototype 注入
export function setupSortableGlobal(Vue) {
  Vue.prototype.$sortable = {
    create: (el, options) => Sortable.create(el, options),
    destroy: (sortable) => sortable && sortable.destroy(),
    version: Sortable.version
  }
  Vue.directive('sortable', sortableDirective)
  Vue.mixin(sortableMixin)
}

// 4. helper: 数组内拖拽 reorder
export function reorderArray(arr, oldIndex, newIndex) {
  const result = arr.slice()
  const [moved] = result.splice(oldIndex, 1)
  result.splice(newIndex, 0, moved)
  return result
}

// 5. helper: 跨 list 拖拽
export function moveBetweenLists(fromList, toList, fromIndex, toIndex) {
  const result = { from: fromList.slice(), to: toList.slice() }
  const [moved] = result.from.splice(fromIndex, 1)
  result.to.splice(toIndex, 0, moved)
  return result
}
