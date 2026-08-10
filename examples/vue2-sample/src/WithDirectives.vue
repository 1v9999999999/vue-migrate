<template>
  <div>
    <input v-my-directive="x">
    <button v-focus>Focus me</button>
    <div v-pin="200">Pinned</div>
    <input
      :value="search"
      @input="search = $event.target.value"
      placeholder="search"
    >
    <div
      :value="msg"
      @input="msg = $event.target.value"
    ></div>
    <ul>
      <li v-for="item in items" v-if="item.active" :key="item.id">
        {{ item.name }}
      </li>
    </ul>
    <input @keyup.13="submit">
    <input @keydown.27="cancel">
    <input @keyup.32="onSpace">
    <keep-alive :include="'UserCard,UserAvatar'">
      <component :is="current" />
    </keep-alive>
    <keep-alive :include="['A', 'B', 'C']">
      <component :is="other" />
    </keep-alive>
    <keep-alive :include="dynamicInclude">
      <component :is="other" />
    </keep-alive>
  </div>
</template>

<script>
export default {
  name: 'WithDirectives',
  data() {
    return {
      x: 1,
      search: '',
      msg: 'hello',
      items: [
        { id: 1, name: 'a', active: true },
        { id: 2, name: 'b', active: false },
        { id: 3, name: 'c', active: true }
      ],
      current: 'UserCard',
      other: 'X',
      dynamicInclude: ['D', 'E']
    }
  },
  directives: {
    'my-directive': {
      bind(el, binding) {
        el.value = binding.value
      },
      inserted(el) {
        el.focus()
      },
      update(el, binding) {
        el.value = binding.value
      },
      componentUpdated(el) {
        console.log('component updated')
      },
      unbind(el) {
        console.log('cleanup')
      }
    },
    focus: {
      inserted(el) {
        el.focus()
      }
    },
    pin: {
      bind(el, binding) {
        el.style.position = 'fixed'
        el.style.top = binding.value + 'px'
      }
    }
  },
  methods: {
    submit() {},
    cancel() {},
    onSpace() {}
  }
}
</script>
