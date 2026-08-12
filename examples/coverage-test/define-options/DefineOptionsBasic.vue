<script setup>
// Vue 3.3+ 可以在 <script setup> 里设组件 name, 不用再写第二个 <script>
defineOptions({
  name: 'MyComponent',
  inheritAttrs: false,
  customOptions: { foo: 'bar' }  // 自定义选项
})
</script>

<template>
  <div>Hello</div>
</template>
